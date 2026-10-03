-- Read-only catalog preflight for the independently deployable ACL closure.
-- No account/customer rows are inspected and no DDL is executed.
with relations as (
  select c.oid,c.relname,c.relrowsecurity,c.relforcerowsecurity,c.relacl
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname in(
    'roles','permissions','role_permissions','user_roles','user_permissions',
    'user_permission_overrides','admin_users','companies','company_memberships'
  )
), policies as (
  select p.* from pg_policy p join relations r on r.oid=p.polrelid
), triggers as (
  select n.nspname,c.relname,t.tgname,p.oid,p.prosecdef,pg_get_userbyid(p.proowner) as function_owner
  from pg_trigger t join pg_class c on c.oid=t.tgrelid
  join pg_namespace n on n.oid=c.relnamespace join pg_proc p on p.oid=t.tgfoid
  where not t.tgisinternal and ((n.nspname='auth' and c.relname='users')
    or(n.nspname='public' and c.relname='user_profiles'))
)
select jsonb_build_object(
  'server_version_num',current_setting('server_version_num'),
  'tables',(select count(*) from relations),
  'rls_enabled',(select count(*) from relations where relrowsecurity),
  'anon_select',(select count(*) from relations where has_table_privilege('anon',oid,'SELECT')),
  'authenticated_select',(select count(*) from relations where has_table_privilege('authenticated',oid,'SELECT')),
  'service_select',(select count(*) from relations where has_table_privilege('service_role',oid,'SELECT')),
  'policy_count',(select count(*) from policies),
  'select_policy_count',(select count(*) from policies where polcmd='r'),
  'policies',(select jsonb_agg(jsonb_build_object('table',r.relname,'name',p.polname,
    'command',p.polcmd,'using',pg_get_expr(p.polqual,p.polrelid),
    'check',pg_get_expr(p.polwithcheck,p.polrelid)) order by r.relname,p.polname)
    from policies p join relations r on r.oid=p.polrelid),
  'profile_auth_triggers',(select jsonb_agg(jsonb_build_object('schema',nspname,'table',relname,
    'name',tgname,'function',oid::regprocedure::text,'definer',prosecdef,'owner',function_owner)
    order by nspname,relname,tgname) from triggers)
) as server_owned_rbac_preflight;
