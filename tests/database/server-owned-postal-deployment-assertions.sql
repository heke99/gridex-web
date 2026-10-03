-- Read-only deployment assertions; safe on the deployed database.
do $$
declare
  v_relation record;
  v_column record;
  v_role text;
  v_privilege text;
  v_table_privileges text[]:=array['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'];
begin
  select c.oid,c.relacl,c.relrowsecurity into strict v_relation
  from pg_catalog.pg_class c where c.oid='public.gridex_postal_code_price_area'::regclass;
  if not v_relation.relrowsecurity then raise exception 'Postal mapping RLS is disabled'; end if;
  if current_setting('server_version_num')::integer>=170000 then
    v_table_privileges:=v_table_privileges||array['MAINTAIN'];
  end if;
  if exists(select 1 from pg_catalog.aclexplode(v_relation.relacl) a
    where a.grantee=0 and a.privilege_type=any(v_table_privileges)) then
    raise exception 'PUBLIC retains postal mapping mutation privileges';
  end if;
  foreach v_role in array array['anon','authenticated'] loop
    if not has_table_privilege(v_role,v_relation.oid,'SELECT') then
      raise exception '% lost postal mapping SELECT',v_role;
    end if;
    foreach v_privilege in array v_table_privileges loop
      if has_table_privilege(v_role,v_relation.oid,v_privilege) then
        raise exception '% retains postal mapping %',v_role,v_privilege;
      end if;
    end loop;
  end loop;
  for v_column in select a.attnum,a.attname,a.attacl from pg_catalog.pg_attribute a
    where a.attrelid=v_relation.oid and a.attnum>0 and not a.attisdropped loop
    if exists(select 1 from pg_catalog.aclexplode(v_column.attacl) a
      where a.grantee=0 and a.privilege_type in('INSERT','UPDATE','REFERENCES')) then
      raise exception 'PUBLIC retains postal mapping column mutation privileges: %',v_column.attname;
    end if;
    foreach v_role in array array['anon','authenticated'] loop
      foreach v_privilege in array array['INSERT','UPDATE','REFERENCES'] loop
        if has_column_privilege(v_role,v_relation.oid,v_column.attnum,v_privilege) then
          raise exception '% retains postal mapping column %: %',v_role,v_privilege,v_column.attname;
        end if;
      end loop;
    end loop;
  end loop;
  foreach v_privilege in array array['SELECT','INSERT','UPDATE','DELETE'] loop
    if not has_table_privilege('service_role',v_relation.oid,v_privilege) then
      raise exception 'Server lost postal mapping %',v_privilege;
    end if;
  end loop;
  if (select count(*) from pg_catalog.pg_policy p where p.polrelid=v_relation.oid)<>2
    or not exists(select 1 from pg_catalog.pg_policy p where p.polrelid=v_relation.oid
      and p.polname='gridex_postal_public_read' and p.polcmd='r'
      and pg_get_expr(p.polqual,p.polrelid)='true')
    or not exists(select 1 from pg_catalog.pg_policy p where p.polrelid=v_relation.oid
      and p.polname='gridex_postal_admin_write' and p.polcmd='*') then
    raise exception 'Postal mapping policies changed';
  end if;
end;
$$;
select 'Server-owned postal mapping table/column ACL assertions passed' as result;
