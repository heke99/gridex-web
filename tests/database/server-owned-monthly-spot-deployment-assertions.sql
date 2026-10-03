-- Read-only assertions for the new package; also usable on deployed database.
do $$ declare relation record; col record; role_name text; privilege text; fn regprocedure;
  mutations text[]:=array['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'];
begin
  if current_setting('server_version_num')::integer>=170000 then mutations:=mutations||array['MAINTAIN']; end if;
  for relation in select c.oid,c.relname,c.relacl,c.relrowsecurity,c.relforcerowsecurity
    from pg_class c where c.oid in('public.gridex_monthly_spot_prices'::regclass,
      'public.gridex_spot_basis_config'::regclass,'public.gridex_spot_basis_publish_log'::regclass) loop
    if not relation.relrowsecurity or relation.relforcerowsecurity then
      raise exception 'Monthly table RLS flags changed: %',relation.relname;
    end if;
    if exists(select 1 from aclexplode(relation.relacl) a where a.grantee=0 and a.privilege_type=any(mutations)) then
      raise exception 'PUBLIC retains mutation privileges: %',relation.relname;
    end if;
    foreach role_name in array array['anon','authenticated'] loop
      if not has_table_privilege(role_name,relation.oid,'SELECT') then
        raise exception '% lost SELECT: %',role_name,relation.relname;
      end if;
      foreach privilege in array mutations loop
        if has_table_privilege(role_name,relation.oid,privilege) then
          raise exception '% retains %: %',role_name,privilege,relation.relname;
        end if;
      end loop;
    end loop;
    for col in select a.attnum,a.attname,a.attacl from pg_attribute a
      where a.attrelid=relation.oid and a.attnum>0 and not a.attisdropped loop
      if exists(select 1 from aclexplode(col.attacl) a where a.grantee=0 and a.privilege_type in('INSERT','UPDATE','REFERENCES')) then
        raise exception 'PUBLIC retains column mutation: %.%',relation.relname,col.attname;
      end if;
      foreach role_name in array array['anon','authenticated'] loop
        foreach privilege in array array['INSERT','UPDATE','REFERENCES'] loop
          if has_column_privilege(role_name,relation.oid,col.attnum,privilege) then
            raise exception '% retains column %: %.%',role_name,privilege,relation.relname,col.attname;
          end if;
        end loop;
      end loop;
    end loop;
    foreach privilege in array array['SELECT','INSERT','UPDATE','DELETE'] loop
      if not has_table_privilege('service_role',relation.oid,privilege) then
        raise exception 'service_role lost %: %',privilege,relation.relname;
      end if;
    end loop;
  end loop;
  foreach fn in array array[
    'public.gridex_web_save_monthly_spot_prices(uuid,integer,integer,jsonb)'::regprocedure,
    'public.gridex_web_publish_spot_basis(uuid,integer,integer,text)'::regprocedure,
    'public.gridex_web_rollback_spot_basis(uuid,text)'::regprocedure
  ] loop
    if (select prosecdef from pg_proc where oid=fn) then
      raise exception 'Monthly RPC must be invoker, not definer: %',fn;
    end if;
    if (select prorettype from pg_proc where oid=fn)<>'jsonb'::regtype then
      raise exception 'Monthly RPC return contract changed: %',fn;
    end if;
    if exists(select 1 from pg_proc p,lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      where p.oid=fn and a.grantee=0 and a.privilege_type='EXECUTE') then
      raise exception 'PUBLIC can invoke actor-bound monthly RPC: %',fn;
    end if;
    foreach role_name in array array['anon','authenticated'] loop
      if has_function_privilege(role_name,fn,'EXECUTE') then
        raise exception '% can invoke actor-bound monthly RPC: %',role_name,fn;
      end if;
    end loop;
    if not has_function_privilege('service_role',fn,'EXECUTE') then
      raise exception 'Server lost monthly RPC EXECUTE: %',fn;
    end if;
  end loop;
  if exists(select 1 from information_schema.columns where table_schema='public'
    and table_name='gridex_spot_basis_publish_log' and column_name in('previous_year','previous_month')) then
    raise exception 'Monthly package incorrectly changed production history schema';
  end if;
end $$;
select 'Monthly spot table/column mutation grants, server invoker RPC grants and history shape verified' as result;
