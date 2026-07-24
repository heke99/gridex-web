begin;

alter table if exists public.website_price_area_resolutions
  add column if not exists ops_resolution_id text;

update public.website_price_area_resolutions
set ops_resolution_id = coalesce(ops_resolution_id, ops_resolution_reference)
where ops_resolution_id is null
  and ops_resolution_reference is not null;

create unique index if not exists website_price_area_resolutions_ops_resolution_id_uidx
  on public.website_price_area_resolutions(ops_resolution_id)
  where ops_resolution_id is not null;

comment on column public.website_price_area_resolutions.ops_resolution_id is
  'Canonical opaque resolution_id returned by POST /api/v1/website/energy-area/resolve.';

commit;
