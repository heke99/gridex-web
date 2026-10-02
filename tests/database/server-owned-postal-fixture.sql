-- LOCAL ONLY: isolated native database fixture of inspected production schema.
-- The two postal policies and table columns match gridex-prod, 2026-10-02.
do $$ begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls; end if;
end $$;
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
grant usage on schema auth to anon,authenticated,service_role;
grant execute on function auth.uid() to anon,authenticated,service_role;
create table if not exists public.admin_users(user_id uuid primary key,role text,is_active boolean);
alter table public.admin_users enable row level security;
grant select on public.admin_users to anon,authenticated;
grant all on public.admin_users to service_role;
do $$ begin
  if not exists(select 1 from pg_policy where polrelid='public.admin_users'::regclass and polname='admin_users_self_read') then
    create policy admin_users_self_read on public.admin_users for select to public
      using (((select auth.uid())=user_id));
  end if;
end $$;
create table public.gridex_postal_code_price_area(
  postal_code text not null,
  price_area text not null,
  source text not null default 'admin'::text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gridex_postal_code_price_area_pkey primary key(postal_code),
  constraint gridex_postal_code_price_area_price_area_check check(price_area=any(array['SE1','SE2','SE3','SE4']::text[]))
);
alter table public.gridex_postal_code_price_area enable row level security;
grant all on public.gridex_postal_code_price_area to anon,authenticated,service_role;
create policy gridex_postal_admin_write on public.gridex_postal_code_price_area
  for all to public using (exists(select 1 from public.admin_users a where a.user_id=(select auth.uid())))
  with check (exists(select 1 from public.admin_users a where a.user_id=(select auth.uid())));
create policy gridex_postal_public_read on public.gridex_postal_code_price_area
  for select to public using(true);
-- Explicit column mutation grants verify that relation-level REVOKE is not
-- mistaken for a complete boundary. These are defense-in-depth fixture grants;
-- the inspected live columns had null ACLs.
grant select(postal_code),insert(postal_code,price_area),update(price_area),references(postal_code)
  on public.gridex_postal_code_price_area to public,anon,authenticated;
insert into public.admin_users values
  (md5('postal-disabled-support-user')::uuid,'customer_service_agent',false),
  (md5('postal-platform-user')::uuid,'super_admin',true);
insert into public.gridex_postal_code_price_area(postal_code,price_area) values('99999','SE1');
create schema if not exists gridex_test;
create table gridex_test.postal_catalog_before as
select c.relrowsecurity,c.relforcerowsecurity,
  (select jsonb_agg(to_jsonb(a) order by a.grantee,a.grantor,a.is_grantable)
    from pg_catalog.aclexplode(c.relacl) a where a.privilege_type='SELECT') as select_acl,
  (select jsonb_agg(to_jsonb(a) order by a.grantee,a.grantor,a.privilege_type,a.is_grantable)
    from pg_catalog.aclexplode(c.relacl) a where a.grantee='service_role'::regrole) as service_acl,
  (select jsonb_agg(jsonb_build_object('name',a.attname,
    'select_grants',(select jsonb_agg(to_jsonb(x) order by x.grantee,x.grantor,x.is_grantable)
      from pg_catalog.aclexplode(a.attacl) x where x.privilege_type='SELECT')) order by a.attnum)
    from pg_catalog.pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped) as column_select_acl,
  (select jsonb_agg(to_jsonb(p) order by p.polname) from pg_catalog.pg_policy p where p.polrelid=c.oid) as policies
from pg_catalog.pg_class c where c.oid='public.gridex_postal_code_price_area'::regclass;
