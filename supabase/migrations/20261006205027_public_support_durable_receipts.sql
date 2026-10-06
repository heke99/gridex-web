begin;
create table if not exists public.public_support_receipts (
  operation_id uuid primary key,
  payload_hash text not null,
  ticket_id uuid not null references public.customer_support_tickets(id) on delete restrict,
  recipient text not null,
  body text not null,
  status text not null default 'pending' check(status in ('pending','processing','sent','failed','manual_review')),
  attempt_count integer not null default 0,
  claim_token uuid,
  first_attempt_at timestamptz,
  locked_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  provider_message_id text,
  last_error_code text,
  created_at timestamptz not null default now()
);
alter table public.public_support_receipts enable row level security;
revoke all on public.public_support_receipts from public,anon,authenticated;
grant select,insert,update on public.public_support_receipts to service_role;
create policy public_support_receipts_service on public.public_support_receipts for all to service_role using(true) with check(true);
create index if not exists public_support_receipts_due_idx on public.public_support_receipts(next_attempt_at) where status in ('pending','failed');
create index if not exists public_support_receipts_ticket_idx on public.public_support_receipts(ticket_id);

create or replace function public.gridex_create_public_inquiry_v1(p_operation_id uuid,p_payload_hash text,p_name text,p_email text,p_phone text,p_category text,p_subject text,p_message text,p_ip_hash text,p_user_agent text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare ticket uuid; existing public.public_support_receipts%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,0));
  select * into existing from public.public_support_receipts where operation_id=p_operation_id;
  if found then
    if existing.payload_hash<>p_payload_hash then raise exception 'idempotency_conflict' using errcode='22023'; end if;
    return existing.ticket_id;
  end if;
  if p_name='' or p_email='' or p_subject='' or p_message='' or length(p_message)>4000 then raise exception 'Invalid public inquiry'; end if;
  insert into public.customer_support_tickets(user_id,subject,description,category,priority,status,metadata)
  values(null,p_subject,p_message,p_category,'normal','open',jsonb_build_object('source','public_kundservice_form','customer_name',p_name,'customer_email',p_email,'customer_phone',p_phone,'client_request_id',p_operation_id::text,'ip_hash',p_ip_hash,'user_agent',p_user_agent)) returning id into ticket;
  insert into public.customer_support_messages(ticket_id,sender_user_id,sender_type,body) values(ticket,null,'customer',p_message);
  insert into public.public_support_receipts(operation_id,payload_hash,ticket_id,recipient,body)
    values(p_operation_id,p_payload_hash,ticket,p_email,'Hej ' || p_name || E',\n\nTack för ditt meddelande. Vi har tagit emot ditt ärende och återkommer till dig via e-post.\n\nÄmne: ' || p_subject || E'\n\nVänliga hälsningar,\nGridex AB');
  return ticket;
end $$;
create or replace function public.gridex_claim_public_receipts_v1(p_limit integer default 25) returns setof public.public_support_receipts
language plpgsql security definer set search_path = '' as $$
begin
  update public.public_support_receipts set status='failed',claim_token=null,next_attempt_at=now() where status='processing' and locked_at<now()-interval '15 minutes';
  return query with due as (
    select operation_id from public.public_support_receipts where status in ('pending','failed') and next_attempt_at<=now()
    order by next_attempt_at limit greatest(1,least(p_limit,100)) for update skip locked
  ) update public.public_support_receipts r set status='processing',claim_token=gen_random_uuid(),locked_at=now(),first_attempt_at=coalesce(first_attempt_at,now()),attempt_count=attempt_count+1
    from due where r.operation_id=due.operation_id returning r.*;
end $$;
revoke all on function public.gridex_create_public_inquiry_v1(uuid,text,text,text,text,text,text,text,text,text),public.gridex_claim_public_receipts_v1(integer) from public,anon,authenticated;
grant execute on function public.gridex_create_public_inquiry_v1(uuid,text,text,text,text,text,text,text,text,text),public.gridex_claim_public_receipts_v1(integer) to service_role;
commit;
