-- One staff-visible privacy request for accounts without a linked OPS customer.
-- Reuses the existing service-only Web inquiry/receipt RPC and Support123 inbox.
begin;
alter table public.customer_privacy_requests add column local_ticket_id uuid null
  references public.customer_support_tickets(id) deferrable initially deferred;
alter table public.customer_privacy_requests drop constraint customer_privacy_requests_check;
alter table public.customer_privacy_requests add constraint customer_privacy_requests_receipt_check check (
  (submitted_at is null) = (ops_case_reference is null and local_ticket_id is null)
  and not(ops_case_reference is not null and local_ticket_id is not null)
);
create index customer_privacy_requests_local_ticket on public.customer_privacy_requests(local_ticket_id) where local_ticket_id is not null;

create or replace function public.gridex_enqueue_privacy_request_v1(
  p_user_id uuid,p_kind text,p_operation_id uuid,p_identity jsonb
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  r public.customer_privacy_requests%rowtype;
  request_id uuid := gen_random_uuid();
  queue_id uuid := gen_random_uuid();
  payload jsonb;
  local_ticket uuid;
  message text;
  title text;
begin
  if p_user_id is null or p_operation_id is null or p_kind is null or p_kind not in ('access','erasure')
    or jsonb_typeof(p_identity) is distinct from 'object'
    or p_identity->>'userId' is distinct from p_user_id::text
    or nullif(p_identity->>'email','') is null
    or length(p_identity->>'email')>320
    or exists(select 1 from jsonb_object_keys(p_identity) k where k not in ('userId','email','customerNumber','externalCustomerId'))
  then raise exception 'privacy_request_invalid' using errcode='22023'; end if;
  -- Serialize this subject's intents; retries precede the durable daily quota.
  perform pg_advisory_xact_lock(hashtextextended('privacy:'||p_user_id::text,0));
  select * into r from public.customer_privacy_requests
    where user_id=p_user_id and client_operation_id=p_operation_id;
  if found then
    if r.kind<>p_kind then raise exception 'privacy_idempotency_conflict' using errcode='23505'; end if;
    return jsonb_build_object('id',r.id,'kind',r.kind,'created_at',r.created_at,'replayed',true);
  end if;
  if (select count(*) from public.customer_privacy_requests
    where user_id=p_user_id and created_at>now()-interval '24 hours')>=5
  then raise exception 'privacy_request_limit' using errcode='P0001'; end if;
  payload:=jsonb_build_object('privacy_request_id',request_id,'kind',p_kind);
  insert into public.customer_portal_write_outbox(id,user_id,operation_type,idempotency_key,identity,payload,payload_hash)
  values(queue_id,p_user_id,'privacy_request','portal-privacy:'||p_user_id::text||':'||p_operation_id::text,
    p_identity,payload,encode(sha256(convert_to(jsonb_build_object('identity',p_identity,'payload',payload)::text,'UTF8')),'hex'));
  -- Auth-only accounts have no OPS customer to own a customer-support case.
  -- Create one real staff-visible Web inquiry instead, in this SAME transaction.
  -- There is no external request here and no invented OPS reference.
  if nullif(p_identity->>'customerNumber','') is null and nullif(p_identity->>'externalCustomerId','') is null then
    title:=case when p_kind='access' then 'Begäran om registerutdrag' else 'Begäran om radering av personuppgifter' end;
    message:=case when p_kind='access' then 'Jag begär tillgång till mina personuppgifter och en kopia av dem.'
      else 'Jag begär att mina personuppgifter raderas där de inte behöver bevaras enligt lag eller för att fullgöra avtal.' end
      ||E'\nBegäran skickad från mitt verifierade konto. Referens: '||request_id::text||'.';
    local_ticket:=public.gridex_create_public_inquiry_v1(request_id,
      encode(sha256(convert_to(jsonb_build_object('identity',p_identity,'kind',p_kind)::text,'UTF8')),'hex'),
      'Kund',p_identity->>'email',null,'data_protection',title,message,null,null);
    update public.customer_portal_write_outbox set status='completed',completed_at=now(),updated_at=now() where id=queue_id;
  end if;
  insert into public.customer_privacy_requests(id,user_id,client_operation_id,kind,outbox_id,local_ticket_id,submitted_at)
    values(request_id,p_user_id,p_operation_id,p_kind,queue_id,local_ticket,case when local_ticket is null then null else now() end) returning * into r;
  return jsonb_build_object('id',r.id,'kind',r.kind,'created_at',r.created_at,'replayed',false);
end $$;
revoke all on function public.gridex_enqueue_privacy_request_v1(uuid,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.gridex_enqueue_privacy_request_v1(uuid,text,uuid,jsonb) to service_role;
commit;
