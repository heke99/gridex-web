begin;

-- Empty publication feeds are authorized by the durably recorded tenant/channel
-- publication revision. The free-text reason is deliberately not interpreted as
-- an enum because the public webhook contract defines it as an extensible string.
create or replace function public.store_website_public_contract_snapshot(
  p_cache_key text,
  p_tenant_reference text,
  p_customer_type text,
  p_publication_revision bigint,
  p_contract_version text,
  p_parser_version text,
  p_schema_sha256 text,
  p_etag text,
  p_snapshot jsonb,
  p_accepted_count integer,
  p_blocked_count integer,
  p_upstream_count integer,
  p_fetched_at timestamptz
)
returns table (
  result text,
  stored boolean,
  empty_authorized boolean,
  stored_revision bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.website_public_contract_snapshots%rowtype;
  v_publication_revision bigint;
  v_candidate_empty boolean;
  v_empty_authorized boolean := false;
  v_existing_found boolean := false;
begin
  if
    nullif(trim(p_cache_key), '') is null
    or nullif(trim(p_tenant_reference), '') is null
    or p_customer_type not in ('all', 'private', 'business')
    or p_publication_revision is null
    or nullif(trim(p_contract_version), '') is null
    or nullif(trim(p_parser_version), '') is null
    or nullif(trim(p_schema_sha256), '') is null
    or p_snapshot is null
    or jsonb_typeof(p_snapshot) <> 'object'
    or p_snapshot ->> 'tenant_reference' is distinct from p_tenant_reference
    or p_snapshot ->> 'contract_version' is distinct from p_contract_version
    or p_snapshot -> 'publication_revision' is distinct from to_jsonb(p_publication_revision)
    or p_accepted_count is null
    or p_blocked_count is null
    or p_upstream_count is null
    or p_accepted_count < 0
    or p_blocked_count < 0
    or p_upstream_count <> p_accepted_count + p_blocked_count
    or p_fetched_at is null
  then
    raise exception 'Canonical website public-contract snapshot arguments are incomplete.';
  end if;

  if
    jsonb_typeof(p_snapshot -> 'contracts') <> 'array'
    or jsonb_typeof(p_snapshot -> 'blocked_contracts') <> 'array'
    or jsonb_array_length(p_snapshot -> 'contracts') <> p_accepted_count
    or jsonb_array_length(p_snapshot -> 'blocked_contracts') <> p_blocked_count
  then
    raise exception 'Canonical website public-contract snapshot counts do not match its payload.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_cache_key, 0));

  select *
    into v_existing
    from public.website_public_contract_snapshots
   where cache_key = p_cache_key
   for update;
  v_existing_found := found;

  if v_existing_found and (
    v_existing.tenant_reference <> p_tenant_reference
    or v_existing.customer_type <> p_customer_type
    or v_existing.channel <> 'website'
  ) then
    raise exception 'Public-contract snapshot cache key is already bound to another tenant or customer type.';
  end if;

  select publication_revision
    into v_publication_revision
    from public.ops_publication_state
   where tenant_reference = p_tenant_reference
     and channel = 'website'
   for share;

  if
    v_publication_revision is not null
    and p_publication_revision < v_publication_revision
  then
    return query select
      'rejected_older_than_publication_state'::text,
      false,
      false,
      coalesce(v_existing.publication_revision, v_publication_revision);
    return;
  end if;

  if v_existing_found and v_existing.publication_revision is not null and p_publication_revision < v_existing.publication_revision then
    return query select
      'rejected_older_than_stored_snapshot'::text,
      false,
      false,
      v_existing.publication_revision;
    return;
  end if;

  v_candidate_empty := p_accepted_count = 0;
  v_empty_authorized :=
    v_candidate_empty
    and p_upstream_count = 0
    and v_publication_revision is not null
    and v_publication_revision = p_publication_revision;

  if v_candidate_empty and not v_empty_authorized then
    return query select
      'rejected_empty_without_verified_unpublish'::text,
      false,
      false,
      coalesce(v_existing.publication_revision, v_publication_revision);
    return;
  end if;

  insert into public.website_public_contract_snapshots (
    cache_key,
    tenant_reference,
    channel,
    customer_type,
    publication_revision,
    contract_version,
    parser_version,
    schema_sha256,
    etag,
    snapshot,
    accepted_count,
    blocked_count,
    upstream_count,
    fetched_at,
    updated_at
  ) values (
    p_cache_key,
    p_tenant_reference,
    'website',
    p_customer_type,
    p_publication_revision,
    p_contract_version,
    p_parser_version,
    p_schema_sha256,
    p_etag,
    p_snapshot,
    p_accepted_count,
    p_blocked_count,
    p_upstream_count,
    p_fetched_at,
    now()
  )
  on conflict (cache_key)
  do update set
    tenant_reference = excluded.tenant_reference,
    channel = excluded.channel,
    customer_type = excluded.customer_type,
    publication_revision = excluded.publication_revision,
    contract_version = excluded.contract_version,
    parser_version = excluded.parser_version,
    schema_sha256 = excluded.schema_sha256,
    etag = excluded.etag,
    snapshot = excluded.snapshot,
    accepted_count = excluded.accepted_count,
    blocked_count = excluded.blocked_count,
    upstream_count = excluded.upstream_count,
    fetched_at = excluded.fetched_at,
    updated_at = now();

  return query select
    case when v_candidate_empty then 'stored_verified_empty' else 'stored' end::text,
    true,
    v_empty_authorized,
    p_publication_revision;
end;
$$;

revoke all on function public.store_website_public_contract_snapshot(
  text, text, text, bigint, text, text, text, text, jsonb, integer, integer, integer, timestamptz
) from public, anon, authenticated;
grant execute on function public.store_website_public_contract_snapshot(
  text, text, text, bigint, text, text, text, text, jsonb, integer, integer, integer, timestamptz
) to service_role;

commit;
