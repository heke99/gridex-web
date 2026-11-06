-- Public registration and staff invitation share Auth. A default Auth/profile
-- trigger must never grant a staff role. Canonical staff authorization stays in OPS.
begin;
set local lock_timeout='5s';
lock table public.user_profiles in share row exclusive mode;
do $$ begin
  if encode(sha256(convert_to(pg_get_functiondef('public.assign_default_role()'::regprocedure),'UTF8')),'hex')
    <>'bc0abf1fbca8c5a6bfdea83877ea2233dd94f97328c49b63680c2bffc512a407'
  then raise exception 'Default role source changed: inspect before applying'; end if;
  if not exists(select 1 from pg_trigger where tgrelid='public.user_profiles'::regclass
    and tgname='on_user_profile_created' and tgtype=5 and tgfoid='public.assign_default_role()'::regprocedure)
  then raise exception 'Default role trigger changed: inspect before applying'; end if;
end $$;
create or replace function public.assign_default_role() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.id is null or new.user_id is distinct from new.id then
    raise exception 'Default customer profile identity mismatch';
  end if;
  insert into public.user_roles(user_id,role)
    select new.id,'customer' where not exists(
      select 1 from public.user_roles where user_id=new.id and role='customer'
    );
  return new;
end $$;
revoke all on function public.assign_default_role() from public,anon,authenticated;
commit;
