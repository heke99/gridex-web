begin;

alter table public.website_public_contract_snapshots
  add column if not exists feed_state text,
  add column if not exists empty_feed_authorization jsonb;

-- Pre-2026-08-02 empty rows do not contain the canonical proof required by the
-- new API contract and must never be promoted into the new durable cache.
delete from public.website_public_contract_snapshots
 where upstream_count = 0;

update public.website_public_contract_snapshots
   set feed_state = 'contracts_present',
       empty_feed_authorization = null
 where feed_state is null;

alter table public.website_public_contract_snapshots
  alter column feed_state set not null;

alter table public.website_public_contract_snapshots
  drop constraint if exists website_public_contract_snapshots_feed_state_check;

alter table public.website_public_contract_snapshots
  add constraint website_public_contract_snapshots_feed_state_check
  check (
    (
      feed_state = 'contracts_present'
      and accepted_count > 0
      and upstream_count > 0
      and upstream_count = accepted_count + blocked_count
      and empty_feed_authorization is null
    )
    or
    (
      feed_state = 'canonical_empty'
      and accepted_count = 0
      and blocked_count = 0
      and upstream_count = 0
      and jsonb_typeof(empty_feed_authorization) = 'object'
      and empty_feed_authorization -> 'authorized' = 'true'::jsonb
      and empty_feed_authorization ->> 'reason' in (
        'no_canonical_publications',
        'canonical_unpublished_or_archived',
        'publication_validity_ended',
        'canonical_no_visible_contracts'
      )
      and empty_feed_authorization -> 'publication_revision' = to_jsonb(publication_revision)
      and empty_feed_authorization ->> 'canonical_source' = 'canonical_public_contract_delivery_readiness_v'
      and jsonb_typeof(empty_feed_authorization -> 'affected_offer_references') = 'array'
      and jsonb_typeof(empty_feed_authorization -> 'blockers') = 'array'
      and not jsonb_path_exists(
        empty_feed_authorization,
        '$.affected_offer_references[*] ? (@.type() != "string")'
      )
      and not jsonb_path_exists(
        empty_feed_authorization,
        '$.blockers[*] ? (@.type() != "string")'
      )
      and (empty_feed_authorization - array[
        'authorized',
        'reason',
        'publication_revision',
        'canonical_source',
        'affected_offer_references',
        'blockers'
      ]::text[]) = '{}'::jsonb
    )
  );

comment on column public.website_public_contract_snapshots.feed_state is
  'Canonical OPS public-contract feed state from contract version 2026-08-02.1 or later.';
comment on column public.website_public_contract_snapshots.empty_feed_authorization is
  'Exact authenticated OPS proof required before a durable visible snapshot may be replaced with an empty feed.';

-- Remove the legacy signature so PostgREST cannot accidentally route callers
-- around the canonical empty-feed proof parameters.
drop function if exists public.store_website_public_contract_snapshot(
  text, text, text, bigint, text, text, text, text, jsonb, integer, integer, integer, timestamptz
);

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
  p_feed_state text,
  p_empty_feed_authorization jsonb,
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
  v_existing_found boolean := false;
  v_empty_authorized boolean := false;
  v_authorization_revision bigint;
  v_authorization_reason text;
begin
  if
    nullif(trim(p_cache_key), '') is null
    or nullif(trim(p_tenant_reference), '') is null
    or p_customer_type not in ('all', 'private', 'business')
    or p_publication_revision is null
    or p_publication_revision < 0
    or nullif(trim(p_contract_version), '') is null
    or nullif(trim(p_parser_version), '') is null
    or nullif(trim(p_schema_sha256), '') is null
    or p_snapshot is null
    or jsonb_typeof(p_snapshot) <> 'object'
    or p_snapshot ->> 'tenant_reference' is distinct from p_tenant_reference
    or p_snapshot ->> 'contract_version' is distinct from p_contract_version
    or p_snapshot -> 'publication_revision' is distinct from to_jsonb(p_publication_revision)
    or p_snapshot ->> 'feed_state' is distinct from p_feed_state
    or p_snapshot -> 'empty_feed_authorization' is distinct from p_empty_feed_authorization
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

  if p_feed_state = 'contracts_present' then
    if
      p_accepted_count <= 0
      or p_upstream_count <= 0
      or p_empty_feed_authorization is not null
    then
      raise exception 'contracts_present requires at least one accepted contract and no empty-feed authorization.';
    end if;
  elsif p_feed_state = 'canonical_empty' then
    if
      p_accepted_count <> 0
      or p_blocked_count <> 0
      or p_upstream_count <> 0
      or p_empty_feed_authorization is null
      or jsonb_typeof(p_empty_feed_authorization) <> 'object'
      or p_empty_feed_authorization -> 'authorized' is distinct from 'true'::jsonb
      or p_empty_feed_authorization ->> 'canonical_source' is distinct from 'canonical_public_contract_delivery_readiness_v'
      or jsonb_typeof(p_empty_feed_authorization -> 'affected_offer_references') <> 'array'
      or jsonb_typeof(p_empty_feed_authorization -> 'blockers') <> 'array'
      or jsonb_path_exists(
        p_empty_feed_authorization,
        '$.affected_offer_references[*] ? (@.type() != "string")'
      )
      or jsonb_path_exists(
        p_empty_feed_authorization,
        '$.blockers[*] ? (@.type() != "string")'
      )
      or (p_empty_feed_authorization - array[
        'authorized',
        'reason',
        'publication_revision',
        'canonical_source',
        'affected_offer_references',
        'blockers'
      ]::text[]) <> '{}'::jsonb
    then
      raise exception 'canonical_empty requires the exact authenticated empty-feed authorization object.';
    end if;

    begin
      v_authorization_revision := (p_empty_feed_authorization ->> 'publication_revision')::bigint;
    exception when others then
      raise exception 'canonical_empty authorization publication_revision is invalid.';
    end;
    v_authorization_reason := p_empty_feed_authorization ->> 'reason';

    if
      v_authorization_revision is distinct from p_publication_revision
      or v_authorization_reason not in (
        'no_canonical_publications',
        'canonical_unpublished_or_archived',
        'publication_validity_ended',
        'canonical_no_visible_contracts'
      )
    then
      raise exception 'canonical_empty authorization does not match the published revision or reason contract.';
    end if;
    v_empty_authorized := true;
  else
    raise exception 'Unknown canonical public-contract feed_state.';
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

  if v_publication_revision is not null and p_publication_revision < v_publication_revision then
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
    feed_state,
    empty_feed_authorization,
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
    p_feed_state,
    p_empty_feed_authorization,
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
    feed_state = excluded.feed_state,
    empty_feed_authorization = excluded.empty_feed_authorization,
    fetched_at = excluded.fetched_at,
    updated_at = now();

  return query select
    case when p_feed_state = 'canonical_empty' then 'stored_canonical_empty' else 'stored' end::text,
    true,
    v_empty_authorized,
    p_publication_revision;
end;
$$;

revoke all on function public.store_website_public_contract_snapshot(
  text, text, text, bigint, text, text, text, text, jsonb, integer, integer, integer, text, jsonb, timestamptz
) from public, anon, authenticated;
grant execute on function public.store_website_public_contract_snapshot(
  text, text, text, bigint, text, text, text, text, jsonb, integer, integer, integer, text, jsonb, timestamptz
) to service_role;

comment on function public.store_website_public_contract_snapshot(
  text, text, text, bigint, text, text, text, text, jsonb, integer, integer, integer, text, jsonb, timestamptz
) is 'Stores only canonical non-empty feeds or explicitly authorized canonical_empty feeds from Gridex API 2026-08-02.1+.';

commit;
