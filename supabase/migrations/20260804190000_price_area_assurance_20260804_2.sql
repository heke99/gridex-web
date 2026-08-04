begin;

alter table public.website_price_area_resolutions
  add column if not exists assurance_source text,
  add column if not exists assurance_candidate_count integer,
  add column if not exists assurance_unique_price_area_count integer,
  add column if not exists assurance_source_version text,
  add column if not exists assurance_evidence jsonb not null default '{}'::jsonb;

update public.website_price_area_resolutions
set assurance_level = case assurance_level
  when 'sufficient_for_application' then 'verified'
  when 'indicative_only' then 'unresolved'
  else assurance_level
end
where assurance_level in ('sufficient_for_application', 'indicative_only');

alter table public.website_price_area_resolutions
  drop constraint if exists website_price_area_resolutions_assurance_level_check;

alter table public.website_price_area_resolutions
  add constraint website_price_area_resolutions_assurance_level_check
  check (assurance_level in ('verified', 'estimated', 'ambiguous', 'unresolved'));

alter table public.website_price_area_resolutions
  drop constraint if exists website_price_area_resolutions_assurance_candidate_count_check,
  add constraint website_price_area_resolutions_assurance_candidate_count_check
    check (assurance_candidate_count is null or assurance_candidate_count >= 0),
  drop constraint if exists website_price_area_resolutions_assurance_unique_price_area_count_check,
  add constraint website_price_area_resolutions_assurance_unique_price_area_count_check
    check (assurance_unique_price_area_count is null or assurance_unique_price_area_count >= 0);

comment on column public.website_price_area_resolutions.assurance_level is
  'Canonical price_area_assurance.status from Gridex Website Integration API 2026-08-04.2.';
comment on column public.website_price_area_resolutions.assurance_source is
  'Canonical price_area_assurance.source; proves pricing evidence only, never EDIFACT readiness.';
comment on column public.website_price_area_resolutions.assurance_evidence is
  'Canonical price-area evidence snapshot used for audit and support.';

commit;
