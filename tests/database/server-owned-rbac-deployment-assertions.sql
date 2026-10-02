-- Read-only deployment assertions. No customer or account rows are inspected.
-- Run after the server-owned RBAC ACL migration with psql -v ON_ERROR_STOP=1.
do $$
declare
  relation record;
  column_record record;
  browser_role text;
  privilege_name text;
  browser_table_privileges text[] := array['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'];
  expected_tables constant text[] := array[
    'roles','permissions','role_permissions','user_roles','user_permissions',
    'user_permission_overrides','admin_users','companies','company_memberships'
  ];
begin
  if current_setting('server_version_num')::integer>=170000 then
    browser_table_privileges:=browser_table_privileges||array['MAINTAIN'];
  end if;
  if (select count(*) from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=any(expected_tables) and c.relkind in ('r','p'))<>9 then
    raise exception 'Server-owned RBAC tables are missing';
  end if;

  for relation in
    select c.oid,c.relname,c.relacl,c.relrowsecurity
    from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname=any(expected_tables)
  loop
    if not relation.relrowsecurity then
      raise exception 'RLS is disabled on public.%',relation.relname;
    end if;
    if exists(select 1 from pg_catalog.aclexplode(relation.relacl) a
      where a.grantee=0 and a.privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN')) then
      raise exception 'PUBLIC retains mutation privileges on public.%',relation.relname;
    end if;
    foreach browser_role in array array['anon','authenticated'] loop
      foreach privilege_name in array browser_table_privileges loop
        if has_table_privilege(browser_role,relation.oid,privilege_name) then
          raise exception '% retains % on public.%',browser_role,privilege_name,relation.relname;
        end if;
      end loop;
    end loop;
    for column_record in
      select a.attnum,a.attname,a.attacl from pg_catalog.pg_attribute a
      where a.attrelid=relation.oid and a.attnum>0 and not a.attisdropped
    loop
      if exists(select 1 from pg_catalog.aclexplode(column_record.attacl) a
        where a.grantee=0 and a.privilege_type in ('INSERT','UPDATE','REFERENCES')) then
        raise exception 'PUBLIC retains column mutation privileges on public.%.%',relation.relname,column_record.attname;
      end if;
      foreach browser_role in array array['anon','authenticated'] loop
        foreach privilege_name in array array['INSERT','UPDATE','REFERENCES'] loop
          if has_column_privilege(browser_role,relation.oid,column_record.attnum,privilege_name) then
            raise exception '% retains % on public.%.%',browser_role,privilege_name,relation.relname,column_record.attname;
          end if;
        end loop;
      end loop;
    end loop;
    foreach privilege_name in array array['SELECT','INSERT','UPDATE','DELETE'] loop
      if not has_table_privilege('service_role',relation.oid,privilege_name) then
        raise exception 'Server role lost % on public.%',privilege_name,relation.relname;
      end if;
    end loop;
    if not has_table_privilege('authenticated',relation.oid,'SELECT') then
      raise exception 'Authenticated SELECT was removed from public.%',relation.relname;
    end if;
  end loop;
end $$;
select 'Server-owned RBAC deployment table and column ACL assertions passed' as result;
