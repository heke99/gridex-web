alter table if exists public.ops_webhook_events
  add column if not exists tenant_reference text,
  add column if not exists channel text,
  add column if not exists publication_revision text,
  add column if not exists publication_reason text,
  add column if not exists event_timestamp timestamptz,
  add column if not exists delivery_id text,
  add column if not exists header_event_id text,
  add column if not exists header_event_type text;

create index if not exists ops_webhook_events_tenant_event_idx
  on public.ops_webhook_events (tenant_reference, event_id);
create index if not exists ops_webhook_events_tenant_channel_revision_idx
  on public.ops_webhook_events (tenant_reference, channel, publication_revision);
create unique index if not exists ops_webhook_events_delivery_id_uidx
  on public.ops_webhook_events (delivery_id) where delivery_id is not null;

create table if not exists public.ops_publication_state (
  tenant_reference text not null,
  channel text not null,
  publication_revision text,
  etag text,
  event_id text,
  event_timestamp timestamptz,
  publication_reason text,
  changed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (tenant_reference, channel)
);

alter table public.ops_publication_state enable row level security;
revoke all on public.ops_publication_state from anon, authenticated;
create index if not exists ops_publication_state_revision_idx
  on public.ops_publication_state (tenant_reference, channel, publication_revision);
