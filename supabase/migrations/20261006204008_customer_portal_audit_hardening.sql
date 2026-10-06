-- Additive hardening for the audited Web integration. Do not replay historical migrations.
begin;

-- Customer-facing projections are written only by the authenticated server boundary.
-- Revoke column grants as well as table grants; preserve existing SELECT/RLS policies.
do $$
declare t text; c text;
begin
  foreach t in array array['customer_profiles','customer_delivery_points','customer_notifications','customer_contracts'] loop
    if to_regclass('public.' || t) is null then raise exception 'Missing prerequisite table %', t; end if;
    execute format('revoke insert, update, delete, truncate, references, trigger on public.%I from anon, authenticated', t);
    for c in select column_name from information_schema.columns where table_schema='public' and table_name=t loop
      execute format('revoke insert (%I), update (%I), references (%I) on public.%I from anon, authenticated', c, c, c, t);
    end loop;
  end loop;
end $$;

-- Session-scoped wrappers cannot inspect or record another user's identity.
create or replace function public.gridex_my_permissions_v1() returns text[]
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  return public.gridex_get_user_permissions(auth.uid());
end $$;
create or replace function public.gridex_my_has_permission_v1(p_permission text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  return public.gridex_has_permission(auth.uid(), p_permission);
end $$;
create or replace function public.gridex_my_log_login_v1() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  perform public.gridex_log_customer_login(auth.uid());
end $$;
revoke all on function public.gridex_my_permissions_v1(), public.gridex_my_has_permission_v1(text), public.gridex_my_log_login_v1() from public, anon;
grant execute on function public.gridex_my_permissions_v1(), public.gridex_my_has_permission_v1(text), public.gridex_my_log_login_v1() to authenticated, service_role;

-- Always use Auth's verified current email. Updating a running job preserves its
-- claim while durably recording the newer event. Row writes and completion commit together.
create or replace function public.gridex_enqueue_auth_profile_v1(p_user_id uuid, p_otp_type text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u auth.users%rowtype; j public.auth_profile_sync_jobs%rowtype;
begin
  if p_otp_type not in ('email','recovery','invite','email_change') then raise exception 'Invalid OTP type'; end if;
  select * into strict u from auth.users where id=p_user_id for share;
  if u.email_confirmed_at is null then raise exception 'Verified Auth email required'; end if;
  insert into public.auth_profile_sync_jobs(user_id,email,otp_type,status,attempt_count,next_attempt_at)
    values(p_user_id,u.email,p_otp_type,'pending',0,now())
  on conflict(user_id) do update set
    email=excluded.email, otp_type=excluded.otp_type,
    status=case when auth_profile_sync_jobs.status='processing' then 'processing' else 'pending' end,
    attempt_count=case when auth_profile_sync_jobs.status='processing' then auth_profile_sync_jobs.attempt_count else 0 end,
    locked_at=case when auth_profile_sync_jobs.status='processing' then auth_profile_sync_jobs.locked_at else null end,
    next_attempt_at=now(), last_error=null, updated_at=now()
  returning * into j;
  return to_jsonb(j);
end $$;
create or replace function public.gridex_commit_auth_profile_v1(p_user_id uuid, p_attempt integer, p_locked_at timestamptz) returns boolean
language plpgsql security definer set search_path = '' as $$
declare u auth.users%rowtype; j public.auth_profile_sync_jobs%rowtype;
begin
  select * into strict u from auth.users where id=p_user_id for share;
  if u.email_confirmed_at is null then raise exception 'Verified Auth email required'; end if;
  select * into j from public.auth_profile_sync_jobs where user_id=p_user_id for update;
  if j.status is distinct from 'processing' or j.attempt_count is distinct from p_attempt or j.locked_at is distinct from p_locked_at then return false; end if;
  insert into public.customer_profiles(user_id,email,email_verified_at,onboarding_state)
    values(u.id,u.email,u.email_confirmed_at,'verified')
  on conflict(user_id) do update set email=excluded.email, email_verified_at=excluded.email_verified_at;
  insert into public.user_profiles(id,user_id,email) values(u.id,u.id,u.email)
  on conflict(id) do update set email=excluded.email;
  update public.auth_profile_sync_jobs set email=u.email,status='completed',last_error=null,next_attempt_at=null,completed_at=now(),locked_at=null,updated_at=now() where user_id=u.id;
  return true;
end $$;
revoke all on function public.gridex_enqueue_auth_profile_v1(uuid,text), public.gridex_commit_auth_profile_v1(uuid,integer,timestamptz) from public, anon, authenticated;
grant execute on function public.gridex_enqueue_auth_profile_v1(uuid,text), public.gridex_commit_auth_profile_v1(uuid,integer,timestamptz) to service_role;
commit;
