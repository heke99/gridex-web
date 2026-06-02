-- Full commercial signup flow foundation.
-- Covers pricing snapshots, personal identity handling, customer/order events,
-- customer-visible statuses and CIS signing/sync operations.

create extension if not exists pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gridex_signup_order_status') THEN
    CREATE TYPE public.gridex_signup_order_status AS ENUM (
      'draft',
      'offer_calculated',
      'customer_details_submitted',
      'account_created',
      'sent_to_cis',
      'waiting_for_cis',
      'signature_email_sent',
      'waiting_for_signature',
      'signed',
      'activation_pending',
      'active',
      'rejected_by_cis',
      'cancelled',
      'failed'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gridex_cis_action_status') THEN
    CREATE TYPE public.gridex_cis_action_status AS ENUM (
      'queued',
      'sent',
      'waiting_for_cis',
      'success',
      'failed',
      'cancelled',
      'dead_letter'
    );
  END IF;
END $$;

alter table public.customer_profiles
  add column if not exists personal_number_hash text,
  add column if not exists personal_number_masked text,
  add column if not exists cis_customer_ref text,
  add column if not exists gdpr_retention_until date;

alter table public.customer_contract_portal_links
  add column if not exists signup_order_id uuid,
  add column if not exists customer_status_label text,
  add column if not exists customer_status_step integer not null default 1,
  add column if not exists cis_status text,
  add column if not exists cis_last_event_at timestamptz;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'contract_agreements'
  ) THEN
    ALTER TABLE public.contract_agreements
      ADD COLUMN IF NOT EXISTS personal_number_hash text,
      ADD COLUMN IF NOT EXISTS personal_number_masked text,
      ADD COLUMN IF NOT EXISTS monthly_consumption_kwh numeric(14,2),
      ADD COLUMN IF NOT EXISTS price_area text,
      ADD COLUMN IF NOT EXISTS price_snapshot jsonb not null default '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS customer_status_label text,
      ADD COLUMN IF NOT EXISTS customer_status_step integer not null default 1,
      ADD COLUMN IF NOT EXISTS cis_customer_ref text,
      ADD COLUMN IF NOT EXISTS cis_contract_ref text,
      ADD COLUMN IF NOT EXISTS cis_status text,
      ADD COLUMN IF NOT EXISTS cis_last_event_at timestamptz;
  END IF;
END $$;

create table if not exists public.customer_sensitive_identities (
  user_id uuid primary key references auth.users(id) on delete cascade,
  personal_number_hash text not null,
  personal_number_masked text not null,
  personal_number_ciphertext text,
  encryption_key_ref text,
  source text not null default 'signup',
  verified_at timestamptz,
  last_sent_to_cis_at timestamptz,
  gdpr_retention_until date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.customer_signup_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agreement_id uuid,
  contract_slug text not null,
  contract_name text,
  contract_type text not null,
  pricing_version_id uuid,
  status public.gridex_signup_order_status not null default 'customer_details_submitted',
  customer_status_label text not null default 'Vi har tagit emot din beställning',
  customer_status_step integer not null default 1,
  email text not null,
  phone text,
  first_name text,
  last_name text,
  personal_number_hash text not null,
  personal_number_masked text not null,
  address text,
  postal_code text,
  city text,
  apartment text,
  facility_id text,
  move_in_date date,
  price_area text not null check (price_area in ('SE1', 'SE2', 'SE3', 'SE4')),
  monthly_consumption_kwh numeric(14,2) not null,
  price_snapshot jsonb not null,
  legal_snapshot jsonb not null default '{}'::jsonb,
  cis_payload jsonb not null default '{}'::jsonb,
  cis_customer_ref text,
  cis_contract_ref text,
  cis_status text,
  signing_provider text not null default 'cis',
  signing_status text not null default 'waiting_for_cis',
  signing_email_last_sent_at timestamptz,
  idempotency_key text not null unique,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.customer_agreement_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  agreement_id uuid,
  signup_order_id uuid references public.customer_signup_orders(id) on delete cascade,
  event_type text not null,
  customer_visible boolean not null default false,
  customer_label text,
  summary text,
  payload jsonb not null default '{}'::jsonb,
  source text not null default 'gridex',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.cis_sync_actions (
  id uuid primary key default gen_random_uuid(),
  signup_order_id uuid references public.customer_signup_orders(id) on delete cascade,
  agreement_id uuid,
  user_id uuid references auth.users(id) on delete cascade,
  action_type text not null,
  status public.gridex_cis_action_status not null default 'queued',
  provider_key text not null default 'cis',
  idempotency_key text not null unique,
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  attempts integer not null default 0,
  max_attempts integer not null default 10,
  next_retry_at timestamptz,
  last_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_customer_signup_orders_user_id
  on public.customer_signup_orders (user_id, created_at desc);

create index if not exists idx_customer_signup_orders_agreement_id
  on public.customer_signup_orders (agreement_id);

create index if not exists idx_customer_signup_orders_status
  on public.customer_signup_orders (status, updated_at desc);

create index if not exists idx_customer_agreement_events_user_id
  on public.customer_agreement_events (user_id, created_at desc);

create index if not exists idx_customer_agreement_events_signup_order_id
  on public.customer_agreement_events (signup_order_id, created_at desc);

create index if not exists idx_cis_sync_actions_status
  on public.cis_sync_actions (status, next_retry_at, created_at);

create or replace trigger trg_customer_sensitive_identities_updated_at
before update on public.customer_sensitive_identities
for each row execute function public.set_current_timestamp_updated_at();

create or replace trigger trg_customer_signup_orders_updated_at
before update on public.customer_signup_orders
for each row execute function public.set_current_timestamp_updated_at();

create or replace trigger trg_cis_sync_actions_updated_at
before update on public.cis_sync_actions
for each row execute function public.set_current_timestamp_updated_at();

create or replace function public.gridex_customer_status_label(p_status text)
returns text
language sql
immutable
as $$
  select case p_status
    when 'draft' then 'Vi förbereder din beställning'
    when 'offer_calculated' then 'Vi har räknat fram ditt erbjudande'
    when 'customer_details_submitted' then 'Vi har tagit emot din beställning'
    when 'account_created' then 'Ditt konto är skapat'
    when 'sent_to_cis' then 'Beställningen har skickats till avtalssystemet'
    when 'waiting_for_cis' then 'Vi väntar på avtalssystemet'
    when 'signature_email_sent' then 'Signeringsmail har skickats'
    when 'waiting_for_signature' then 'Avtal väntar på signering'
    when 'signed' then 'Avtal signerat'
    when 'activation_pending' then 'Avtal aktiveras'
    when 'active' then 'Avtal aktivt'
    when 'rejected_by_cis' then 'Avtal kunde inte godkännas'
    when 'cancelled' then 'Beställningen är avbruten'
    when 'failed' then 'Beställningen behöver hanteras manuellt'
    else 'Vi behandlar din beställning'
  end
$$;

create or replace function public.gridex_customer_status_step(p_status text)
returns integer
language sql
immutable
as $$
  select case p_status
    when 'customer_details_submitted' then 1
    when 'account_created' then 1
    when 'sent_to_cis' then 1
    when 'waiting_for_cis' then 1
    when 'signature_email_sent' then 2
    when 'waiting_for_signature' then 2
    when 'signed' then 3
    when 'activation_pending' then 4
    when 'active' then 5
    when 'rejected_by_cis' then 2
    when 'cancelled' then 1
    when 'failed' then 1
    else 1
  end
$$;

create or replace function public.gridex_log_customer_agreement_event(
  p_user_id uuid,
  p_agreement_id uuid,
  p_signup_order_id uuid,
  p_event_type text,
  p_summary text default null,
  p_payload jsonb default '{}'::jsonb,
  p_customer_visible boolean default false,
  p_customer_label text default null,
  p_source text default 'gridex'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.customer_agreement_events (
    user_id,
    agreement_id,
    signup_order_id,
    event_type,
    summary,
    payload,
    customer_visible,
    customer_label,
    source,
    created_by
  ) values (
    p_user_id,
    p_agreement_id,
    p_signup_order_id,
    p_event_type,
    p_summary,
    coalesce(p_payload, '{}'::jsonb),
    coalesce(p_customer_visible, false),
    p_customer_label,
    coalesce(p_source, 'gridex'),
    auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.gridex_apply_signup_order_status(
  p_signup_order_id uuid,
  p_status public.gridex_signup_order_status,
  p_cis_status text default null,
  p_cis_customer_ref text default null,
  p_cis_contract_ref text default null,
  p_event_type text default null,
  p_summary text default null,
  p_payload jsonb default '{}'::jsonb,
  p_customer_visible boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_label text;
  v_step integer;
begin
  select * into v_order
  from public.customer_signup_orders
  where id = p_signup_order_id;

  if v_order.id is null then
    raise exception 'Signup order not found';
  end if;

  v_label := public.gridex_customer_status_label(p_status::text);
  v_step := public.gridex_customer_status_step(p_status::text);

  update public.customer_signup_orders
  set status = p_status,
      customer_status_label = v_label,
      customer_status_step = v_step,
      cis_status = coalesce(p_cis_status, cis_status),
      cis_customer_ref = coalesce(p_cis_customer_ref, cis_customer_ref),
      cis_contract_ref = coalesce(p_cis_contract_ref, cis_contract_ref),
      signing_status = case
        when p_status in ('signature_email_sent', 'waiting_for_signature') then 'waiting_for_signature'
        when p_status = 'signed' then 'signed'
        when p_status = 'rejected_by_cis' then 'rejected'
        else signing_status
      end
  where id = p_signup_order_id;

  update public.customer_contract_portal_links
  set status = p_status::text,
      customer_status_label = v_label,
      customer_status_step = v_step,
      cis_status = coalesce(p_cis_status, cis_status),
      billing_customer_ref = coalesce(p_cis_customer_ref, billing_customer_ref),
      billing_contract_ref = coalesce(p_cis_contract_ref, billing_contract_ref),
      contract_external_ref = coalesce(p_cis_contract_ref, contract_external_ref),
      cis_last_event_at = timezone('utc', now())
  where signup_order_id = p_signup_order_id
     or agreement_id = v_order.agreement_id;

  if v_order.agreement_id is not null and exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'contract_agreements'
  ) then
    update public.contract_agreements
    set status = p_status::text,
        customer_status_label = v_label,
        customer_status_step = v_step,
        cis_status = coalesce(p_cis_status, cis_status),
        cis_customer_ref = coalesce(p_cis_customer_ref, cis_customer_ref),
        cis_contract_ref = coalesce(p_cis_contract_ref, cis_contract_ref),
        cis_last_event_at = timezone('utc', now())
    where id = v_order.agreement_id;
  end if;

  perform public.gridex_log_customer_agreement_event(
    v_order.user_id,
    v_order.agreement_id,
    p_signup_order_id,
    coalesce(p_event_type, 'status_changed'),
    coalesce(p_summary, v_label),
    coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('status', p_status::text),
    coalesce(p_customer_visible, true),
    v_label,
    'gridex'
  );
end;
$$;

create or replace view public.customer_contract_status_v1 as
select
  o.id as signup_order_id,
  o.user_id,
  o.agreement_id,
  o.contract_slug,
  o.contract_name,
  o.contract_type,
  o.status,
  o.customer_status_label,
  o.customer_status_step,
  o.price_area,
  o.monthly_consumption_kwh,
  o.price_snapshot,
  o.cis_customer_ref,
  o.cis_contract_ref,
  o.cis_status,
  o.signing_provider,
  o.signing_status,
  o.created_at,
  o.updated_at
from public.customer_signup_orders o;

alter table public.customer_sensitive_identities enable row level security;
alter table public.customer_signup_orders enable row level security;
alter table public.customer_agreement_events enable row level security;
alter table public.cis_sync_actions enable row level security;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'customer_signup_orders' AND policyname = 'customer_signup_orders_owner_select') THEN
    CREATE POLICY customer_signup_orders_owner_select ON public.customer_signup_orders
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'customer_agreement_events' AND policyname = 'customer_agreement_events_owner_select') THEN
    CREATE POLICY customer_agreement_events_owner_select ON public.customer_agreement_events
      FOR SELECT USING (auth.uid() = user_id and customer_visible = true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'customer_sensitive_identities' AND policyname = 'customer_sensitive_identities_owner_masked_select') THEN
    CREATE POLICY customer_sensitive_identities_owner_masked_select ON public.customer_sensitive_identities
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

insert into public.external_provider_catalog (
  provider_key,
  provider_name,
  domain,
  capabilities,
  documentation_url
)
values (
  'cis',
  'CIS system',
  'cis',
  '["customer.create", "contract.create", "signature.email", "signature.status", "contract.status", "invoice.webhook"]'::jsonb,
  null
)
on conflict (provider_key) do update
set provider_name = excluded.provider_name,
    domain = excluded.domain,
    capabilities = excluded.capabilities,
    documentation_url = excluded.documentation_url;

-- Seed permission catalog when compatible RBAC tables are present.
DO $
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'permissions' AND column_name = 'permission'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'permissions' AND column_name = 'description'
  ) THEN
    INSERT INTO public.permissions (permission, description)
    VALUES
      ('sensitive_identity.read', 'Read sensitive personal identity fields'),
      ('cis.sync.write', 'Retry, cancel and manage CIS sync actions'),
      ('cis.signature.write', 'Resend or manage CIS signature emails')
    ON CONFLICT (permission) DO NOTHING;
  END IF;
END $;
