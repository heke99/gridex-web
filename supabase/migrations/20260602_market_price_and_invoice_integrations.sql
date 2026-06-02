-- Market price import and external invoice integration support.
-- Additive and safe to run on environments that already have manual spot tables.

create extension if not exists pgcrypto;

create table if not exists public.gridex_monthly_spot_prices (
  id uuid primary key default gen_random_uuid(),
  price_area text not null check (price_area in ('SE1', 'SE2', 'SE3', 'SE4')),
  year integer not null check (year between 2000 and 2100),
  month integer not null check (month between 1 and 12),
  avg_spot_ore numeric(14,6) not null check (avg_spot_ore >= 0),
  source text,
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (price_area, year, month)
);

alter table public.gridex_monthly_spot_prices
  add column if not exists source text,
  add column if not exists source_payload jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

create table if not exists public.gridex_spot_basis_config (
  id integer primary key default 1 check (id = 1),
  active_year integer not null check (active_year between 2000 and 2100),
  active_month integer not null check (active_month between 1 and 12),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.gridex_spot_basis_config (id, active_year, active_month)
values (
  1,
  extract(year from timezone('utc', now()) - interval '1 month')::integer,
  extract(month from timezone('utc', now()) - interval '1 month')::integer
)
on conflict (id) do nothing;

create table if not exists public.gridex_spot_basis_publish_log (
  id uuid primary key default gen_random_uuid(),
  action text not null check (action in ('publish', 'rollback')),
  active_year integer not null check (active_year between 2000 and 2100),
  active_month integer not null check (active_month between 1 and 12),
  previous_year integer,
  previous_month integer,
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_gridex_monthly_spot_prices_period
  on public.gridex_monthly_spot_prices (year, month, price_area);

create index if not exists idx_gridex_spot_publish_log_created_at
  on public.gridex_spot_basis_publish_log (created_at desc);

create or replace trigger trg_gridex_monthly_spot_prices_updated_at
before update on public.gridex_monthly_spot_prices
for each row execute function public.set_current_timestamp_updated_at();

create or replace function public.gridex_spot_publish_active_basis(
  p_year integer,
  p_month integer,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_count integer;
  v_previous_year integer;
  v_previous_month integer;
begin
  if p_year is null or p_year < 2000 or p_year > 2100 or p_month is null or p_month < 1 or p_month > 12 then
    raise exception 'Invalid year/month';
  end if;

  select count(*)
  into v_existing_count
  from public.gridex_monthly_spot_prices
  where year = p_year
    and month = p_month
    and price_area in ('SE1', 'SE2', 'SE3', 'SE4');

  if v_existing_count < 4 then
    raise exception 'Cannot publish spot basis %.%: all 4 price areas are required', p_year, p_month;
  end if;

  select active_year, active_month
  into v_previous_year, v_previous_month
  from public.gridex_spot_basis_config
  where id = 1;

  insert into public.gridex_spot_basis_config (id, active_year, active_month, updated_by)
  values (1, p_year, p_month, auth.uid())
  on conflict (id) do update set
    active_year = excluded.active_year,
    active_month = excluded.active_month,
    updated_by = excluded.updated_by,
    updated_at = timezone('utc', now());

  insert into public.gridex_spot_basis_publish_log (
    action,
    active_year,
    active_month,
    previous_year,
    previous_month,
    reason,
    created_by
  ) values (
    'publish',
    p_year,
    p_month,
    v_previous_year,
    v_previous_month,
    p_reason,
    auth.uid()
  );
end;
$$;

create or replace function public.gridex_spot_rollback_last_publish(
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_year integer;
  v_target_month integer;
  v_current_year integer;
  v_current_month integer;
begin
  select active_year, active_month
  into v_current_year, v_current_month
  from public.gridex_spot_basis_config
  where id = 1;

  select active_year, active_month
  into v_target_year, v_target_month
  from public.gridex_spot_basis_publish_log
  where action = 'publish'
  order by created_at desc
  offset 1
  limit 1;

  if v_target_year is null or v_target_month is null then
    raise exception 'No previous spot publish entry exists';
  end if;

  update public.gridex_spot_basis_config
  set active_year = v_target_year,
      active_month = v_target_month,
      updated_by = auth.uid(),
      updated_at = timezone('utc', now())
  where id = 1;

  insert into public.gridex_spot_basis_publish_log (
    action,
    active_year,
    active_month,
    previous_year,
    previous_month,
    reason,
    created_by
  ) values (
    'rollback',
    v_target_year,
    v_target_month,
    v_current_year,
    v_current_month,
    p_reason,
    auth.uid()
  );
end;
$$;
insert into public.external_provider_catalog (
  provider_key,
  provider_name,
  domain,
  capabilities,
  documentation_url
)
values
  (
    'elprisetjustnu',
    'Elpriset Just Nu',
    'market_prices',
    '["spot.daily.read", "spot.monthly_average.import"]'::jsonb,
    'https://www.elprisetjustnu.se/elpris-api'
  ),
  (
    'cis_invoice_webhook',
    'CIS Invoice Webhook',
    'billing',
    '["invoice.webhook", "invoice.upsert", "customer.match"]'::jsonb,
    null
  )
on conflict (provider_key) do update
set provider_name = excluded.provider_name,
    domain = excluded.domain,
    capabilities = excluded.capabilities,
    documentation_url = excluded.documentation_url;
