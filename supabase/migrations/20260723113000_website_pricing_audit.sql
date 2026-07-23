begin;
create table if not exists public.website_price_area_resolutions (
  id uuid primary key default gen_random_uuid(),
  address_fingerprint text not null,
  postal_code text not null check (postal_code ~ '^[0-9]{5}$'),
  price_area_code text check (price_area_code in ('SE1','SE2','SE3','SE4')),
  grid_area_code text,
  grid_owner_name text,
  confidence numeric(5,4),
  assurance_level text not null check (assurance_level in ('verified','sufficient_for_application','indicative_only','unresolved')),
  source text,
  source_chain jsonb not null default '[]'::jsonb,
  resolver_version text not null,
  resolved_at timestamptz not null default now(),
  valid_until timestamptz not null,
  created_at timestamptz not null default now()
);
create table if not exists public.market_price_snapshots (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  price_area_code text not null check (price_area_code in ('SE1','SE2','SE3','SE4')),
  period_type text not null,
  period_start date not null,
  period_end date not null,
  average_ore_per_kwh numeric(18,6) not null,
  source_interval_minutes integer,
  expected_intervals integer,
  received_intervals integer,
  completeness_ratio numeric(8,6) not null default 1,
  fetched_at timestamptz not null default now(),
  valid_until timestamptz not null,
  provider_payload_sha256 text,
  calculation_version text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.website_pricing_snapshots (
  id uuid primary key default gen_random_uuid(),
  pricing_snapshot_reference text not null unique,
  offer_reference text not null,
  customer_type text not null check (customer_type in ('private','business')),
  price_area_code text not null check (price_area_code in ('SE1','SE2','SE3','SE4')),
  annual_consumption_kwh numeric(18,3) not null check (annual_consumption_kwh > 0),
  market_price_snapshot_id uuid references public.market_price_snapshots(id),
  calculation_components_json jsonb not null,
  subtotal_ex_vat numeric(18,6) not null,
  vat_amount numeric(18,6) not null,
  total_inc_vat numeric(18,6) not null,
  calculation_version text not null,
  issued_at timestamptz not null,
  valid_until timestamptz not null,
  snapshot_sha256 text not null,
  status text not null default 'issued' check (status in ('issued','used','expired','revoked')),
  ops_application_id text,
  ops_contract_id text,
  ops_contract_price_snapshot_id text,
  created_at timestamptz not null default now()
);
alter table public.website_price_area_resolutions enable row level security;
alter table public.market_price_snapshots enable row level security;
alter table public.website_pricing_snapshots enable row level security;
revoke all on public.website_price_area_resolutions from anon, authenticated;
revoke all on public.market_price_snapshots from anon, authenticated;
revoke all on public.website_pricing_snapshots from anon, authenticated;
commit;
