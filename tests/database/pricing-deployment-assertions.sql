-- Read-only metadata verification; safe on the deployed database.
with relations as (
  select c.oid,c.relname,c.relrowsecurity
  from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname in (
    'contract_products','contract_pricing_versions','contract_area_pricing','pricing_version_audit'
  )
), functions as (
  select p.oid,p.proname,p.prosecdef,p.proconfig
  from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in ('gridex_web_save_draft_pricing','gridex_web_publish_pricing')
), forbidden_table_grants as (
  select r.relname,role_name,privilege_name from relations r
  cross join unnest(array['anon','authenticated']) role_name
  cross join unnest(array['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) privilege_name
  where has_table_privilege(role_name,r.oid,privilege_name)
), forbidden_column_grants as (
  select r.relname,a.attname,role_name,privilege_name from relations r
  join pg_catalog.pg_attribute a on a.attrelid=r.oid and a.attnum>0 and not a.attisdropped
  cross join unnest(array['anon','authenticated']) role_name
  cross join unnest(array['INSERT','UPDATE','REFERENCES']) privilege_name
  where has_column_privilege(role_name,r.oid,a.attnum,privilege_name)
), policies as (
  select * from pg_catalog.pg_policies where schemaname='public' and tablename in (
    'contract_products','contract_pricing_versions','contract_area_pricing','pricing_version_audit'
  )
)
select jsonb_build_object(
  'pricing_tables_present_and_rls', (select count(*)=4 and bool_and(relrowsecurity) from relations),
  'browser_mutations_revoked', not exists(select 1 from forbidden_table_grants) and not exists(select 1 from forbidden_column_grants),
  'service_only_invoker_rpcs', (select count(*)=2 and bool_and(not prosecdef
    and has_function_privilege('service_role',oid,'EXECUTE')
    and not has_function_privilege('anon',oid,'EXECUTE')
    and not has_function_privilege('authenticated',oid,'EXECUTE')) from functions),
  'pricing_policies_select_only', (select count(*)=7 and bool_and(cmd='SELECT') from policies),
  'private_permission_helper_authenticated_only', has_function_privilege('authenticated','gridex_web_private.can(text)','EXECUTE')
    and not has_function_privilege('anon','gridex_web_private.can(text)','EXECUTE'),
  'policy_names', (select jsonb_agg(policyname order by policyname) from policies),
  'functions', (select jsonb_agg(jsonb_build_object('name',proname,'security_definer',prosecdef,'settings',proconfig) order by proname) from functions)
) as pricing_deployment_assertions;
