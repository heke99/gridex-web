-- Gridex enterprise customer portal foundation
-- Additive migration only. Keeps existing contracts/admin flows intact.

create extension if not exists pgcrypto;

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gridex_sync_status') THEN
    CREATE TYPE public.gridex_sync_status AS ENUM ('queued', 'processing', 'success', 'failed', 'dead_letter');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gridex_connection_status') THEN
    CREATE TYPE public.gridex_connection_status AS ENUM ('planned', 'configuring', 'active', 'degraded', 'disabled');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gridex_ticket_status') THEN
    CREATE TYPE public.gridex_ticket_status AS ENUM ('open', 'waiting_on_customer', 'waiting_on_internal', 'resolved', 'closed');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gridex_ticket_priority') THEN
    CREATE TYPE public.gridex_ticket_priority AS ENUM ('low', 'normal', 'high', 'urgent');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gridex_message_sender_type') THEN
    CREATE TYPE public.gridex_message_sender_type AS ENUM ('customer', 'agent', 'system', 'integration');
  END IF;
END $$;

create table if not exists public.customer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  first_name text,
  last_name text,
  full_name text,
  phone text,
  language_code text not null default 'sv',
  timezone text not null default 'Europe/Stockholm',
  email_verified_at timestamptz,
  onboarding_state text not null default 'pending_verification',
  billing_customer_ref text,
  contract_customer_ref text,
  external_identity_ref text,
  marketing_opt_in boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.customer_delivery_points (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  facility_id text not null,
  nickname text,
  address text,
  postal_code text,
  city text,
  area_code text,
  apartment text,
  move_in_date date,
  move_out_date date,
  is_primary boolean not null default false,
  external_metering_ref text,
  network_area_ref text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(user_id, facility_id)
);

create table if not exists public.customer_contract_portal_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agreement_id uuid,
  contract_slug text,
  contract_name text,
  status text not null default 'pending_signature',
  starts_at timestamptz,
  ends_at timestamptz,
  signed_at timestamptz,
  activated_at timestamptz,
  billing_provider_key text,
  billing_customer_ref text,
  billing_contract_ref text,
  contract_provider_key text,
  contract_external_ref text,
  pricing_snapshot jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(agreement_id)
);

create table if not exists public.external_provider_catalog (
  provider_key text primary key,
  provider_name text not null,
  domain text not null,
  capabilities jsonb not null default '[]'::jsonb,
  documentation_url text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.external_system_connections (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null references public.external_provider_catalog(provider_key) on delete restrict,
  connection_name text not null,
  domain text not null,
  status public.gridex_connection_status not null default 'planned',
  base_url text,
  auth_type text,
  api_key_secret_name text,
  webhook_secret_name text,
  is_sandbox boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  health_payload jsonb not null default '{}'::jsonb,
  last_healthcheck_at timestamptz,
  last_success_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.integration_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid references public.external_system_connections(id) on delete set null,
  provider_key text,
  entity_type text not null,
  entity_id text,
  direction text not null default 'outbound',
  status public.gridex_sync_status not null default 'queued',
  attempts integer not null default 0,
  max_attempts integer not null default 10,
  next_retry_at timestamptz,
  idempotency_key text,
  payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  last_error text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.customer_invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portal_contract_id uuid references public.customer_contract_portal_links(id) on delete set null,
  provider_key text,
  external_invoice_ref text,
  invoice_number text,
  currency_code text not null default 'SEK',
  invoice_period_start date,
  invoice_period_end date,
  issued_at timestamptz,
  due_at timestamptz,
  paid_at timestamptz,
  status text not null default 'draft',
  total_amount numeric(14,2) not null default 0,
  vat_amount numeric(14,2) not null default 0,
  ocr_number text,
  payment_reference text,
  pdf_url text,
  pdf_storage_path text,
  line_items jsonb not null default '[]'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(provider_key, external_invoice_ref)
);

create table if not exists public.customer_support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portal_contract_id uuid references public.customer_contract_portal_links(id) on delete set null,
  subject text not null,
  category text not null default 'general',
  priority public.gridex_ticket_priority not null default 'normal',
  status public.gridex_ticket_status not null default 'open',
  description text not null,
  assigned_user_id uuid references auth.users(id) on delete set null,
  provider_case_ref text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  closed_at timestamptz
);

create table if not exists public.customer_support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.customer_support_tickets(id) on delete cascade,
  sender_user_id uuid references auth.users(id) on delete set null,
  sender_type public.gridex_message_sender_type not null,
  body text not null,
  attachments jsonb not null default '[]'::jsonb,
  is_internal_note boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.customer_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null default 'portal',
  category text not null default 'general',
  title text not null,
  body text not null,
  related_entity_type text,
  related_entity_id text,
  is_read boolean not null default false,
  read_at timestamptz,
  delivery_status text not null default 'ready',
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_customer_delivery_points_user_id on public.customer_delivery_points(user_id);
create index if not exists idx_customer_contract_links_user_id on public.customer_contract_portal_links(user_id);
create index if not exists idx_customer_invoices_user_id on public.customer_invoices(user_id, issued_at desc);
create index if not exists idx_customer_support_tickets_user_id on public.customer_support_tickets(user_id, created_at desc);
create index if not exists idx_customer_notifications_user_id on public.customer_notifications(user_id, created_at desc);
create index if not exists idx_integration_sync_jobs_status on public.integration_sync_jobs(status, next_retry_at);

create or replace trigger trg_customer_profiles_updated_at
before update on public.customer_profiles
for each row execute function public.set_current_timestamp_updated_at();

create or replace trigger trg_customer_delivery_points_updated_at
before update on public.customer_delivery_points
for each row execute function public.set_current_timestamp_updated_at();

create or replace trigger trg_customer_contract_portal_links_updated_at
before update on public.customer_contract_portal_links
for each row execute function public.set_current_timestamp_updated_at();

create or replace trigger trg_external_system_connections_updated_at
before update on public.external_system_connections
for each row execute function public.set_current_timestamp_updated_at();

create or replace trigger trg_integration_sync_jobs_updated_at
before update on public.integration_sync_jobs
for each row execute function public.set_current_timestamp_updated_at();

create or replace trigger trg_customer_invoices_updated_at
before update on public.customer_invoices
for each row execute function public.set_current_timestamp_updated_at();

create or replace trigger trg_customer_support_tickets_updated_at
before update on public.customer_support_tickets
for each row execute function public.set_current_timestamp_updated_at();

insert into public.external_provider_catalog (provider_key, provider_name, domain, capabilities, documentation_url)
values
  ('billing_provider', 'Billing Provider Placeholder', 'billing', '["invoice.read", "invoice.pdf", "payment.status"]'::jsonb, null),
  ('contract_provider', 'Contract/CIS Provider Placeholder', 'cis', '["customer.create", "contract.create", "delivery_point.sync"]'::jsonb, null)
on conflict (provider_key) do update
set provider_name = excluded.provider_name,
    domain = excluded.domain,
    capabilities = excluded.capabilities,
    documentation_url = excluded.documentation_url;

create or replace function public.gridex_customer_queue_sync_job(
  p_provider_key text,
  p_entity_type text,
  p_entity_id text,
  p_payload jsonb default '{}'::jsonb,
  p_connection_id uuid default null,
  p_created_by uuid default auth.uid(),
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.integration_sync_jobs (
    connection_id,
    provider_key,
    entity_type,
    entity_id,
    payload,
    created_by,
    idempotency_key
  ) values (
    p_connection_id,
    p_provider_key,
    p_entity_type,
    p_entity_id,
    coalesce(p_payload, '{}'::jsonb),
    p_created_by,
    p_idempotency_key
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.gridex_sync_portal_from_agreement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.customer_profiles (
    user_id,
    email,
    first_name,
    last_name,
    full_name,
    phone,
    onboarding_state,
    email_verified_at,
    metadata
  ) values (
    new.user_id,
    new.email,
    new.first_name,
    new.last_name,
    concat_ws(' ', new.first_name, new.last_name),
    new.phone,
    case when new.status in ('finalized', 'email_signed', 'bankid_signed') then 'verified' else 'pending_verification' end,
    case when new.status in ('finalized', 'email_signed', 'bankid_signed') then timezone('utc', now()) else null end,
    jsonb_build_object('source', 'contract_agreements', 'agreement_id', new.id)
  )
  on conflict (user_id) do update set
    email = excluded.email,
    first_name = coalesce(excluded.first_name, customer_profiles.first_name),
    last_name = coalesce(excluded.last_name, customer_profiles.last_name),
    full_name = coalesce(excluded.full_name, customer_profiles.full_name),
    phone = coalesce(excluded.phone, customer_profiles.phone),
    onboarding_state = case
      when customer_profiles.onboarding_state = 'verified' then customer_profiles.onboarding_state
      else excluded.onboarding_state
    end,
    email_verified_at = coalesce(customer_profiles.email_verified_at, excluded.email_verified_at),
    metadata = customer_profiles.metadata || excluded.metadata;

  insert into public.customer_delivery_points (
    user_id,
    facility_id,
    address,
    postal_code,
    city,
    apartment,
    move_in_date,
    is_primary,
    metadata
  ) values (
    new.user_id,
    new.facility_id,
    new.address,
    new.postal_code,
    new.city,
    new.apartment,
    new.move_in_date,
    true,
    jsonb_build_object('agreement_id', new.id)
  )
  on conflict (user_id, facility_id) do update set
    address = excluded.address,
    postal_code = excluded.postal_code,
    city = excluded.city,
    apartment = excluded.apartment,
    move_in_date = coalesce(excluded.move_in_date, customer_delivery_points.move_in_date),
    is_primary = customer_delivery_points.is_primary or excluded.is_primary,
    metadata = customer_delivery_points.metadata || excluded.metadata;

  insert into public.customer_contract_portal_links (
    user_id,
    agreement_id,
    contract_slug,
    status,
    signed_at,
    metadata
  ) values (
    new.user_id,
    new.id,
    new.contract_slug,
    new.status,
    coalesce(new.email_signed_at, new.bankid_signed_at),
    jsonb_build_object('source', 'contract_agreements')
  )
  on conflict (agreement_id) do update set
    contract_slug = excluded.contract_slug,
    status = excluded.status,
    signed_at = coalesce(excluded.signed_at, customer_contract_portal_links.signed_at),
    metadata = customer_contract_portal_links.metadata || excluded.metadata;

  return new;
end;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'contract_agreements'
  ) THEN
    DROP TRIGGER IF EXISTS trg_gridex_sync_portal_from_agreement on public.contract_agreements;
    CREATE TRIGGER trg_gridex_sync_portal_from_agreement
    AFTER INSERT OR UPDATE ON public.contract_agreements
    FOR EACH ROW EXECUTE FUNCTION public.gridex_sync_portal_from_agreement();
  END IF;
END $$;

alter table public.customer_profiles enable row level security;
alter table public.customer_delivery_points enable row level security;
alter table public.customer_contract_portal_links enable row level security;
alter table public.customer_invoices enable row level security;
alter table public.customer_support_tickets enable row level security;
alter table public.customer_support_messages enable row level security;
alter table public.customer_notifications enable row level security;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'customer_profiles' AND policyname = 'customer_profiles_owner_select') THEN
    CREATE POLICY customer_profiles_owner_select ON public.customer_profiles FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'customer_profiles' AND policyname = 'customer_profiles_owner_update') THEN
    CREATE POLICY customer_profiles_owner_update ON public.customer_profiles FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'customer_profiles' AND policyname = 'customer_profiles_owner_insert') THEN
    CREATE POLICY customer_profiles_owner_insert ON public.customer_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'customer_delivery_points' AND policyname = 'customer_delivery_points_owner_all') THEN
    CREATE POLICY customer_delivery_points_owner_all ON public.customer_delivery_points FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'customer_contract_portal_links' AND policyname = 'customer_contract_links_owner_select') THEN
    CREATE POLICY customer_contract_links_owner_select ON public.customer_contract_portal_links FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'customer_invoices' AND policyname = 'customer_invoices_owner_select') THEN
    CREATE POLICY customer_invoices_owner_select ON public.customer_invoices FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'customer_support_tickets' AND policyname = 'customer_support_tickets_owner_all') THEN
    CREATE POLICY customer_support_tickets_owner_all ON public.customer_support_tickets FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'customer_support_messages' AND policyname = 'customer_support_messages_owner_select') THEN
    CREATE POLICY customer_support_messages_owner_select ON public.customer_support_messages FOR SELECT USING (
      exists (
        select 1 from public.customer_support_tickets t
        where t.id = ticket_id and t.user_id = auth.uid()
      )
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'customer_support_messages' AND policyname = 'customer_support_messages_owner_insert') THEN
    CREATE POLICY customer_support_messages_owner_insert ON public.customer_support_messages FOR INSERT WITH CHECK (
      sender_user_id = auth.uid()
      and exists (
        select 1 from public.customer_support_tickets t
        where t.id = ticket_id and t.user_id = auth.uid()
      )
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'customer_notifications' AND policyname = 'customer_notifications_owner_all') THEN
    CREATE POLICY customer_notifications_owner_all ON public.customer_notifications FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

create or replace view public.customer_portal_overview_v1 as
select
  cp.user_id,
  cp.email,
  cp.full_name,
  cp.onboarding_state,
  (
    select count(*) from public.customer_contract_portal_links c where c.user_id = cp.user_id
  ) as contract_count,
  (
    select count(*) from public.customer_invoices i where i.user_id = cp.user_id
  ) as invoice_count,
  (
    select count(*) from public.customer_support_tickets t where t.user_id = cp.user_id and t.status not in ('resolved', 'closed')
  ) as open_ticket_count,
  (
    select max(i.issued_at) from public.customer_invoices i where i.user_id = cp.user_id
  ) as latest_invoice_issued_at
from public.customer_profiles cp;
