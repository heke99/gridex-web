begin;

create function public.gridex_record_website_energy_area_audit(p_record jsonb)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = pg_catalog
as $$
declare
  existing jsonb;
begin
  insert into public.website_price_area_resolutions (
    address_fingerprint, postal_code, price_area_code, grid_area_code,
    grid_owner_id, grid_owner_name, confidence, assurance_level,
    assurance_source, assurance_candidate_count, assurance_unique_price_area_count, assurance_source_version,
    assurance_evidence, source, source_chain, resolver_version,
    resolved_at, valid_until, ops_resolution_id, ops_resolution_reference,
    ops_resolution_status, ops_resolution_payload_sha256, ops_valid_until
  )
  select
    incoming.address_fingerprint, incoming.postal_code, incoming.price_area_code,
    incoming.grid_area_code, incoming.grid_owner_id, incoming.grid_owner_name,
    incoming.confidence, incoming.assurance_level, incoming.assurance_source,
    incoming.assurance_candidate_count, incoming.assurance_unique_price_area_count, incoming.assurance_source_version,
    incoming.assurance_evidence, incoming.source, incoming.source_chain,
    incoming.resolver_version, incoming.resolved_at, incoming.valid_until,
    incoming.ops_resolution_id, incoming.ops_resolution_reference, incoming.ops_resolution_status,
    incoming.ops_resolution_payload_sha256, incoming.ops_valid_until
  from jsonb_populate_record(null::public.website_price_area_resolutions, p_record) as incoming
  on conflict do nothing;

  if found then
    return jsonb_build_object('inserted', true);
  end if;

  -- A separate statement sees the committed winner of a conflicting insert
  -- under PostgREST's default READ COMMITTED isolation.
  select to_jsonb(row_evidence) into existing
  from (
    select
      address_fingerprint, postal_code, price_area_code, grid_area_code,
      resolver_version, ops_resolution_id, ops_resolution_reference, ops_resolution_status,
      grid_owner_name, confidence, assurance_level, assurance_source,
      assurance_candidate_count, assurance_unique_price_area_count, assurance_source_version, assurance_evidence,
      ops_valid_until
    from public.website_price_area_resolutions
    where ops_resolution_reference = p_record->>'ops_resolution_reference'
  ) as row_evidence;

  return jsonb_build_object('inserted', false, 'existing', existing);
end;
$$;

revoke all on function public.gridex_record_website_energy_area_audit(jsonb) from public, anon, authenticated;
grant execute on function public.gridex_record_website_energy_area_audit(jsonb) to service_role;

commit;
