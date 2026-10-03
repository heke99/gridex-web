-- LOCAL ONLY: stable webhook ownership, conflict, duplicate and durable failure behavior.
begin;
insert into auth.users(id,email) values
  (md5('webhook-a')::uuid,'reused-mailbox@example.test'),
  (md5('webhook-b')::uuid,'other@example.test');
insert into public.customer_profiles(user_id,email,external_customer_id,customer_number,external_identity_ref,billing_customer_ref,portal_identity_id,metadata)
values(md5('webhook-a')::uuid,'reused-mailbox@example.test','external-a','C-A','external-a','C-A','portal-a','{"customer_reference":"customer-a"}'),
  (md5('webhook-b')::uuid,'other@example.test','external-b','C-B','external-b','C-B','portal-b','{"customer_reference":"customer-b"}');
insert into public.customer_invoices(user_id,external_invoice_ref) values
  (md5('webhook-a')::uuid,'invoice-same'),(md5('webhook-b')::uuid,'invoice-same');
create function pg_temp.webhook(identity jsonb,event_name text,event_type text default 'invoice.paid')
returns text language sql as $$
  select result from public.apply_ops_domain_event_v2(
    p_event_id=>event_name,p_delivery_id=>event_name||'-delivery',p_event_type=>event_type,
    p_organization_reference=>'organization_abcdefghijklmnopqrst',p_created_at=>'2026-10-03T17:00:00Z',
    p_payload_hash=>md5(identity::text||event_name),p_payload=>identity,
    p_customer_id=>identity->>'customer_id',p_customer_number=>identity->>'customer_number',
    p_external_customer_id=>identity->>'external_customer_id',p_customer_email=>identity->>'email',
    p_portal_user_id=>identity->>'portal_user_id',p_related_entity_type=>'invoice',p_related_entity_id=>'invoice-same',
    p_notification_title=>'Paid',p_notification_body=>'Payment received'
  );
$$;
do $$ declare actual text; begin
  if has_function_privilege('anon','public.apply_ops_domain_event_v2(text,text,text,text,timestamptz,text,jsonb,text,text,text,text,text,text,text,text,text,text,text)','execute')
    or has_function_privilege('authenticated','public.apply_ops_domain_event_v2(text,text,text,text,timestamptz,text,jsonb,text,text,text,text,text,text,text,text,text,text,text)','execute')
    or not has_function_privilege('service_role','public.apply_ops_domain_event_v2(text,text,text,text,timestamptz,text,jsonb,text,text,text,text,text,text,text,text,text,text,text)','execute') then
    raise exception 'Webhook apply grants changed';
  end if;

  actual:=pg_temp.webhook('{"email":"reused-mailbox@example.test","external_customer_id":"unknown-other-customer"}','email-only');
  if actual<>'applied' or exists(select 1 from public.customer_invoices where status='paid')
    or not exists(select 1 from public.customer_notifications where ops_event_id='email-only' and user_id is null and identity_resolution_status='pending') then
    raise exception 'Email-only webhook was not safely retained unresolved: %',actual;
  end if;

  actual:=pg_temp.webhook('{"external_customer_id":"external-b","email":"reused-mailbox@example.test"}','stable-b');
  if actual<>'applied' or not exists(select 1 from public.customer_invoices where user_id=md5('webhook-b')::uuid and status='paid')
    or exists(select 1 from public.customer_invoices where user_id=md5('webhook-a')::uuid and status='paid')
    or not exists(select 1 from public.customer_notifications where ops_event_id='stable-b' and user_id=md5('webhook-b')::uuid) then
    raise exception 'Stable customer ownership was overridden by contact email: %',actual;
  end if;
  actual:=pg_temp.webhook('{"external_customer_id":"external-b","email":"reused-mailbox@example.test"}','stable-b');
  if actual<>'duplicate' or (select count(*) from public.customer_notifications where ops_event_id='stable-b')<>1 then
    raise exception 'Duplicate webhook created another notification';
  end if;

  foreach actual in array array[
    pg_temp.webhook('{"external_customer_id":"unknown-customer","customer_number":"C-A"}','conflicting-external'),
    pg_temp.webhook('{"external_customer_id":"external-a","customer_number":"OTHER"}','conflicting-number'),
    pg_temp.webhook('{"external_customer_id":"external-a","customer_id":"OTHER"}','conflicting-customer-ref'),
    pg_temp.webhook('{"external_customer_id":"external-a","portal_user_id":"OTHER"}','conflicting-portal'),
    pg_temp.webhook('{"external_customer_id":"external-a","customer_number":"C-B"}','two-customers')
  ] loop
    if actual<>'identifier_conflict' then raise exception 'Conflicting stable identifier accepted: %',actual; end if;
  end loop;
  if exists(select 1 from public.customer_notifications where ops_event_id like 'conflicting-%' or ops_event_id='two-customers')
    or (select count(*) from public.ops_webhook_events where status='permanent_failure')<>5 then
    raise exception 'Conflict projection was not durably quarantined';
  end if;

  actual:=pg_temp.webhook(jsonb_build_object('portal_user_id',md5('webhook-a')::uuid::text),'auth-uuid');
  if actual<>'applied' or not exists(select 1 from public.customer_notifications where ops_event_id='auth-uuid' and user_id=md5('webhook-a')::uuid) then
    raise exception 'Verified Auth UUID did not correlate the account';
  end if;
  actual:=pg_temp.webhook('{"customer_id":"customer-a","customer_number":"C-A"}','canonical-metadata-ref');
  if actual<>'applied' then raise exception 'Canonical onboarding metadata reference was rejected'; end if;
  actual:=pg_temp.webhook('{"customer_id":"C-A","external_customer_id":"external-a"}','billing-ref');
  if actual<>'applied' then raise exception 'Known alternate billing reference was rejected'; end if;

  begin
    perform public.apply_ops_domain_event_v2('invalid-org','invalid-org-delivery','invoice.paid',null,now(),'hash','{}');
    raise exception 'Null organization reference accepted';
  exception when invalid_parameter_value then null;
  end;
end $$;

-- A notification sink failure must roll back the invoice update and remain retryable.
create function pg_temp.fail_webhook_notification() returns trigger language plpgsql as $$ begin
  if new.ops_event_id='sink-failure' then raise exception 'synthetic notification sink failure'; end if;
  return new;
end $$;
create trigger webhook_test_sink_failure before insert on public.customer_notifications
for each row execute function pg_temp.fail_webhook_notification();
update public.customer_invoices set status='issued',paid_at=null where user_id=md5('webhook-b')::uuid;
do $$ declare actual text; begin
  actual:=pg_temp.webhook('{"external_customer_id":"external-b"}','sink-failure');
  if actual<>'retryable_failure'
    or not exists(select 1 from public.ops_webhook_events where event_id='sink-failure' and status='retryable_failure' and next_attempt_at is not null)
    or exists(select 1 from public.customer_invoices where user_id=md5('webhook-b')::uuid and status='paid') then
    raise exception 'Notification failure lost durable retry or partial invoice update rolled back incorrectly: result=%, events=%, invoices=%',actual,
      (select jsonb_agg(to_jsonb(e)) from public.ops_webhook_events e where event_id='sink-failure'),
      (select jsonb_agg(to_jsonb(i)) from public.customer_invoices i where user_id=md5('webhook-b')::uuid);
  end if;
end $$;
drop trigger webhook_test_sink_failure on public.customer_notifications;
update public.ops_webhook_events set next_attempt_at=now()-interval '1 second' where event_id='sink-failure';
do $$ declare actual text; begin
  actual:=pg_temp.webhook('{"external_customer_id":"external-b"}','sink-failure');
  if actual<>'applied'
    or not exists(select 1 from public.customer_invoices where user_id=md5('webhook-b')::uuid and status='paid') then
    raise exception 'Stored webhook could not recover after sink repair';
  end if;
end $$;
rollback;
