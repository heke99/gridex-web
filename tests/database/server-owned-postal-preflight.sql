-- Read-only catalog snapshot before and after the postal ACL closure.
-- No postal, customer or account rows are inspected.
with relation as (
  select c.oid,c.relname,c.relrowsecurity,c.relforcerowsecurity,c.relacl
  from pg_catalog.pg_class c
  where c.oid=to_regclass('public.gridex_postal_code_price_area')
), preserved as (
  select jsonb_build_object(
    'rls',r.relrowsecurity,'force_rls',r.relforcerowsecurity,
    'select_grants',(select jsonb_agg(to_jsonb(a) order by a.grantee,a.grantor,a.is_grantable)
      from pg_catalog.aclexplode(r.relacl) a where a.privilege_type='SELECT'),
    'column_select_grants',(select jsonb_agg(jsonb_build_object('name',a.attname,
      'grants',(select jsonb_agg(to_jsonb(x) order by x.grantee,x.grantor,x.is_grantable)
        from pg_catalog.aclexplode(a.attacl) x where x.privilege_type='SELECT')) order by a.attnum)
      from pg_catalog.pg_attribute a where a.attrelid=r.oid and a.attnum>0 and not a.attisdropped),
    'service_grants',(select jsonb_object_agg(privilege_name,
      has_table_privilege('service_role',r.oid,privilege_name))
      from unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) privilege_name),
    'policies',(select jsonb_agg(jsonb_build_object('name',p.polname,'command',p.polcmd,
      'roles',p.polroles,'permissive',p.polpermissive,
      'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid)) order by p.polname)
      from pg_catalog.pg_policy p where p.polrelid=r.oid)
  ) as snapshot from relation r
)
select jsonb_build_object(
  'server_version_num',current_setting('server_version_num'),
  'table_present',exists(select 1 from relation),
  'preserved',(select snapshot from preserved),
  'preserved_md5',(select md5(snapshot::text) from preserved),
  'browser_table_mutations',(select jsonb_agg(jsonb_build_object('role',role_name,
    'privilege',privilege_name) order by role_name,privilege_name)
    from relation r cross join unnest(array['anon','authenticated']) role_name
    cross join unnest(array['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']||
      case when current_setting('server_version_num')::integer>=170000 then array['MAINTAIN'] else '{}'::text[] end) privilege_name
    where has_table_privilege(role_name,r.oid,privilege_name))
) as server_owned_postal_preflight;
