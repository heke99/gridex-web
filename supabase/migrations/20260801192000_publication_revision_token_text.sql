begin;

-- revision_token is an opaque canonical string in the public OpenAPI contract.
-- Convert existing UUID-backed deployments without losing previously stored values.
drop function if exists public.apply_ops_publication_event(
  text, text, text, text, bigint, uuid, text, timestamptz, timestamptz, text, text, jsonb
);

drop function if exists public.apply_ops_publication_event(
  text, text, text, text, bigint, text, text, timestamptz, timestamptz, text, text, jsonb
);

alter table if exists public.ops_webhook_events
  alter column revision_token type text
  using revision_token::text;

alter table if exists public.ops_publication_state
  alter column revision_token type text
  using revision_token::text;

create or replace function public.apply_ops_publication_event(
  p_event_id text,
  p_delivery_id text,
  p_tenant_reference text,
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
returns table (
  result text,
  cache_invalidated boolean,
  stored_revision bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.ops_webhook_events%rowtype;
  v_current_revision bigint;
  v_event_row_id uuid;
begin
  if
    nullif(trim(p_event_id), '') is null
    or nullif(trim(p_delivery_id), '') is null
    or nullif(trim(p_tenant_reference), '') is null
    or p_publication_revision is null
    or nullif(trim(p_revision_token), '') is null
    or p_event_timestamp is null
    or p_created_at is null
  then
    raise exception 'Canonical publication webhook arguments are incomplete.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_tenant_reference || ':' || p_channel, 0)
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
      return query
        select 'duplicate'::text, false, v_existing.publication_revision;
    else
      return query
        select 'identifier_conflict'::text, false, v_existing.publication_revision;
    end if;
    return;
  end if;

  insert into public.ops_webhook_events (
    event_id,
    event_type,
    delivery_id,
    header_event_id,
    tenant_reference,
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
    p_tenant_reference,
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
   where tenant_reference = p_tenant_reference
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
    p_tenant_reference,
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

revoke all on function public.apply_ops_publication_event(
  text, text, text, text, bigint, text, text, timestamptz, timestamptz, text, text, jsonb
) from public, anon, authenticated;

grant execute on function public.apply_ops_publication_event(
  text, text, text, text, bigint, text, text, timestamptz, timestamptz, text, text, jsonb
) to service_role;

commit;
