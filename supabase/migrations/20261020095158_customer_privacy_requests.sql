-- Web-only additive migration. OPS remains authoritative for case handling.
begin;

alter table public.customer_portal_write_outbox
  drop constraint customer_portal_write_outbox_operation_type_check;
alter table public.customer_portal_write_outbox
  add constraint customer_portal_write_outbox_operation_type_check check (operation_type in (
    'customer_event','notification_read','profile_update','customer_sync',
    'customer_portal_sync','move_out','facility_data_update','privacy_request'
  ));

create table public.customer_privacy_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_operation_id uuid not null,
  kind text not null check (kind in ('access','erasure')),
  outbox_id uuid not null unique references public.customer_portal_write_outbox(id)
    deferrable initially deferred,
  ops_case_reference text null check (ops_case_reference ~ '^[a-z][a-z0-9_]{1,31}_[A-Za-z0-9_-]{20,64}$'),
  created_at timestamptz not null default now(),
  submitted_at timestamptz null,
  unique(user_id,client_operation_id),
  check ((ops_case_reference is null) = (submitted_at is null))
);
create index customer_privacy_requests_user_created on public.customer_privacy_requests(user_id,created_at desc);
alter table public.customer_privacy_requests enable row level security;
revoke all on public.customer_privacy_requests from public,anon,authenticated;
grant select,insert,update on public.customer_privacy_requests to service_role;
create policy customer_privacy_requests_service on public.customer_privacy_requests
  for all to service_role using (true) with check (true);

-- Service-only, invoker RPC. The BFF verifies the Auth session and constructs
-- identity; no browser can supply another subject or invoke this directly.
create function public.gridex_enqueue_privacy_request_v1(
  p_user_id uuid,p_kind text,p_operation_id uuid,p_identity jsonb
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  r public.customer_privacy_requests%rowtype;
  request_id uuid := gen_random_uuid();
  queue_id uuid := gen_random_uuid();
  payload jsonb;
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
  insert into public.customer_privacy_requests(id,user_id,client_operation_id,kind,outbox_id)
    values(request_id,p_user_id,p_operation_id,p_kind,queue_id) returning * into r;
  return jsonb_build_object('id',r.id,'kind',r.kind,'created_at',r.created_at,'replayed',false);
end $$;

-- Commit the OPS receipt and queue completion together, only for this exact
-- lease. A timed-out worker cannot complete another worker's claim.
create function public.gridex_complete_privacy_request_v1(
  p_outbox_id uuid,p_attempt integer,p_locked_at timestamptz,p_case_reference text
) returns boolean language plpgsql security invoker set search_path='' as $$
declare q public.customer_portal_write_outbox%rowtype; r public.customer_privacy_requests%rowtype;
begin
  if p_case_reference is null or p_case_reference !~ '^[a-z][a-z0-9_]{1,31}_[A-Za-z0-9_-]{20,64}$'
    then raise exception 'privacy_receipt_invalid' using errcode='22023'; end if;
  select * into q from public.customer_portal_write_outbox where id=p_outbox_id for update;
  if not found or q.operation_type<>'privacy_request' or q.status not in ('processing','completed')
    or q.attempt_count is distinct from p_attempt or q.last_attempt_at is distinct from p_locked_at
    then return false; end if;
  select * into r from public.customer_privacy_requests where outbox_id=q.id for update;
  if not found or r.user_id<>q.user_id or q.payload->>'privacy_request_id' is distinct from r.id::text
    or q.payload->>'kind' is distinct from r.kind then raise exception 'privacy_queue_mismatch'; end if;
  if q.status='completed' then return r.ops_case_reference=p_case_reference; end if;
  update public.customer_privacy_requests set ops_case_reference=p_case_reference,submitted_at=now() where id=r.id;
  update public.customer_portal_write_outbox set status='completed',completed_at=now(),updated_at=now(),
    last_error_code=null,last_error_message=null where id=q.id;
  return true;
end $$;
revoke all on function public.gridex_enqueue_privacy_request_v1(uuid,text,uuid,jsonb),
  public.gridex_complete_privacy_request_v1(uuid,integer,timestamptz,text) from public,anon,authenticated;
grant execute on function public.gridex_enqueue_privacy_request_v1(uuid,text,uuid,jsonb),
  public.gridex_complete_privacy_request_v1(uuid,integer,timestamptz,text) to service_role;
commit;
