begin;

create extension if not exists pgcrypto;

-- One rotatable, short-lived result per immutable checkout attempt.
alter table if exists public.website_application_results
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

with ranked as (
  select id,
         row_number() over (
           partition by submission_attempt_id
           order by created_at desc, id desc
         ) as row_number
  from public.website_application_results
)
delete from public.website_application_results result_row
using ranked
where result_row.id = ranked.id
  and ranked.row_number > 1;

create unique index if not exists website_application_results_submission_attempt_uidx
  on public.website_application_results(submission_attempt_id);

alter table public.website_application_results enable row level security;
revoke all on table public.website_application_results from anon, authenticated;
grant select, insert, update, delete on table public.website_application_results to service_role;

-- Persist only the public opaque references exposed by the immutable Website OpenAPI.
alter table if exists public.website_application_submissions
  add column if not exists ops_customer_reference text,
  add column if not exists ops_application_reference text,
  add column if not exists ops_contract_reference text,
  add column if not exists ops_facility_reference text,
  add column if not exists ops_metering_point_reference text;

create index if not exists website_application_submissions_customer_reference_idx
  on public.website_application_submissions(ops_customer_reference)
  where ops_customer_reference is not null;
create index if not exists website_application_submissions_contract_reference_idx
  on public.website_application_submissions(ops_contract_reference)
  where ops_contract_reference is not null;

-- Current OPS responses expose an opaque contract_reference rather than an
-- internal agreement UUID. Keep one local projection per user/provider/reference.
with ranked_contract_links as (
  select id,
         row_number() over (
           partition by user_id, contract_provider_key, contract_external_ref
           order by updated_at desc, created_at desc, id desc
         ) as row_number
  from public.customer_contract_portal_links
  where contract_provider_key is not null
    and contract_external_ref is not null
)
delete from public.customer_contract_portal_links link
using ranked_contract_links ranked
where link.id = ranked.id
  and ranked.row_number > 1;

create unique index if not exists customer_contract_portal_links_provider_reference_uidx
  on public.customer_contract_portal_links(user_id, contract_provider_key, contract_external_ref);

create table if not exists public.website_submission_reconciliation_jobs (
  id uuid primary key default gen_random_uuid(),
  submission_attempt_id uuid not null references public.website_application_submissions(submission_attempt_id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','processing','completed','retryable_failure','manual_review')),
  payload jsonb not null,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 10 check (max_attempts between 1 and 100),
  next_attempt_at timestamptz,
  last_error text,
  locked_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (submission_attempt_id)
);

create index if not exists website_submission_reconciliation_due_idx
  on public.website_submission_reconciliation_jobs(next_attempt_at, created_at)
  where status in ('pending','retryable_failure');
create index if not exists website_submission_reconciliation_processing_idx
  on public.website_submission_reconciliation_jobs(locked_at)
  where status = 'processing';

alter table public.website_submission_reconciliation_jobs enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'website_submission_reconciliation_jobs'
      and policyname = 'website_submission_reconciliation_service_role_all'
  ) then
    create policy website_submission_reconciliation_service_role_all
      on public.website_submission_reconciliation_jobs
      for all to service_role
      using (true) with check (true);
  end if;
end $$;
revoke all on table public.website_submission_reconciliation_jobs from anon, authenticated;
grant select, insert, update, delete on table public.website_submission_reconciliation_jobs to service_role;

create table if not exists public.portal_onboarding_jobs (
  id uuid primary key default gen_random_uuid(),
  submission_attempt_id uuid not null references public.website_application_submissions(submission_attempt_id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','processing','completed','retryable_failure','manual_review')),
  application_number text,
  customer_number text,
  external_customer_id text,
  email text not null,
  auth_user_id uuid references auth.users(id) on delete set null,
  payload jsonb not null,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 10 check (max_attempts between 1 and 100),
  next_attempt_at timestamptz,
  last_error text,
  locked_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (submission_attempt_id)
);

create index if not exists portal_onboarding_jobs_due_idx
  on public.portal_onboarding_jobs(next_attempt_at, created_at)
  where status in ('pending','retryable_failure');
create index if not exists portal_onboarding_jobs_processing_idx
  on public.portal_onboarding_jobs(locked_at)
  where status = 'processing';
create index if not exists portal_onboarding_jobs_auth_user_idx
  on public.portal_onboarding_jobs(auth_user_id, status)
  where auth_user_id is not null and status <> 'completed';
create index if not exists portal_onboarding_jobs_email_idx
  on public.portal_onboarding_jobs(lower(email), status)
  where status <> 'completed';

alter table public.portal_onboarding_jobs enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'portal_onboarding_jobs'
      and policyname = 'portal_onboarding_jobs_service_role_all'
  ) then
    create policy portal_onboarding_jobs_service_role_all
      on public.portal_onboarding_jobs
      for all to service_role
      using (true) with check (true);
  end if;
end $$;
revoke all on table public.portal_onboarding_jobs from anon, authenticated;
grant select, insert, update, delete on table public.portal_onboarding_jobs to service_role;

create table if not exists public.auth_profile_sync_jobs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  otp_type text not null
    check (otp_type in ('email','recovery','invite','email_change')),
  status text not null default 'pending'
    check (status in ('pending','processing','completed','retryable_failure','manual_review')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 10 check (max_attempts between 1 and 100),
  next_attempt_at timestamptz,
  last_error text,
  locked_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists auth_profile_sync_jobs_due_idx
  on public.auth_profile_sync_jobs(next_attempt_at, created_at)
  where status in ('pending','retryable_failure');
create index if not exists auth_profile_sync_jobs_processing_idx
  on public.auth_profile_sync_jobs(locked_at)
  where status = 'processing';

alter table public.auth_profile_sync_jobs enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'auth_profile_sync_jobs'
      and policyname = 'auth_profile_sync_jobs_service_role_all'
  ) then
    create policy auth_profile_sync_jobs_service_role_all
      on public.auth_profile_sync_jobs
      for all to service_role
      using (true) with check (true);
  end if;
end $$;
revoke all on table public.auth_profile_sync_jobs from anon, authenticated;
grant select, insert, update, delete on table public.auth_profile_sync_jobs to service_role;

commit;
