begin;

create extension if not exists pgcrypto;

-- Opaque, short-lived success results. Customer/application identifiers never need
-- to be placed in browser history, analytics or referrer headers.
create table if not exists public.website_application_results (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  submission_attempt_id uuid not null references public.website_application_submissions(submission_attempt_id) on delete cascade,
  user_id uuid null references auth.users(id) on delete set null,
  public_result jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_website_application_results_expiry
  on public.website_application_results(expires_at);
alter table public.website_application_results enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='website_application_results'
      and policyname='website_application_results_service_role_all'
  ) then
    create policy website_application_results_service_role_all
      on public.website_application_results for all to service_role
      using (true) with check (true);
  end if;
end $$;

-- Stable portal identifiers must not be ambiguous within this website tenant.
-- Abort safely with a useful message rather than silently choosing a duplicate.
do $$
begin
  if exists (
    select 1 from public.customer_profiles where external_customer_id is not null
    group by external_customer_id having count(*) > 1
  ) then raise exception 'Duplicate customer_profiles.external_customer_id values must be resolved before applying portal uniqueness.';
  end if;
  if exists (
    select 1 from public.customer_profiles where customer_number is not null
    group by customer_number having count(*) > 1
  ) then raise exception 'Duplicate customer_profiles.customer_number values must be resolved before applying portal uniqueness.';
  end if;
  if exists (
    select 1 from public.customer_profiles where portal_identity_id is not null
    group by portal_identity_id having count(*) > 1
  ) then raise exception 'Duplicate customer_profiles.portal_identity_id values must be resolved before applying portal uniqueness.';
  end if;
end $$;

create unique index if not exists customer_profiles_external_customer_uidx
  on public.customer_profiles(external_customer_id) where external_customer_id is not null;
create unique index if not exists customer_profiles_customer_number_uidx
  on public.customer_profiles(customer_number) where customer_number is not null;
create unique index if not exists customer_profiles_portal_identity_uidx
  on public.customer_profiles(portal_identity_id) where portal_identity_id is not null;

-- Preserve the authoritative OPS quote and the exact public contract display
-- used at acceptance without sending undocumented fields to OPS.
alter table public.website_application_submissions
  add column if not exists pricing_quote_snapshot jsonb,
  add column if not exists contract_display_snapshot jsonb;

-- Durable write queue for every customer-facing write operation.
alter table public.customer_portal_write_outbox
  add column if not exists payload_hash text,
  add column if not exists last_http_status integer,
  add column if not exists max_attempts integer not null default 10,
  add column if not exists dead_letter_at timestamptz;

update public.customer_portal_write_outbox
set payload_hash = encode(digest(identity::text || ':' || payload::text, 'sha256'), 'hex')
where payload_hash is null;

alter table public.customer_portal_write_outbox
  drop constraint if exists customer_portal_write_outbox_operation_type_check;
alter table public.customer_portal_write_outbox
  add constraint customer_portal_write_outbox_operation_type_check check (
    operation_type in (
      'customer_event','notification_read','profile_update','customer_sync',
      'customer_portal_sync','move_out','facility_data_update'
    )
  );
alter table public.customer_portal_write_outbox
  drop constraint if exists customer_portal_write_outbox_status_check;
alter table public.customer_portal_write_outbox
  add constraint customer_portal_write_outbox_status_check
  check (status in ('pending','processing','completed','failed','dead_letter'));
create index if not exists idx_customer_portal_write_outbox_dead_letter
  on public.customer_portal_write_outbox(dead_letter_at desc) where status='dead_letter';

-- Unknown but correctly signed event types are retained and acknowledged.
alter table if exists public.ops_webhook_events
  add column if not exists handling_note text;

commit;
