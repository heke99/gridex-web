-- Gridex website Batch 8/10: OPS webhook intake, customer notifications and production guards.

alter table if exists public.customer_notifications
  alter column user_id drop not null;

alter table if exists public.customer_notifications
  add column if not exists ops_event_id text,
  add column if not exists customer_number text,
  add column if not exists customer_email text,
  add column if not exists link_href text,
  add column if not exists priority text not null default 'normal',
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create unique index if not exists idx_customer_notifications_ops_event_id
  on public.customer_notifications (ops_event_id)
  where ops_event_id is not null;

create index if not exists idx_customer_notifications_customer_number
  on public.customer_notifications (customer_number, created_at desc)
  where customer_number is not null;

create index if not exists idx_customer_notifications_customer_email
  on public.customer_notifications (customer_email, created_at desc)
  where customer_email is not null;

create table if not exists public.ops_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event_type text not null,
  customer_id text,
  customer_number text,
  customer_email text,
  occurred_at timestamptz,
  status text not null default 'received',
  signature_valid boolean not null default false,
  notification_created boolean not null default false,
  payload_hash text,
  payload jsonb not null default '{}'::jsonb,
  error_message text,
  received_at timestamptz not null default timezone('utc', now()),
  processed_at timestamptz
);

create index if not exists idx_ops_webhook_events_type_received
  on public.ops_webhook_events (event_type, received_at desc);

create index if not exists idx_ops_webhook_events_customer_number
  on public.ops_webhook_events (customer_number, received_at desc)
  where customer_number is not null;

create table if not exists public.website_submission_failures (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'gridex_website',
  flow text not null,
  email_hash text,
  ip_hash text,
  reason text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_website_submission_failures_flow_created
  on public.website_submission_failures (flow, created_at desc);

create index if not exists idx_website_submission_failures_reason_created
  on public.website_submission_failures (reason, created_at desc);

-- Customer notifications are still customer-owned, but webhook-created rows may be
-- matched by user_id, customer number or e-mail. RLS remains enabled.
alter table if exists public.ops_webhook_events enable row level security;
alter table if exists public.website_submission_failures enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ops_webhook_events'
      and policyname = 'ops_webhook_events_service_role_all'
  ) then
    create policy ops_webhook_events_service_role_all
      on public.ops_webhook_events
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'website_submission_failures'
      and policyname = 'website_submission_failures_service_role_all'
  ) then
    create policy website_submission_failures_service_role_all
      on public.website_submission_failures
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;
