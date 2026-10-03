-- LOCAL ONLY: relevant historical webhook projection tables. No customer data.
alter table public.customer_profiles
  add column if not exists external_identity_ref text,
  add column if not exists billing_customer_ref text;
create table public.ops_webhook_events (
  id uuid primary key default gen_random_uuid(), event_id text not null unique,
  event_type text not null, delivery_id text unique, header_event_id text,
  header_event_type text, tenant_reference text, organization_reference text,
  customer_id text, customer_number text, external_customer_id text,
  customer_email text, portal_user_id text, related_entity_type text,
  related_entity_id text, occurred_at timestamptz, received_at timestamptz not null default now(),
  status text not null, signature_valid boolean not null default false,
  payload_hash text, payload jsonb, handling_note text, error_message text,
  attempt_count integer not null default 0, max_attempts integer not null default 5,
  last_attempt_at timestamptz, next_attempt_at timestamptz, processed_at timestamptz,
  dead_letter_at timestamptz, notification_created boolean not null default false
);
create table public.customer_invoices (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
  external_invoice_ref text, invoice_number text, status text not null default 'issued',
  paid_at timestamptz, raw_payload jsonb not null default '{}', updated_at timestamptz not null default now()
);
create table public.customer_notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id),
  channel text, category text, title text, body text, related_entity_type text,
  related_entity_id text, ops_event_id text, customer_number text, customer_email text,
  external_customer_id text, link_href text, priority text, metadata jsonb not null default '{}',
  identity_resolution_status text, identity_resolution_error text,
  identity_resolution_attempt_count integer not null default 0,
  identity_resolution_last_attempt_at timestamptz, created_at timestamptz not null default now()
);
create unique index customer_notifications_ops_event_uidx
  on public.customer_notifications(ops_event_id) where ops_event_id is not null;
alter table public.ops_webhook_events enable row level security;
alter table public.customer_invoices enable row level security;
alter table public.customer_notifications enable row level security;
grant all on public.ops_webhook_events,public.customer_invoices,public.customer_notifications to service_role;
