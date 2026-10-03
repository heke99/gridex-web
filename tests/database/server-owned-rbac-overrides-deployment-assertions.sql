-- Read-only deployment assertions for the fourth, global-override migration.
-- No customer or account rows are inspected. Run with psql -v ON_ERROR_STOP=1.
do $$
begin
  if not exists(
    select 1 from pg_catalog.pg_proc p
    where p.oid='public.gridex_web_set_global_permission_override(uuid,uuid,uuid,text)'::regprocedure
      and p.prosecdef and 'search_path=""'=any(p.proconfig)
      and has_function_privilege('service_role',p.oid,'EXECUTE')
      and not has_function_privilege('anon',p.oid,'EXECUTE')
      and not has_function_privilege('authenticated',p.oid,'EXECUTE')
      and not exists(select 1 from pg_catalog.aclexplode(p.proacl) a
        where a.grantee=0 and a.privilege_type='EXECUTE')
  ) then
    raise exception 'Global override RPC is not a service-only definer with locked search_path';
  end if;
  if has_table_privilege('service_role','auth.users','SELECT') then
    raise exception 'Server override RPC widened service-role access to Auth users';
  end if;
end $$;
select 'Global RBAC override deployment service-only RPC and Auth ACL assertions passed' as result;
