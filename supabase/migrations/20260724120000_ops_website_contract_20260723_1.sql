begin;

-- Canonical OPS energy-area evidence. All writes are service-role only.
alter table public.website_price_area_resolutions
  add column if not exists grid_owner_id text,
  add column if not exists ops_resolution_reference text,
  add column if not exists ops_resolution_status text,
  add column if not exists ops_resolution_payload_sha256 text,
  add column if not exists ops_valid_until timestamptz;

create unique index if not exists website_price_area_resolutions_ops_reference_uidx
  on public.website_price_area_resolutions(ops_resolution_reference)
  where ops_resolution_reference is not null;
create index if not exists website_price_area_resolutions_validity_idx
  on public.website_price_area_resolutions(valid_until, price_area_code);

-- Canonical OPS quote, publication and market evidence.
alter table public.website_pricing_snapshots
  add column if not exists ops_quote_reference text,
  add column if not exists ops_quote_valid_until timestamptz,
  add column if not exists ops_quote_payload_sha256 text,
  add column if not exists ops_quote_validation_status text,
  add column if not exists ops_quote_validated_at timestamptz,
  add column if not exists ops_publication_revision text,
  add column if not exists ops_public_contract_etag text,
  add column if not exists ops_contract_payload_sha256 text;

create unique index if not exists website_pricing_snapshots_ops_quote_reference_uidx
  on public.website_pricing_snapshots(ops_quote_reference)
  where ops_quote_reference is not null;
create index if not exists website_pricing_snapshots_offer_revision_idx
  on public.website_pricing_snapshots(offer_reference, ops_publication_revision, issued_at desc);

-- Durable trace from the accepted browser quote to the OPS application/contract.
alter table public.website_application_submissions
  add column if not exists normalized_ops_payload_sha256 text,
  add column if not exists ops_quote_reference text,
  add column if not exists ops_application_number text,
  add column if not exists ops_contract_id text,
  add column if not exists attempt_count integer not null default 0;

update public.website_application_submissions
set normalized_ops_payload_sha256 = ops_payload_hash
where normalized_ops_payload_sha256 is null and ops_payload_hash is not null;

create index if not exists website_application_submissions_quote_idx
  on public.website_application_submissions(ops_quote_reference, created_at desc)
  where ops_quote_reference is not null;
create index if not exists website_application_submissions_application_number_idx
  on public.website_application_submissions(ops_application_number)
  where ops_application_number is not null;

-- Browser roles must never read or mutate canonical server-side evidence.
alter table public.website_price_area_resolutions enable row level security;
alter table public.market_price_snapshots enable row level security;
alter table public.website_pricing_snapshots enable row level security;
alter table public.website_application_submissions enable row level security;

revoke all on public.website_price_area_resolutions from anon, authenticated;
revoke all on public.market_price_snapshots from anon, authenticated;
revoke all on public.website_pricing_snapshots from anon, authenticated;
revoke all on public.website_application_submissions from anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'website_price_area_resolutions',
    'market_price_snapshots',
    'website_pricing_snapshots',
    'website_application_submissions'
  ] loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = table_name
        and policyname = table_name || '_service_role_all'
    ) then
      execute format(
        'create policy %I on public.%I for all to service_role using (true) with check (true)',
        table_name || '_service_role_all', table_name
      );
    end if;
  end loop;
end $$;

commit;
