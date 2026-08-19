-- Expand Gridex Web durable OPS state to the canonical 2026-08-19.2 organization identity.
-- This migration is intentionally additive: legacy tenant_reference columns stay in place
-- for rollback compatibility while all new application writes use organization_reference.

alter table public.website_public_contract_snapshots
  add column if not exists organization_reference text;

alter table public.ops_publication_state
  add column if not exists organization_reference text;

alter table public.ops_webhook_events
  add column if not exists organization_reference text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'website_public_contract_snapshots_organization_reference_check'
      and conrelid = 'public.website_public_contract_snapshots'::regclass
  ) then
    alter table public.website_public_contract_snapshots
      add constraint website_public_contract_snapshots_organization_reference_check
      check (
        organization_reference is null
        or organization_reference ~ '^organization_[A-Za-z0-9_-]{20,64}$'
      ) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ops_publication_state_organization_reference_check'
      and conrelid = 'public.ops_publication_state'::regclass
  ) then
    alter table public.ops_publication_state
      add constraint ops_publication_state_organization_reference_check
      check (
        organization_reference is null
        or organization_reference ~ '^organization_[A-Za-z0-9_-]{20,64}$'
      ) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ops_webhook_events_organization_reference_check'
      and conrelid = 'public.ops_webhook_events'::regclass
  ) then
    alter table public.ops_webhook_events
      add constraint ops_webhook_events_organization_reference_check
      check (
        organization_reference is null
        or organization_reference ~ '^organization_[A-Za-z0-9_-]{20,64}$'
      ) not valid;
  end if;
end
$$;

create unique index if not exists ops_publication_state_organization_channel_uidx
  on public.ops_publication_state (organization_reference, channel)
  where organization_reference is not null;

create index if not exists website_public_contract_snapshots_organization_lookup_idx
  on public.website_public_contract_snapshots (organization_reference, channel, customer_type)
  where organization_reference is not null;

create index if not exists ops_webhook_events_organization_received_idx
  on public.ops_webhook_events (organization_reference, received_at desc)
  where organization_reference is not null;

create or replace function public.store_website_public_contract_snapshot_v2(
  p_cache_key text,
  p_organization_reference text,
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
returns table(
  result text,
  stored boolean,
  empty_authorized boolean,
  stored_revision bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_existing public.website_public_contract_snapshots%rowtype;
  v_local_revision bigint;
  v_existing_found boolean := false;
  v_empty_authorized boolean := false;
  v_authorization_revision bigint;
  v_authorization_reason text;
begin
  if
    nullif(trim(p_cache_key), '') is null
    or p_organization_reference !~ '^organization_[A-Za-z0-9_-]{20,64}$'
    or p_customer_type not in ('all', 'private', 'business')
    or p_publication_revision is null
    or p_publication_revision < 0
    or nullif(trim(p_contract_version), '') is null
    or nullif(trim(p_parser_version), '') is null
    or p_schema_sha256 !~ '^[0-9a-f]{64}$'
    or p_snapshot is null
    or jsonb_typeof(p_snapshot) <> 'object'
    or p_snapshot ->> 'organization_reference' is distinct from p_organization_reference
    or p_snapshot ->> 'contract_version' is distinct from p_contract_version
    or p_snapshot -> 'publication_revision' is distinct from to_jsonb(p_publication_revision)
    or p_snapshot ->> 'feed_state' is distinct from p_feed_state
    or (
      p_empty_feed_authorization is null
      and coalesce(p_snapshot -> 'empty_feed_authorization', 'null'::jsonb) <> 'null'::jsonb
    )
    or (
      p_empty_feed_authorization is not null
      and p_snapshot -> 'empty_feed_authorization' is distinct from p_empty_feed_authorization
    )
    or p_accepted_count is null
    or p_blocked_count is null
    or p_upstream_count is null
    or p_accepted_count < 0
    or p_blocked_count < 0
    or p_upstream_count <> p_accepted_count + p_blocked_count
    or p_fetched_at is null
  then
    raise exception using errcode = '22023',
      message = 'CANONICAL_WEBSITE_PUBLIC_CONTRACT_SNAPSHOT_ARGUMENTS_INVALID';
  end if;

  if
    jsonb_typeof(p_snapshot -> 'contracts') <> 'array'
    or jsonb_typeof(p_snapshot -> 'blocked_contracts') <> 'array'
    or jsonb_array_length(p_snapshot -> 'contracts') <> p_accepted_count
    or jsonb_array_length(p_snapshot -> 'blocked_contracts') <> p_blocked_count
  then
    raise exception using errcode = '22023',
      message = 'CANONICAL_WEBSITE_PUBLIC_CONTRACT_SNAPSHOT_COUNTS_INVALID';
  end if;

  if p_feed_state = 'contracts_present' then
    if p_accepted_count <= 0 or p_upstream_count <= 0 or p_empty_feed_authorization is not null then
      raise exception using errcode = '22023',
        message = 'CONTRACTS_PRESENT_SNAPSHOT_INVALID';
    end if;
  elsif p_feed_state = 'canonical_empty' then
    if
      p_accepted_count <> 0
      or p_blocked_count <> 0
      or p_upstream_count <> 0
      or jsonb_typeof(p_empty_feed_authorization) <> 'object'
      or p_empty_feed_authorization -> 'authorized' is distinct from 'true'::jsonb
      or p_empty_feed_authorization ->> 'canonical_source' is distinct from 'canonical_public_contract_delivery_readiness_v'
      or jsonb_typeof(p_empty_feed_authorization -> 'affected_offer_references') <> 'array'
      or jsonb_typeof(p_empty_feed_authorization -> 'blockers') <> 'array'
      or (p_empty_feed_authorization - array[
        'authorized', 'reason', 'publication_revision', 'canonical_source',
        'affected_offer_references', 'blockers'
      ]::text[]) <> '{}'::jsonb
    then
      raise exception using errcode = '22023',
        message = 'CANONICAL_EMPTY_SNAPSHOT_PROOF_INVALID';
    end if;

    begin
      v_authorization_revision := (p_empty_feed_authorization ->> 'publication_revision')::bigint;
    exception when others then
      raise exception using errcode = '22023',
        message = 'CANONICAL_EMPTY_SNAPSHOT_REVISION_INVALID';
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
      raise exception using errcode = '22023',
        message = 'CANONICAL_EMPTY_SNAPSHOT_PROOF_MISMATCH';
    end if;
    v_empty_authorized := true;
  else
    raise exception using errcode = '22023',
      message = 'CANONICAL_PUBLIC_CONTRACT_FEED_STATE_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_cache_key, 0));

  select publication_revision
    into v_local_revision
    from public.ops_publication_state
   where organization_reference = p_organization_reference
     and channel = 'website'
   for update;

  if v_local_revision is not null and p_publication_revision < v_local_revision then
    return query select
      'rejected_older_than_local_publication_state'::text,
      false,
      false,
      v_local_revision;
    return;
  end if;

  if v_local_revision is null or p_publication_revision > v_local_revision then
    insert into public.ops_publication_state (
      tenant_reference,
      organization_reference,
      channel,
      publication_revision,
      changed_at,
      updated_at
    ) values (
      p_organization_reference,
      p_organization_reference,
      'website',
      p_publication_revision,
      p_fetched_at,
      now()
    )
    on conflict (tenant_reference, channel)
    do update set
      organization_reference = excluded.organization_reference,
      publication_revision = excluded.publication_revision,
      changed_at = excluded.changed_at,
      updated_at = now()
    where excluded.publication_revision >= public.ops_publication_state.publication_revision;
    v_local_revision := p_publication_revision;
  end if;

  select *
    into v_existing
    from public.website_public_contract_snapshots
   where cache_key = p_cache_key
   for update;
  v_existing_found := found;

  if
    v_existing_found
    and v_existing.organization_reference is not null
    and v_existing.organization_reference <> p_organization_reference
  then
    raise exception using errcode = '23505',
      message = 'PUBLIC_CONTRACT_SNAPSHOT_CACHE_KEY_ORGANIZATION_CONFLICT';
  end if;

  if
    v_existing_found
    and v_existing.publication_revision > p_publication_revision
  then
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
    organization_reference,
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
    p_organization_reference,
    p_organization_reference,
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
    organization_reference = excluded.organization_reference,
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
    case when p_feed_state = 'canonical_empty'
      then 'stored_canonical_empty'
      else 'stored'
    end::text,
    true,
    v_empty_authorized,
    p_publication_revision;
end;
$$;

revoke all on function public.store_website_public_contract_snapshot_v2(
  text, text, text, bigint, text, text, text, text, jsonb,
  integer, integer, integer, text, jsonb, timestamptz
) from public, anon, authenticated;
grant execute on function public.store_website_public_contract_snapshot_v2(
  text, text, text, bigint, text, text, text, text, jsonb,
  integer, integer, integer, text, jsonb, timestamptz
) to service_role;

create or replace function public.apply_ops_publication_event_v2(
  p_event_id text,
  p_delivery_id text,
  p_organization_reference text,
  p_channel text,
  p_publication_revision bigint,
  p_revision_token text,
  p_publication_reason text,
  p_event_timestamp timestamptz,
  p_created_at timestamptz,
  p_aggregate_id text,
  p_payload_hash text,
  p_payload jsonb
)
returns table(
  result text,
  cache_invalidated boolean,
  stored_revision bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_existing public.ops_webhook_events%rowtype;
  v_current_revision bigint;
  v_event_row_id uuid;
begin
  if
    nullif(trim(p_event_id), '') is null
    or nullif(trim(p_delivery_id), '') is null
    or p_organization_reference !~ '^organization_[A-Za-z0-9_-]{20,64}$'
    or p_publication_revision is null
    or nullif(trim(p_revision_token), '') is null
    or p_event_timestamp is null
    or p_created_at is null
  then
    raise exception using errcode = '22023',
      message = 'CANONICAL_PUBLICATION_WEBHOOK_ARGUMENTS_INVALID';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_organization_reference || ':' || p_channel, 0)
  );

  select *
    into v_existing
    from public.ops_webhook_events
   where event_id = p_event_id
      or delivery_id = p_delivery_id
   order by received_at asc
   limit 1
   for update;

  if found then
    if
      v_existing.event_id = p_event_id
      and v_existing.delivery_id = p_delivery_id
      and v_existing.payload_hash = p_payload_hash
    then
      return query select 'duplicate'::text, false, v_existing.publication_revision;
    else
      return query select 'identifier_conflict'::text, false, v_existing.publication_revision;
    end if;
    return;
  end if;

  insert into public.ops_webhook_events (
    event_id,
    event_type,
    delivery_id,
    header_event_id,
    tenant_reference,
    organization_reference,
    channel,
    publication_revision,
    revision_token,
    publication_reason,
    aggregate_id,
    event_timestamp,
    occurred_at,
    status,
    signature_valid,
    payload_hash,
    payload,
    attempt_count,
    last_attempt_at
  )
  values (
    p_event_id,
    'contracts.publication.changed',
    p_delivery_id,
    p_event_id,
    p_organization_reference,
    p_organization_reference,
    p_channel,
    p_publication_revision,
    p_revision_token,
    p_publication_reason,
    p_aggregate_id,
    p_event_timestamp,
    p_created_at,
    'processing',
    true,
    p_payload_hash,
    p_payload,
    1,
    now()
  )
  returning id into v_event_row_id;

  if p_channel <> 'website' then
    update public.ops_webhook_events
       set status = 'processed',
           processed_at = now(),
           handling_note = 'ignored_non_website_channel'
     where id = v_event_row_id;
    return query select 'ignored'::text, false, p_publication_revision;
    return;
  end if;

  select publication_revision
    into v_current_revision
    from public.ops_publication_state
   where organization_reference = p_organization_reference
     and channel = p_channel
   for update;

  if found and v_current_revision is not null and p_publication_revision <= v_current_revision then
    update public.ops_webhook_events
       set status = 'processed',
           processed_at = now(),
           handling_note = 'publication_event_ignored_as_stale'
     where id = v_event_row_id;
    return query select 'stale'::text, false, v_current_revision;
    return;
  end if;

  insert into public.ops_publication_state (
    tenant_reference,
    organization_reference,
    channel,
    publication_revision,
    revision_token,
    delivery_id,
    etag,
    event_id,
    event_timestamp,
    publication_reason,
    changed_at,
    updated_at
  )
  values (
    p_organization_reference,
    p_organization_reference,
    p_channel,
    p_publication_revision,
    p_revision_token,
    p_delivery_id,
    null,
    p_event_id,
    p_event_timestamp,
    p_publication_reason,
    p_event_timestamp,
    now()
  )
  on conflict (tenant_reference, channel)
  do update set
    organization_reference = excluded.organization_reference,
    publication_revision = excluded.publication_revision,
    revision_token = excluded.revision_token,
    delivery_id = excluded.delivery_id,
    etag = excluded.etag,
    event_id = excluded.event_id,
    event_timestamp = excluded.event_timestamp,
    publication_reason = excluded.publication_reason,
    changed_at = excluded.changed_at,
    updated_at = excluded.updated_at;

  update public.ops_webhook_events
     set status = 'processed',
         processed_at = now(),
         handling_note = 'publication_state_updated'
   where id = v_event_row_id;

  return query select 'applied'::text, true, p_publication_revision;
end;
$$;

revoke all on function public.apply_ops_publication_event_v2(
  text, text, text, text, bigint, text, text, timestamptz, timestamptz, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.apply_ops_publication_event_v2(
  text, text, text, text, bigint, text, text, timestamptz, timestamptz, text, text, jsonb
) to service_role;
