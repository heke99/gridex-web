-- LOCAL ONLY: pricing tables and exact production trigger definitions.
-- Load independent-web-fixture.sql and its security migration first.
create table public.contract_products (
  id uuid primary key default gen_random_uuid(), name text not null,
  slug text not null unique, contract_type text not null check(contract_type in ('spot_hourly','portfolio_managed')),
  is_active boolean default true, created_at timestamptz default now(),
  created_by uuid references auth.users(id), short_description text, badge_text text,
  sort_order integer default 0, is_featured boolean default false
);
create table public.contract_pricing_versions (
  id uuid primary key default gen_random_uuid(), contract_id uuid references public.contract_products(id),
  version_number integer not null, valid_from date not null, created_at timestamptz default now(),
  is_published boolean default false, status text not null default 'draft' check(status in ('draft','published')),
  published_at timestamptz, unique(contract_id,version_number)
);
create table public.contract_area_pricing (
  id uuid primary key default gen_random_uuid(), pricing_version_id uuid references public.contract_pricing_versions(id),
  price_area text not null check(price_area in ('SE1','SE2','SE3','SE4')),
  price_per_kwh_ore numeric, markup_ore numeric, monthly_fee_sek numeric not null default 0,
  created_at timestamptz default now(), variable_fee_ore numeric not null default 0,
  elcert_ore numeric not null default 0, unique(pricing_version_id,price_area)
);
create table public.pricing_version_audit (
  id uuid primary key default gen_random_uuid(), contract_id uuid not null, version_id uuid not null,
  action text not null, performed_by uuid not null, performed_at timestamptz default now(),
  reason text, created_at timestamptz default now()
);
create function public.enforce_full_area_pricing() returns trigger language plpgsql set search_path to public,auth,extensions as $$
begin
  if new.status='published' then
    if (select count(*) from contract_area_pricing where pricing_version_id=new.id)<4 then
      raise exception 'Cannot publish: Missing SE1–SE4 pricing';
    end if;
  end if;
  return new;
end;
$$;
create function public.enforce_single_published_version() returns trigger language plpgsql set search_path to public,auth,extensions as $$
begin
  if new.status='published' then
    update contract_pricing_versions set status='draft',is_published=false where contract_id=new.contract_id and id<>new.id;
  end if;
  return new;
end;
$$;
create function public.gridex_sync_pricing_version_flags() returns trigger language plpgsql set search_path to public,auth,extensions as $$
begin
  if new.status='published' then
    new.is_published:=true;
    if tg_op='INSERT' or old.status is distinct from 'published' then new.published_at:=now(); end if;
  else
    new.is_published:=false;
    new.published_at:=null;
  end if;
  return new;
end;
$$;
create trigger check_area_pricing_before_publish before update on public.contract_pricing_versions for each row execute function public.enforce_full_area_pricing();
create trigger sync_publish_versions before update on public.contract_pricing_versions for each row execute function public.enforce_single_published_version();
create trigger trg_gridex_sync_pricing_version_flags before insert or update of status,is_published on public.contract_pricing_versions for each row execute function public.gridex_sync_pricing_version_flags();
grant all on public.contract_products,public.contract_pricing_versions,public.contract_area_pricing,public.pricing_version_audit to anon,authenticated,service_role;
-- Reproduce old permissive policies and a column grant: the migration must
-- eliminate both, even where permissive policies would otherwise be ORed.
alter table public.contract_products enable row level security;
alter table public.contract_pricing_versions enable row level security;
alter table public.contract_area_pricing enable row level security;
alter table public.pricing_version_audit enable row level security;
create policy legacy_any_product on public.contract_products for all to authenticated using(true) with check(true);
create policy legacy_any_version on public.contract_pricing_versions for all to authenticated using(true) with check(true);
create policy legacy_public_draft on public.contract_area_pricing for select to anon,authenticated using(true);
create policy legacy_any_area on public.contract_area_pricing for all to authenticated using(true) with check(true);
create policy legacy_any_audit on public.pricing_version_audit for all to authenticated using(true) with check(true);
grant update(status) on public.contract_pricing_versions to authenticated;
