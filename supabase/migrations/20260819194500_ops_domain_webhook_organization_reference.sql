-- Canonical organization-reference version of the durable OPS domain webhook apply function.
-- Legacy apply_ops_domain_event stays available for rollback while Gridex Web moves to v2.

create or replace function public.apply_ops_domain_event_v2(
  p_event_id text,
  p_delivery_id text,
  p_event_type text,
  p_organization_reference text,
  p_created_at timestamptz,
  p_payload_hash text,
  p_payload jsonb,
  p_customer_id text default null,
  p_customer_number text default null,
  p_external_customer_id text default null,
  p_customer_email text default null,
  p_portal_user_id text default null,
  p_related_entity_type text default null,
  p_related_entity_id text default null,
  p_notification_category text default null,
  p_notification_title text default null,
  p_notification_body text default null,
  p_notification_link_href text default null
)
returns table(
  result text,
  cache_invalidated boolean,
  stored_revision bigint,
  notification_created boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_existing public.ops_webhook_events%rowtype;
  v_event_row_id uuid;
  v_user_ids uuid[];
  v_user_id uuid;
  v_notification_created boolean := false;
  v_notification_count integer := 0;
  v_invoice_status text;
  v_attempt_count integer := 1;
  v_max_attempts integer := 5;
  v_failure_status text;
begin
  if
    nullif(trim(p_event_id), '') is null
    or nullif(trim(p_delivery_id), '') is null
    or nullif(trim(p_event_type), '') is null
    or p_organization_reference !~ '^organization_[A-Za-z0-9_-]{20,64}$'
    or p_created_at is null
    or nullif(trim(p_payload_hash), '') is null
  then
    raise exception using errcode = '22023',
      message = 'CANONICAL_DOMAIN_WEBHOOK_ARGUMENTS_INVALID';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_organization_reference || ':' || p_event_id || ':' || p_delivery_id, 0)
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
    if not (
      v_existing.event_id = p_event_id
      and v_existing.delivery_id = p_delivery_id
      and v_existing.payload_hash = p_payload_hash
    ) then
      return query select 'identifier_conflict'::text, false, null::bigint, false;
      return;
    end if;

    if v_existing.status <> 'retryable_failure'
       or v_existing.next_attempt_at is null
       or v_existing.next_attempt_at > now()
    then
      return query select 'duplicate'::text, false, null::bigint, v_existing.notification_created;
      return;
    end if;

    v_attempt_count := coalesce(v_existing.attempt_count, 0) + 1;
    v_max_attempts := greatest(coalesce(v_existing.max_attempts, 5), 1);
    if v_attempt_count > v_max_attempts then
      update public.ops_webhook_events
         set status = 'permanent_failure',
             error_message = coalesce(error_message, 'Webhook projection exceeded its retry budget.'),
             handling_note = 'domain_projection_dead_lettered',
             next_attempt_at = null,
             dead_letter_at = coalesce(dead_letter_at, now()),
             processed_at = coalesce(processed_at, now())
       where id = v_existing.id;
      return query select 'permanent_failure'::text, false, null::bigint, false;
      return;
    end if;

    v_event_row_id := v_existing.id;
    update public.ops_webhook_events
       set status = 'verified',
           organization_reference = coalesce(organization_reference, p_organization_reference),
           attempt_count = v_attempt_count,
           last_attempt_at = now(),
           next_attempt_at = null,
           error_message = null,
           handling_note = 'retrying_domain_projection'
     where id = v_event_row_id;
  end if;

  select array_agg(distinct cp.user_id)
    into v_user_ids
    from public.customer_profiles cp
   where
     (nullif(trim(p_portal_user_id), '') is not null and cp.portal_identity_id = trim(p_portal_user_id))
     or (nullif(trim(p_customer_id), '') is not null and (
       cp.external_identity_ref = trim(p_customer_id)
       or cp.billing_customer_ref = trim(p_customer_id)
     ))
     or (nullif(trim(p_customer_number), '') is not null and cp.customer_number = trim(p_customer_number))
     or (nullif(trim(p_external_customer_id), '') is not null and cp.external_customer_id = trim(p_external_customer_id))
     or (nullif(trim(p_customer_email), '') is not null and lower(cp.email) = lower(trim(p_customer_email)));

  if coalesce(cardinality(v_user_ids), 0) > 1 then
    if v_event_row_id is null then
      insert into public.ops_webhook_events (
        event_id, event_type, delivery_id, tenant_reference, organization_reference, customer_id,
        customer_number, external_customer_id, customer_email, portal_user_id,
        related_entity_type, related_entity_id, occurred_at, status,
        signature_valid, payload_hash, payload, handling_note, error_message,
        attempt_count, max_attempts, last_attempt_at, processed_at, dead_letter_at
      ) values (
        p_event_id, p_event_type, p_delivery_id, p_organization_reference, p_organization_reference, p_customer_id,
        p_customer_number, p_external_customer_id, p_customer_email, p_portal_user_id,
        p_related_entity_type, p_related_entity_id, p_created_at, 'permanent_failure',
        true, p_payload_hash, p_payload, 'customer_identity_conflict',
        'Webhook identifiers matched more than one portal user.', 1, 5, now(), now(), now()
      );
    else
      update public.ops_webhook_events
         set status = 'permanent_failure',
             organization_reference = coalesce(organization_reference, p_organization_reference),
             handling_note = 'customer_identity_conflict',
             error_message = 'Webhook identifiers matched more than one portal user.',
             next_attempt_at = null,
             processed_at = now(),
             dead_letter_at = now()
       where id = v_event_row_id;
    end if;
    return query select 'identifier_conflict'::text, false, null::bigint, false;
    return;
  end if;

  if coalesce(cardinality(v_user_ids), 0) = 1 then
    v_user_id := v_user_ids[1];
  end if;

  if v_event_row_id is null then
    insert into public.ops_webhook_events (
      event_id, event_type, delivery_id, header_event_id, header_event_type,
      tenant_reference, organization_reference, customer_id, customer_number, external_customer_id,
      customer_email, portal_user_id, related_entity_type, related_entity_id,
      occurred_at, status, signature_valid, payload_hash, payload,
      handling_note, attempt_count, max_attempts, last_attempt_at
    ) values (
      p_event_id, p_event_type, p_delivery_id, p_event_id, p_event_type,
      p_organization_reference, p_organization_reference, p_customer_id, p_customer_number, p_external_customer_id,
      p_customer_email, p_portal_user_id, p_related_entity_type, p_related_entity_id,
      p_created_at, 'verified', true, p_payload_hash, p_payload,
      'signature_and_organization_verified', 1, 5, now()
    ) returning id into v_event_row_id;
    v_attempt_count := 1;
    v_max_attempts := 5;
  end if;

  begin
    if p_event_type = 'invoice.paid' then
      v_invoice_status := 'paid';
    elsif p_event_type = 'invoice.disputed' then
      v_invoice_status := 'disputed';
    else
      v_invoice_status := null;
    end if;

    if v_invoice_status is not null and nullif(trim(p_related_entity_id), '') is not null then
      update public.customer_invoices
         set status = v_invoice_status,
             paid_at = case when v_invoice_status = 'paid' then coalesce(paid_at, p_created_at) else paid_at end,
             raw_payload = coalesce(raw_payload, '{}'::jsonb) || jsonb_build_object('last_ops_webhook', p_payload),
             updated_at = now()
       where v_user_id is not null
         and user_id = v_user_id
         and (external_invoice_ref = trim(p_related_entity_id) or invoice_number = trim(p_related_entity_id));
    end if;

    if nullif(trim(p_notification_title), '') is not null and nullif(trim(p_notification_body), '') is not null then
      insert into public.customer_notifications (
        user_id, channel, category, title, body, related_entity_type,
        related_entity_id, ops_event_id, customer_number, customer_email,
        external_customer_id, link_href, priority, metadata,
        identity_resolution_status, identity_resolution_error,
        identity_resolution_attempt_count, identity_resolution_last_attempt_at
      ) values (
        v_user_id, 'portal', coalesce(nullif(trim(p_notification_category), ''), 'general'),
        trim(p_notification_title), trim(p_notification_body), p_related_entity_type,
        p_related_entity_id, p_event_id, p_customer_number, p_customer_email,
        p_external_customer_id, p_notification_link_href, 'normal',
        jsonb_build_object('source', 'ops_webhook', 'event_type', p_event_type, 'organization_reference', p_organization_reference),
        case when v_user_id is null then 'pending' else 'resolved' end,
        case when v_user_id is null then 'No unique local portal user was resolved at webhook receipt.' else null end,
        1, now()
      )
      on conflict (ops_event_id) where ops_event_id is not null do nothing;
      get diagnostics v_notification_count = row_count;
      v_notification_created := v_notification_count > 0;
    end if;

    update public.ops_webhook_events as event_row
       set status = 'processed',
           organization_reference = coalesce(event_row.organization_reference, p_organization_reference),
           notification_created = event_row.notification_created or v_notification_created,
           processed_at = now(),
           next_attempt_at = null,
           dead_letter_at = null,
           error_message = null,
           handling_note = case
             when v_notification_created then 'domain_projection_and_notification_applied'
             else 'domain_projection_applied'
           end
     where id = v_event_row_id;

    return query select 'applied'::text, false, null::bigint, v_notification_created;
  exception when others then
    v_failure_status := case
      when v_attempt_count >= v_max_attempts then 'permanent_failure'
      else 'retryable_failure'
    end;
    update public.ops_webhook_events
       set status = v_failure_status,
           organization_reference = coalesce(organization_reference, p_organization_reference),
           error_message = left(sqlerrm, 1000),
           handling_note = case
             when v_failure_status = 'permanent_failure' then 'domain_projection_dead_lettered'
             else 'domain_projection_failed'
           end,
           next_attempt_at = case
             when v_failure_status = 'permanent_failure' then null
             else now() + make_interval(mins => least(60, 5 * greatest(v_attempt_count, 1)))
           end,
           dead_letter_at = case
             when v_failure_status = 'permanent_failure' then coalesce(dead_letter_at, now())
             else null
           end,
           processed_at = case
             when v_failure_status = 'permanent_failure' then coalesce(processed_at, now())
             else processed_at
           end
     where id = v_event_row_id;
    return query select v_failure_status, false, null::bigint, false;
  end;
end;
$$;

revoke all on function public.apply_ops_domain_event_v2(
  text, text, text, text, timestamptz, text, jsonb,
  text, text, text, text, text, text, text, text, text, text, text
) from public, anon, authenticated;

grant execute on function public.apply_ops_domain_event_v2(
  text, text, text, text, timestamptz, text, jsonb,
  text, text, text, text, text, text, text, text, text, text, text
) to service_role;
