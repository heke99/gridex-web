-- Gridex website: OPS API and webhook contract hardening.
-- Adds searchable tenant/customer identifiers for webhook audit and notifications.

alter table if exists public.ops_webhook_events
  add column if not exists company_id text,
  add column if not exists external_customer_id text,
  add column if not exists portal_user_id text,
  add column if not exists delivery_id text;

alter table if exists public.customer_notifications
  add column if not exists external_customer_id text;

create index if not exists idx_ops_webhook_events_company_received
  on public.ops_webhook_events (company_id, received_at desc)
  where company_id is not null;

create index if not exists idx_ops_webhook_events_external_customer
  on public.ops_webhook_events (external_customer_id, received_at desc)
  where external_customer_id is not null;

create index if not exists idx_customer_notifications_external_customer
  on public.customer_notifications (external_customer_id, created_at desc)
  where external_customer_id is not null;
