-- LOCAL ONLY. Load independent-web-fixture.sql, independent-web-existing-functions.sql,
-- 20261002173716_independent_web_rbac_and_public_support.sql, then this fixture.
-- Production-shaped monthly schema/policies inspected on 2026-10-02. The live
-- tables intentionally differ from the historical 20260602 migration: prices
-- use numeric(10,3), composite PK, signed values; history has snapshot JSON and
-- no previous_year/month columns. Extra column ACLs are synthetic hardening probes.
create table public.gridex_monthly_spot_prices(
  price_area text not null check(price_area in('SE1','SE2','SE3','SE4')),
  year integer not null,
  month integer not null check(month between 1 and 12),
  avg_spot_ore numeric(10,3) not null,
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  updated_at timestamptz default now(),
  source text,
  source_payload jsonb not null default '{}'::jsonb,
  primary key(price_area,year,month)
);
create table public.gridex_spot_basis_config(
  id integer primary key check(id=1),
  active_year integer not null,
  active_month integer not null check(active_month between 1 and 12),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create table public.gridex_spot_basis_publish_log(
  id uuid primary key default gen_random_uuid(),
  action text not null,
  active_year integer not null,
  active_month integer not null,
  snapshot jsonb not null,
  reason text,
  created_at timestamptz not null default now(),
  created_by uuid
);
create table public.permission_audit(
  id uuid primary key default gen_random_uuid(),actor_id uuid not null,
  action text not null,target_user_id uuid,metadata jsonb,created_at timestamptz default now()
);
grant all on public.permission_audit to service_role;
create or replace function public.gridex_touch_updated() returns trigger
language plpgsql set search_path='' as $$ begin
  new.updated_at:=now();
  if auth.uid() is not null then new.updated_by:=auth.uid(); end if;
  return new;
end $$;
create or replace function public.gridex_touch_created_by() returns trigger
language plpgsql set search_path='' as $$ begin
  if auth.uid() is not null then new.created_by:=auth.uid(); end if;
  return new;
end $$;
create or replace function public.set_current_timestamp_updated_at() returns trigger
language plpgsql set search_path='' as $$ begin new.updated_at:=now(); return new; end $$;
create trigger gridex_monthly_spot_prices_touch_updated before insert or update
on public.gridex_monthly_spot_prices for each row execute function public.gridex_touch_updated();
create trigger gridex_spot_basis_config_touch_updated before insert or update
on public.gridex_spot_basis_config for each row execute function public.gridex_touch_updated();
create trigger gridex_spot_basis_publish_log_touch_created_by before insert
on public.gridex_spot_basis_publish_log for each row execute function public.gridex_touch_created_by();
create trigger trg_gridex_monthly_spot_prices_updated_at before update
on public.gridex_monthly_spot_prices for each row execute function public.set_current_timestamp_updated_at();
create trigger trg_gridex_spot_basis_config_updated_at before update
on public.gridex_spot_basis_config for each row execute function public.set_current_timestamp_updated_at();
-- Current production policy helper. The canonical actor authorization remains
-- the exact independent-Web permission function, not a canned permission stub.
create or replace function public.gridex_has_permission(p_user_id uuid,p_permission text)
returns boolean language sql security definer set search_path='public' as $$
  select p_user_id is not null and p_permission is not null
    and p_permission=any(public.gridex_get_user_permissions(p_user_id));
$$;
create or replace function public.gridex_can(p_permission text) returns boolean
language plpgsql stable security definer set search_path='public','auth' as $$ begin
  if p_permission is null or auth.uid() is null then return false; end if;
  if public.gridex_user_is_platform_admin() then return true; end if;
  return public.gridex_has_permission(auth.uid(),p_permission);
exception when others then return false; end $$;
revoke all on function public.gridex_can(text),public.gridex_has_permission(uuid,text) from public,anon,authenticated;
grant execute on function public.gridex_can(text),public.gridex_has_permission(uuid,text) to service_role;

alter table public.gridex_monthly_spot_prices enable row level security;
alter table public.gridex_spot_basis_config enable row level security;
alter table public.gridex_spot_basis_publish_log enable row level security;
grant all on public.gridex_monthly_spot_prices,public.gridex_spot_basis_config,public.gridex_spot_basis_publish_log
  to anon,authenticated,service_role;
create policy gridex_monthly_spot_admin_write on public.gridex_monthly_spot_prices for all to public
  using(exists(select 1 from public.admin_users a where a.user_id=(select auth.uid())))
  with check(exists(select 1 from public.admin_users a where a.user_id=(select auth.uid())));
create policy gridex_monthly_spot_public_read on public.gridex_monthly_spot_prices for select to public using(true);
create policy gridex_monthly_spot_prices_public_read on public.gridex_monthly_spot_prices for select to anon,authenticated using(true);
create policy gridex_monthly_spot_prices_admin_write on public.gridex_monthly_spot_prices for insert to authenticated
  with check(public.gridex_can('spot.write') or public.gridex_can('pricing.write'));
create policy gridex_monthly_spot_prices_admin_update on public.gridex_monthly_spot_prices for update to authenticated
  using(public.gridex_can('spot.write') or public.gridex_can('pricing.write'))
  with check(public.gridex_can('spot.write') or public.gridex_can('pricing.write'));
create policy gridex_monthly_spot_prices_admin_delete on public.gridex_monthly_spot_prices for delete to authenticated
  using(public.gridex_can('spot.write') or public.gridex_can('pricing.write'));
create policy gridex_monthly_spot_prices_update on public.gridex_monthly_spot_prices for update to authenticated
  using(public.gridex_can('spot.write') or public.gridex_can('pricing.write') or public.gridex_can('admin.access'))
  with check(public.gridex_can('spot.write') or public.gridex_can('pricing.write') or public.gridex_can('admin.access'));
create policy gridex_monthly_spot_prices_write on public.gridex_monthly_spot_prices for insert to authenticated
  with check(public.gridex_can('spot.write') or public.gridex_can('pricing.write') or public.gridex_can('admin.access'));
create policy gridex_spot_basis_config_public_read on public.gridex_spot_basis_config for select to anon,authenticated using(id=1);
create policy gridex_spot_basis_config_admin_update on public.gridex_spot_basis_config for update to authenticated
  using((public.gridex_can('spot.write') or public.gridex_can('pricing.write')) and id=1)
  with check((public.gridex_can('spot.write') or public.gridex_can('pricing.write')) and id=1);
create policy gridex_spot_basis_config_admin_write on public.gridex_spot_basis_config for insert to authenticated
  with check((public.gridex_can('spot.write') or public.gridex_can('pricing.write')) and id=1);
create policy gridex_spot_basis_config_publish on public.gridex_spot_basis_config for update to authenticated
  using((public.gridex_can('spot.publish') or public.gridex_can('admin.access')) and id=1)
  with check((public.gridex_can('spot.publish') or public.gridex_can('admin.access')) and id=1);
create policy gridex_spot_basis_config_publish_insert on public.gridex_spot_basis_config for insert to authenticated
  with check((public.gridex_can('spot.publish') or public.gridex_can('admin.access')) and id=1);
create policy gridex_spot_basis_publish_log_insert on public.gridex_spot_basis_publish_log for insert to authenticated
  with check(public.gridex_can('spot.publish') or public.gridex_can('admin.access'));
create policy gridex_spot_basis_publish_log_read on public.gridex_spot_basis_publish_log for select to authenticated
  using(public.gridex_can('spot.publish') or public.gridex_can('admin.access'));

grant select(price_area),insert(price_area,year,month,avg_spot_ore),update(avg_spot_ore),references(price_area)
  on public.gridex_monthly_spot_prices to public,anon,authenticated;
grant select(id),insert(id,active_year,active_month),update(active_month),references(id)
  on public.gridex_spot_basis_config to public,anon,authenticated;
grant select(id),insert(action,active_year,active_month,snapshot),update(reason),references(id)
  on public.gridex_spot_basis_publish_log to public,anon,authenticated;

insert into auth.users(id,email)
select md5('monthly-'||actor)::uuid,'monthly-'||actor||'@example.test' from unnest(array[
  'global-writer','global-publisher','company-only','disabled-role','disabled-profile',
  'legacy-admin','pricing-only','unprivileged','global-allow','global-deny'
]) actor;
insert into public.roles(name,key,scope,is_active) values
  ('monthly_writer','monthly_writer','global',true),
  ('monthly_publisher','monthly_publisher','global',true),
  ('monthly_disabled','monthly_disabled','global',false),
  ('monthly_legacy_admin','monthly_legacy_admin','global',true),
  ('monthly_pricing','monthly_pricing','global',true);
insert into public.permissions(name,key)
select p,p from unnest(array['spot.write','pricing.write']) p
where not exists(select 1 from public.permissions x where x.key=p or x.name=p);
insert into public.role_permissions(role_id,permission_id,role_key,permission_key)
select r.id,p.id,r.key,p.key from public.roles r cross join public.permissions p
where (r.key='monthly_writer' and p.key='spot.write')
   or (r.key='monthly_publisher' and p.key='spot.publish')
   or (r.key='monthly_disabled' and p.key in('spot.write','spot.publish'))
   or (r.key='monthly_legacy_admin' and p.key='admin.access')
   or (r.key='monthly_pricing' and p.key='pricing.write');
insert into public.companies(id,name) values(md5('monthly-company')::uuid,'Monthly scoped tenant');
insert into public.user_roles(user_id,role,role_id,company_id)
select md5('monthly-'||x.actor)::uuid,r.key,r.id,
  case when x.actor='company-only' then md5('monthly-company')::uuid else null::uuid end
from (values
  ('global-writer','monthly_writer'),('global-publisher','monthly_publisher'),
  ('company-only','monthly_writer'),('company-only','monthly_publisher'),
  ('disabled-role','monthly_disabled'),('disabled-profile','monthly_writer'),
  ('disabled-profile','monthly_publisher'),('legacy-admin','monthly_legacy_admin'),
  ('pricing-only','monthly_pricing'),('global-deny','monthly_writer'),('global-deny','monthly_publisher')
) x(actor,role_key) join public.roles r on r.key=x.role_key;
insert into public.company_memberships(company_id,user_id,role,role_key,membership_role)
values(md5('monthly-company')::uuid,md5('monthly-company-only')::uuid,'monthly_writer','monthly_writer','member');
insert into public.user_profiles(id,user_id,user_status)
values(md5('monthly-disabled-profile')::uuid,md5('monthly-disabled-profile')::uuid,'suspended');
insert into public.user_permission_overrides(user_id,permission_key,effect)
select md5('monthly-'||actor)::uuid,permission,effect from (values
  ('global-allow','spot.write','allow'),('global-allow','spot.publish','allow'),
  ('global-deny','spot.write','deny'),('global-deny','spot.publish','deny')
) x(actor,permission,effect);
insert into public.admin_users(user_id,role,is_active)
values(md5('monthly-legacy-admin')::uuid,'customer_service_agent',false);
insert into public.gridex_monthly_spot_prices(price_area,year,month,avg_spot_ore,source,source_payload)
select area,2026,m,10+substring(area from 3)::integer,'prior-source',jsonb_build_object('preserve',area)
from unnest(array['SE1','SE2','SE3','SE4']) area cross join unnest(array[7,8]) m;
insert into public.gridex_spot_basis_config(id,active_year,active_month) values(1,2026,7);

create schema if not exists gridex_test;
create table gridex_test.monthly_catalog_before as
select c.relname::text as tablename,c.relrowsecurity,c.relforcerowsecurity,
  (select jsonb_agg(to_jsonb(a) order by a.grantee,a.grantor,a.is_grantable)
    from pg_catalog.aclexplode(c.relacl) a where a.privilege_type='SELECT') as select_acl,
  (select jsonb_agg(to_jsonb(a) order by a.grantee,a.grantor,a.privilege_type,a.is_grantable)
    from pg_catalog.aclexplode(c.relacl) a where a.grantee='service_role'::regrole) as service_acl,
  (select jsonb_agg(jsonb_build_object('name',a.attname,
    'select_grants',(select jsonb_agg(to_jsonb(x) order by x.grantee,x.grantor,x.is_grantable)
      from pg_catalog.aclexplode(a.attacl) x where x.privilege_type='SELECT')) order by a.attnum)
    from pg_catalog.pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped) as column_select_acl,
  (select jsonb_agg(to_jsonb(p) order by p.polname) from pg_catalog.pg_policy p where p.polrelid=c.oid) as policies,
  (select jsonb_agg(to_jsonb(t) order by t.tgname) from pg_catalog.pg_trigger t where t.tgrelid=c.oid and not t.tgisinternal) as triggers
from pg_catalog.pg_class c where c.oid in('public.gridex_monthly_spot_prices'::regclass,
  'public.gridex_spot_basis_config'::regclass,'public.gridex_spot_basis_publish_log'::regclass);
alter table gridex_test.monthly_catalog_before add primary key(tablename);
-- Preserve the shared permission function signatures as well as their real behavior.
create table gridex_test.monthly_authorization_signatures_before as
select p.oid,p.proargnames,p.prorettype,p.proargtypes::text,p.pronargs,p.prosecdef
from pg_proc p where p.oid in('public.gridex_get_user_permissions(uuid)'::regprocedure,
  'public.gridex_get_user_permissions(uuid,uuid)'::regprocedure);
