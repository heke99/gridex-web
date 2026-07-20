-- Harden website postal-code -> electricity-area persistence.
-- This migration is deliberately idempotent so environments that missed the
-- original cache migration can be repaired safely.

create table if not exists public.website_postal_code_price_areas (
  postal_code text primary key,
  city text,
  latitude numeric,
  longitude numeric,
  grid_area_code text,
  price_area_code text,
  confidence numeric not null default 0.85,
  source text not null default 'papilite_arcgis',
  source_chain jsonb not null default '[]'::jsonb,
  raw_response jsonb not null default '{}'::jsonb,
  used_for text not null default 'pricing_preview_only',
  is_active boolean not null default true,
  looked_up_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.website_postal_code_price_areas
  add column if not exists city text,
  add column if not exists latitude numeric,
  add column if not exists longitude numeric,
  add column if not exists grid_area_code text,
  add column if not exists price_area_code text,
  add column if not exists confidence numeric not null default 0.85,
  add column if not exists source text not null default 'papilite_arcgis',
  add column if not exists source_chain jsonb not null default '[]'::jsonb,
  add column if not exists raw_response jsonb not null default '{}'::jsonb,
  add column if not exists used_for text not null default 'pricing_preview_only',
  add column if not exists is_active boolean not null default true,
  add column if not exists looked_up_at timestamptz not null default now(),
  add column if not exists expires_at timestamptz not null default (now() + interval '30 days'),
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.website_price_area_lookup_cache (
  id uuid primary key default gen_random_uuid(),
  postal_code text not null,
  city text,
  grid_area_code text,
  price_area_code text,
  lookup_status text not null default 'pending',
  confidence numeric,
  source text,
  source_chain jsonb not null default '[]'::jsonb,
  raw_response jsonb not null default '{}'::jsonb,
  error_message text,
  used_for text not null default 'pricing_preview_only',
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.website_price_area_lookup_cache
  add column if not exists postal_code text,
  add column if not exists city text,
  add column if not exists grid_area_code text,
  add column if not exists price_area_code text,
  add column if not exists lookup_status text not null default 'pending',
  add column if not exists confidence numeric,
  add column if not exists source text,
  add column if not exists source_chain jsonb not null default '[]'::jsonb,
  add column if not exists raw_response jsonb not null default '{}'::jsonb,
  add column if not exists error_message text,
  add column if not exists used_for text not null default 'pricing_preview_only',
  add column if not exists expires_at timestamptz,
  add column if not exists created_at timestamptz not null default now();

-- Repair invalid legacy rows before adding validation constraints.
with ranked as (
  select
    ctid,
    row_number() over (
      partition by regexp_replace(postal_code, '\s+', '', 'g')
      order by updated_at desc nulls last, created_at desc nulls last, ctid desc
    ) as row_number
  from public.website_postal_code_price_areas
  where postal_code is not null
)
delete from public.website_postal_code_price_areas target
using ranked
where target.ctid = ranked.ctid
  and ranked.row_number > 1;

update public.website_postal_code_price_areas
set postal_code = regexp_replace(postal_code, '\s+', '', 'g')
where postal_code is not null and postal_code <> regexp_replace(postal_code, '\s+', '', 'g');

delete from public.website_postal_code_price_areas
where postal_code is null or postal_code !~ '^\d{5}$';

update public.website_price_area_lookup_cache
set postal_code = regexp_replace(postal_code, '\s+', '', 'g')
where postal_code is not null and postal_code <> regexp_replace(postal_code, '\s+', '', 'g');

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.website_postal_code_price_areas'::regclass
      and conname = 'website_postal_code_price_areas_postal_code_check'
  ) then
    alter table public.website_postal_code_price_areas
      add constraint website_postal_code_price_areas_postal_code_check
      check (postal_code ~ '^\d{5}$') not valid;
    alter table public.website_postal_code_price_areas
      validate constraint website_postal_code_price_areas_postal_code_check;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.website_postal_code_price_areas'::regclass
      and conname = 'website_postal_code_price_areas_price_area_check'
  ) then
    alter table public.website_postal_code_price_areas
      add constraint website_postal_code_price_areas_price_area_check
      check (price_area_code in ('SE1','SE2','SE3','SE4')) not valid;
  end if;
end $$;

create index if not exists website_postal_code_price_areas_active_idx
  on public.website_postal_code_price_areas (postal_code, is_active, expires_at);

create index if not exists website_price_area_lookup_cache_postal_idx
  on public.website_price_area_lookup_cache (postal_code, created_at desc);

alter table public.website_postal_code_price_areas enable row level security;
alter table public.website_price_area_lookup_cache enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'website_postal_code_price_areas'
      and policyname = 'service_role_manage_website_postal_code_price_areas'
  ) then
    create policy service_role_manage_website_postal_code_price_areas
      on public.website_postal_code_price_areas
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'website_price_area_lookup_cache'
      and policyname = 'service_role_manage_website_price_area_lookup_cache'
  ) then
    create policy service_role_manage_website_price_area_lookup_cache
      on public.website_price_area_lookup_cache
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;
