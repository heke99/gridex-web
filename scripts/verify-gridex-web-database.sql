-- Run against the exact Supabase project referenced by Gridex Web's
-- NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
-- This script is read-only and fails when the checkout/portal schema is incomplete.

begin;
set local transaction read only;

select
  current_database() as database_name,
  current_user as database_user,
  now() as verified_at;

with required_tables(table_name) as (
  values
    ('website_application_submissions'),
    ('website_application_results'),
    ('website_submission_failures'),
    ('customer_profiles'),
    ('user_profiles'),
    ('customer_contract_portal_links'),
    ('customer_delivery_points'),
    ('customer_portal_write_outbox'),
    ('ops_webhook_events'),
    ('customer_notifications'),
    ('website_public_contract_snapshots'),
    ('website_submission_reconciliation_jobs'),
    ('portal_onboarding_jobs'),
    ('auth_profile_sync_jobs')
)
select
  table_name,
  to_regclass(format('public.%I', table_name)) is not null as present
from required_tables
order by table_name;

do $$
declare
  missing_tables text;
  missing_columns text;
  missing_indexes text;
  insecure_tables text;
  insecure_grants text;
begin
  select string_agg(table_name, ', ' order by table_name)
    into missing_tables
  from (values
    ('website_application_submissions'),
    ('website_application_results'),
    ('website_submission_failures'),
    ('customer_profiles'),
    ('user_profiles'),
    ('customer_contract_portal_links'),
    ('customer_delivery_points'),
    ('customer_portal_write_outbox'),
    ('ops_webhook_events'),
    ('customer_notifications'),
    ('website_public_contract_snapshots'),
    ('website_submission_reconciliation_jobs'),
    ('portal_onboarding_jobs'),
    ('auth_profile_sync_jobs')
  ) required(table_name)
  where to_regclass(format('public.%I', table_name)) is null;

  if missing_tables is not null then
    raise exception 'Gridex Web database is incomplete. Missing tables: %', missing_tables;
  end if;

  select string_agg(format('%s.%s', required.table_name, required.column_name), ', ' order by required.table_name, required.column_name)
    into missing_columns
  from (values
    ('website_application_submissions', 'ops_customer_reference'),
    ('website_application_submissions', 'ops_application_reference'),
    ('website_application_submissions', 'ops_contract_reference'),
    ('website_application_submissions', 'ops_facility_reference'),
    ('website_application_submissions', 'ops_metering_point_reference'),
    ('website_application_results', 'updated_at'),
    ('website_submission_reconciliation_jobs', 'locked_at'),
    ('portal_onboarding_jobs', 'locked_at'),
    ('auth_profile_sync_jobs', 'locked_at')
  ) required(table_name, column_name)
  left join information_schema.columns columns
    on columns.table_schema = 'public'
   and columns.table_name = required.table_name
   and columns.column_name = required.column_name
  where columns.column_name is null;

  if missing_columns is not null then
    raise exception 'Gridex Web database is incomplete. Missing columns: %', missing_columns;
  end if;

  select string_agg(required.index_name, ', ' order by required.index_name)
    into missing_indexes
  from (values
    ('website_application_results_submission_attempt_uidx'),
    ('customer_contract_portal_links_provider_reference_uidx'),
    ('website_submission_reconciliation_due_idx'),
    ('website_submission_reconciliation_processing_idx'),
    ('portal_onboarding_jobs_due_idx'),
    ('portal_onboarding_jobs_processing_idx'),
    ('auth_profile_sync_jobs_due_idx'),
    ('auth_profile_sync_jobs_processing_idx')
  ) required(index_name)
  left join pg_indexes indexes
    on indexes.schemaname = 'public'
   and indexes.indexname = required.index_name
  where indexes.indexname is null;

  if missing_indexes is not null then
    raise exception 'Gridex Web database is incomplete. Missing indexes: %', missing_indexes;
  end if;

  select string_agg(c.relname, ', ' order by c.relname)
    into insecure_tables
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in (
      'website_application_results',
      'website_submission_reconciliation_jobs',
      'portal_onboarding_jobs',
      'auth_profile_sync_jobs'
    )
    and c.relkind = 'r'
    and not c.relrowsecurity;

  if insecure_tables is not null then
    raise exception 'RLS is not enabled on internal Gridex Web tables: %', insecure_tables;
  end if;

  select string_agg(format('%s:%s:%s', table_name, grantee, privilege_type), ', ' order by table_name, grantee, privilege_type)
    into insecure_grants
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name in (
      'website_application_results',
      'website_submission_reconciliation_jobs',
      'portal_onboarding_jobs',
      'auth_profile_sync_jobs'
    )
    and grantee in ('anon', 'authenticated');

  if insecure_grants is not null then
    raise exception 'Internal Gridex Web tables expose anon/authenticated grants: %', insecure_grants;
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'apply_ops_domain_event'
  ) then
    raise exception 'Required webhook RPC public.apply_ops_domain_event is missing.';
  end if;
end $$;

select
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'website_application_results',
    'website_submission_reconciliation_jobs',
    'portal_onboarding_jobs',
    'auth_profile_sync_jobs'
  )
  and grantee in ('anon', 'authenticated')
order by table_name, grantee, privilege_type;

select
  'website_submission_reconciliation_jobs' as queue,
  status,
  count(*) as jobs
from public.website_submission_reconciliation_jobs
group by status
union all
select 'portal_onboarding_jobs', status, count(*)
from public.portal_onboarding_jobs
group by status
union all
select 'auth_profile_sync_jobs', status, count(*)
from public.auth_profile_sync_jobs
group by status
order by queue, status;

rollback;
