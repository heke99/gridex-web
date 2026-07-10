begin;

create table if not exists public.website_application_submissions (
  submission_attempt_id uuid primary key,
  user_id uuid null references auth.users(id) on delete set null,
  idempotency_key text not null unique,
  external_application_id text not null unique,
  external_customer_id text not null,
  accepted_at timestamptz not null,
  offer_reference text not null,
  payload_hash text not null,
  ops_payload_hash text null,
  request_context jsonb not null default '{}'::jsonb,
  status text not null default 'prepared' check (status in ('prepared','submitting','accepted','failed')),
  ops_application_id uuid null,
  ops_customer_id uuid null,
  last_error_code text null,
  last_error_message text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.website_application_submissions
  add column if not exists ops_payload_hash text null,
  add column if not exists request_context jsonb not null default '{}'::jsonb;

create index if not exists idx_website_application_submissions_user_created
  on public.website_application_submissions(user_id, created_at desc);

alter table public.website_application_submissions enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='website_application_submissions'
      and policyname='website_application_submissions_service_role_all'
  ) then
    create policy website_application_submissions_service_role_all
      on public.website_application_submissions for all to service_role
      using (true) with check (true);
  end if;
end $$;

create table if not exists public.customer_portal_write_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_type text not null check (operation_type in ('customer_event','notification_read','profile_update')),
  idempotency_key text not null unique,
  identity jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','processing','completed','failed')),
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_attempt_at timestamptz null,
  completed_at timestamptz null,
  last_error_code text null,
  last_error_message text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customer_portal_write_outbox
  add column if not exists last_attempt_at timestamptz null,
  add column if not exists completed_at timestamptz null,
  add column if not exists last_error_code text null,
  add column if not exists last_error_message text null;

alter table public.customer_portal_write_outbox
  drop constraint if exists customer_portal_write_outbox_operation_type_check;
alter table public.customer_portal_write_outbox
  add constraint customer_portal_write_outbox_operation_type_check
  check (operation_type in ('customer_event','notification_read','profile_update'));

create index if not exists idx_customer_portal_write_outbox_dispatch
  on public.customer_portal_write_outbox(status, next_attempt_at, created_at);

alter table public.customer_portal_write_outbox enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='customer_portal_write_outbox'
      and policyname='customer_portal_write_outbox_service_role_all'
  ) then
    create policy customer_portal_write_outbox_service_role_all
      on public.customer_portal_write_outbox for all to service_role
      using (true) with check (true);
  end if;
end $$;

alter table if exists public.ops_webhook_events
  add column if not exists attempt_count integer not null default 0,
  add column if not exists last_attempt_at timestamptz null,
  add column if not exists next_attempt_at timestamptz null;

alter table if exists public.customer_notifications
  add column if not exists identity_resolution_status text not null default 'resolved',
  add column if not exists identity_resolution_error text null,
  add column if not exists identity_resolution_attempt_count integer not null default 0,
  add column if not exists identity_resolution_last_attempt_at timestamptz null,
  add column if not exists identity_resolution_next_attempt_at timestamptz null;

update public.customer_notifications
set identity_resolution_status = case when user_id is null then 'pending' else 'resolved' end
where identity_resolution_status is null
   or (user_id is null and identity_resolution_status = 'resolved');

create index if not exists idx_customer_notifications_identity_pending
  on public.customer_notifications(identity_resolution_status, identity_resolution_next_attempt_at, created_at)
  where user_id is null;


create table if not exists public.distributed_rate_limits (
  rate_limit_key text primary key,
  request_count integer not null default 0,
  reset_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.distributed_rate_limits enable row level security;

create or replace function public.consume_distributed_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns table(allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
  v_count integer;
  v_reset_at timestamptz;
begin
  v_key := left(btrim(p_key), 500);
  if nullif(v_key, '') is null then
    raise exception 'rate limit key is required';
  end if;
  if p_limit < 1 or p_window_seconds < 1 then
    raise exception 'invalid rate limit parameters';
  end if;

  loop
    update public.distributed_rate_limits as rl
    set request_count = case when rl.reset_at <= now() then 1 else rl.request_count + 1 end,
        reset_at = case
          when rl.reset_at <= now() then now() + make_interval(secs => p_window_seconds)
          else rl.reset_at
        end,
        updated_at = now()
    where rl.rate_limit_key = v_key
    returning rl.request_count, rl.reset_at into v_count, v_reset_at;

    if found then
      exit;
    end if;

    begin
      insert into public.distributed_rate_limits as rl(rate_limit_key, request_count, reset_at, updated_at)
      values (v_key, 1, now() + make_interval(secs => p_window_seconds), now())
      returning rl.request_count, rl.reset_at into v_count, v_reset_at;
      exit;
    exception when unique_violation then
      -- Another request inserted the same bucket. Retry the atomic update.
    end;
  end loop;

  allowed := v_count <= p_limit;
  remaining := greatest(0, p_limit - v_count);
  reset_at := v_reset_at;
  return next;
end;
$$;

revoke all on function public.consume_distributed_rate_limit(text, integer, integer) from public;
grant execute on function public.consume_distributed_rate_limit(text, integer, integer) to service_role;

create index if not exists idx_distributed_rate_limits_reset
  on public.distributed_rate_limits(reset_at);

commit;
