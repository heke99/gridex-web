-- LOCAL ONLY: synthetic identities and grants, rolled back at the end.
-- Requires the production-shaped Web fixtures and all four final migrations.
-- Run with psql -v ON_ERROR_STOP=1. No Auth-table grant is added by this test.
begin;

insert into auth.users(id,email)
select md5('web-override-user-'||n)::uuid,'web-override-'||n||'@invalid.example'
from generate_series(1,10) n;
insert into public.user_profiles(id,user_id,user_status)
select md5('web-override-user-'||n)::uuid,md5('web-override-user-'||n)::uuid,
  case when n=4 then 'disabled' else 'active' end from generate_series(1,10) n;
insert into public.companies(id,name)
values(md5('web-override-company')::uuid,'Override fixture company');
insert into public.permissions(id,name,key) values
 (md5('web-override-permission')::uuid,'web_override_permission','web_override_permission'),
 (md5('web-override-permission-alias')::uuid,'web_override_permission_alias','web_override_permission');
insert into public.roles(id,name,key,scope,is_active) values
 (md5('web-override-actor-role')::uuid,'web_override_actor','web_override_actor','global',true),
 (md5('web-override-console-role')::uuid,'web_override_console','web_override_console','global',true),
 (md5('web-override-inactive-role')::uuid,'web_override_inactive','web_override_inactive','global',false),
 (md5('web-override-target-role')::uuid,'web_override_target','web_override_target','global',true);
insert into public.role_permissions(role_id,permission_id,role_key,permission_key)
select r.id,p.id,r.key,p.key from public.roles r cross join public.permissions p where
 (r.key in('web_override_actor','web_override_inactive') and p.key='rbac.write')
 or (r.key='web_override_console' and p.key='admin.access')
 or (r.key='web_override_target' and p.id=md5('web-override-permission')::uuid);
insert into public.user_roles(id,user_id,role,role_id,company_id,status,is_active)
select md5('web-override-assignment-'||n)::uuid,md5('web-override-user-'||n)::uuid,
  r.key,r.id,case when n=3 then md5('web-override-company')::uuid else null end,
  case when n=6 then 'disabled' else 'active' end,n<>6
from generate_series(1,9) n join public.roles r on r.key=case
  when n in(1,3,4,5,6) then 'web_override_actor'
  when n=2 then 'web_override_console'
  when n=7 then 'web_override_inactive'
  when n=9 then 'web_override_target' end;
insert into public.company_memberships(id,company_id,user_id,role,membership_role,status,is_active)
select md5('web-override-membership-'||n)::uuid,md5('web-override-company')::uuid,
  md5('web-override-user-'||n)::uuid,'member','member','active',true
from unnest(array[3,8,9]) n;
insert into public.user_permission_overrides(id,user_id,permission_key,effect,valid_from,valid_to,is_active)
values(md5('web-override-denied-actor')::uuid,md5('web-override-user-5')::uuid,'rbac.write','deny',now()-interval '1 hour',null,true),
      (md5('web-override-expired-actor')::uuid,md5('web-override-user-10')::uuid,'rbac.write','allow',now()-interval '2 hours',now()-interval '1 hour',true);

-- The same (user_id, permission_id) pair is already company-scoped. Global
-- edits must preserve it and its companion company override byte-for-byte.
insert into public.user_permissions(user_id,permission_id,permission_key,company_id,effect,status,is_active)
select md5('web-override-user-'||n)::uuid,md5('web-override-permission')::uuid,
  'web_override_permission',md5('web-override-company')::uuid,'allow','active',true
from unnest(array[8,9]) n;
insert into public.user_permissions(user_id,permission_id,permission_key,company_id,effect,status,is_active)
values(md5('web-override-user-8')::uuid,md5('web-override-permission-alias')::uuid,
       'web_override_permission',null,'deny','active',true);
insert into public.user_permission_overrides(id,user_id,company_id,permission_key,effect,reason,valid_from,valid_to,is_active,created_by,updated_by)
select md5('web-override-scoped-history-'||n)::uuid,md5('web-override-user-'||n)::uuid,
  md5('web-override-company')::uuid,'web_override_permission','allow','Company permission must stay unchanged',
  now()-interval '1 hour',now()+interval '7 days',true,md5('web-override-user-3')::uuid,md5('web-override-user-3')::uuid
from unnest(array[8,9]) n;
insert into public.user_permission_overrides(id,user_id,company_id,permission_key,effect,reason,valid_from,is_active)
values(md5('web-override-old-global-deny')::uuid,md5('web-override-user-8')::uuid,
       null,'web_override_permission','deny','Old global deny',now()-interval '1 day',true);

create temp table web_override_scoped_before as
select jsonb_build_object(
  'direct',(select jsonb_agg(to_jsonb(p) order by p.user_id,p.permission_id) from public.user_permissions p
    where p.company_id=md5('web-override-company')::uuid),
  'overrides',(select jsonb_agg(to_jsonb(o) order by o.id) from public.user_permission_overrides o
    where o.company_id=md5('web-override-company')::uuid)) as snapshot;
grant select on web_override_scoped_before to service_role;

do $$ begin
  if not ('rbac.write'=any(public.gridex_get_user_permissions(md5('web-override-user-1')::uuid))) then
    raise exception 'Valid override actor lacks explicit global rbac.write';
  end if;
  if public.gridex_get_user_permissions(md5('web-override-user-2')::uuid)<>array['admin.access'] then
    raise exception 'Console actor is not console-only';
  end if;
  if 'rbac.write'=any(public.gridex_get_user_permissions(md5('web-override-user-3')::uuid))
    or not ('rbac.write'=any(public.gridex_get_user_permissions(md5('web-override-user-3')::uuid,md5('web-override-company')::uuid))) then
    raise exception 'Company-scoped actor fixture has incorrect scope';
  end if;
  if 'web_override_permission'=any(public.gridex_get_user_permissions(md5('web-override-user-8')::uuid)) then
    raise exception 'Old global deny fixture is ineffective';
  end if;
  if not ('web_override_permission'=any(public.gridex_get_user_permissions(md5('web-override-user-9')::uuid))) then
    raise exception 'Role-derived target grant fixture is ineffective';
  end if;
  if has_table_privilege('service_role','auth.users','SELECT') then
    raise exception 'Test fixture unexpectedly grants service-role Auth-table SELECT';
  end if;
end $$;

set local role service_role;
do $$
declare response jsonb; override_id uuid; auth_read_blocked boolean:=false;
begin
  begin perform id from auth.users limit 1;
  exception when insufficient_privilege then auth_read_blocked:=true; end;
  if not auth_read_blocked then raise exception 'Service role could read Auth users directly'; end if;

  response:=public.gridex_web_set_global_permission_override(md5('web-override-user-1')::uuid,
    md5('web-override-user-8')::uuid,md5('web-override-permission')::uuid,'allow');
  override_id:=(response->>'id')::uuid;
  if response->>'permission_key'<>'web_override_permission' or response->>'effect'<>'allow'
    or not exists(select 1 from public.user_permission_overrides where id=override_id
      and company_id is null and is_active and effect='allow'
      and created_by=md5('web-override-user-1')::uuid and updated_by=md5('web-override-user-1')::uuid
      and valid_from<=now() and valid_to is null) then
    raise exception 'Global allow RPC did not return its canonical recorded override';
  end if;
  if not ('web_override_permission'=any(public.gridex_get_user_permissions(md5('web-override-user-8')::uuid))) then
    raise exception 'Legacy global deny still overrides a new allow';
  end if;
  if exists(select 1 from public.user_permissions where user_id=md5('web-override-user-8')::uuid
      and company_id is null and (is_active or status<>'inactive'))
    or exists(select 1 from public.user_permission_overrides
      where id=md5('web-override-old-global-deny')::uuid and is_active) then
    raise exception 'Old global direct/override decisions remained active';
  end if;

  -- An alias catalog ID has the same canonical key and must replace the same
  -- global history rather than creating a second independently active key.
  response:=public.gridex_web_set_global_permission_override(md5('web-override-user-1')::uuid,
    md5('web-override-user-8')::uuid,md5('web-override-permission-alias')::uuid,'deny');
  if response->>'permission_key'<>'web_override_permission'
    or 'web_override_permission'=any(public.gridex_get_user_permissions(md5('web-override-user-8')::uuid))
    or 'web_override_permission'=any(public.gridex_get_user_permissions(md5('web-override-user-8')::uuid,md5('web-override-company')::uuid)) then
    raise exception 'Canonical global deny did not override scoped grants';
  end if;
  perform public.gridex_web_set_global_permission_override(md5('web-override-user-1')::uuid,
    md5('web-override-user-8')::uuid,md5('web-override-permission')::uuid,'allow');
  if not ('web_override_permission'=any(public.gridex_get_user_permissions(md5('web-override-user-8')::uuid)))
    or not ('web_override_permission'=any(public.gridex_get_user_permissions(md5('web-override-user-8')::uuid,md5('web-override-company')::uuid))) then
    raise exception 'Allow did not restore access after global deny';
  end if;
  if (select count(*) from public.user_permission_overrides where user_id=md5('web-override-user-8')::uuid
      and company_id is null and permission_key='web_override_permission')<>4
    or (select count(*) from public.user_permission_overrides where user_id=md5('web-override-user-8')::uuid
      and company_id is null and permission_key='web_override_permission' and is_active)<>1 then
    raise exception 'Global decision history was lost or multiple decisions remain active';
  end if;

  perform public.gridex_web_set_global_permission_override(md5('web-override-user-1')::uuid,
    md5('web-override-user-9')::uuid,md5('web-override-permission')::uuid,'deny');
  if 'web_override_permission'=any(public.gridex_get_user_permissions(md5('web-override-user-9')::uuid))
    or 'web_override_permission'=any(public.gridex_get_user_permissions(md5('web-override-user-9')::uuid,md5('web-override-company')::uuid)) then
    raise exception 'Global deny did not override role-derived and scoped permissions';
  end if;
  perform public.gridex_web_set_global_permission_override(md5('web-override-user-1')::uuid,
    md5('web-override-user-9')::uuid,md5('web-override-permission')::uuid,'allow');
  if not ('web_override_permission'=any(public.gridex_get_user_permissions(md5('web-override-user-9')::uuid))) then
    raise exception 'Allow did not restore role-derived permissions';
  end if;
  if (select count(*) from public.user_permission_overrides where user_id=md5('web-override-user-9')::uuid
      and company_id is null and permission_key='web_override_permission' and is_active)<>1 then
    raise exception 'Role-derived target has multiple active global decisions';
  end if;
end $$;
reset role;

create temp table web_override_invalid_calls(expected_state text,call_sql text);
insert into web_override_invalid_calls
select '42501',format($q$select public.gridex_web_set_global_permission_override(%L::uuid,%L::uuid,%L::uuid,'allow')$q$,
  md5('web-override-user-'||n)::uuid,md5('web-override-user-8')::uuid,md5('web-override-permission')::uuid)
from unnest(array[2,3,4,5,6,7,10]) n;
insert into web_override_invalid_calls values
 ('P0002',$q$select public.gridex_web_set_global_permission_override(md5('web-override-user-1')::uuid,md5('web-override-missing-user')::uuid,md5('web-override-permission')::uuid,'allow')$q$),
 ('P0002',$q$select public.gridex_web_set_global_permission_override(md5('web-override-user-1')::uuid,md5('web-override-user-8')::uuid,md5('web-override-missing-permission')::uuid,'allow')$q$),
 ('22023',$q$select public.gridex_web_set_global_permission_override(md5('web-override-user-1')::uuid,md5('web-override-user-8')::uuid,md5('web-override-permission')::uuid,'ALLOW')$q$),
 ('22023',$q$select public.gridex_web_set_global_permission_override(md5('web-override-user-1')::uuid,md5('web-override-user-8')::uuid,md5('web-override-permission')::uuid,'')$q$),
 ('22023',$q$select public.gridex_web_set_global_permission_override(null,md5('web-override-user-8')::uuid,md5('web-override-permission')::uuid,'allow')$q$),
 ('22023',$q$select public.gridex_web_set_global_permission_override(md5('web-override-user-1')::uuid,null,md5('web-override-permission')::uuid,'allow')$q$),
 ('22023',$q$select public.gridex_web_set_global_permission_override(md5('web-override-user-1')::uuid,md5('web-override-user-8')::uuid,null,'allow')$q$),
 ('22023',$q$select public.gridex_web_set_global_permission_override(md5('web-override-user-1')::uuid,md5('web-override-user-8')::uuid,md5('web-override-permission')::uuid,null)$q$);
grant select on web_override_invalid_calls to service_role;
create temp table web_override_global_after_success as
select jsonb_build_object(
  'direct',(select jsonb_agg(to_jsonb(p) order by p.user_id,p.permission_id) from public.user_permissions p
    where p.user_id in(md5('web-override-user-8')::uuid,md5('web-override-user-9')::uuid)),
  'overrides',(select jsonb_agg(to_jsonb(o) order by o.id) from public.user_permission_overrides o
    where o.user_id in(md5('web-override-user-8')::uuid,md5('web-override-user-9')::uuid))) as snapshot;

set local role service_role;
do $$ declare invalid_call record; actual_state text; begin
  for invalid_call in select * from web_override_invalid_calls loop
    actual_state:=null;
    begin execute invalid_call.call_sql;
    exception when others then get stacked diagnostics actual_state=returned_sqlstate; end;
    if actual_state is distinct from invalid_call.expected_state then
      raise exception 'Invalid override call returned SQLSTATE %, expected %: %',actual_state,invalid_call.expected_state,invalid_call.call_sql;
    end if;
  end loop;
end $$;
reset role;

set local role authenticated;
do $$ declare blocked boolean:=false; begin
  begin perform public.gridex_web_set_global_permission_override(md5('web-override-user-1')::uuid,
    md5('web-override-user-8')::uuid,md5('web-override-permission')::uuid,'allow');
  exception when insufficient_privilege then blocked:=true; end;
  if not blocked then raise exception 'Authenticated caller executed the service-only override RPC'; end if;
end $$;
reset role;
set local role anon;
do $$ declare blocked boolean:=false; begin
  begin perform public.gridex_web_set_global_permission_override(md5('web-override-user-1')::uuid,
    md5('web-override-user-8')::uuid,md5('web-override-permission')::uuid,'allow');
  exception when insufficient_privilege then blocked:=true; end;
  if not blocked then raise exception 'Anonymous caller executed the service-only override RPC'; end if;
end $$;
reset role;

do $$ declare scoped_after jsonb; global_after jsonb; begin
  select jsonb_build_object(
    'direct',(select jsonb_agg(to_jsonb(p) order by p.user_id,p.permission_id) from public.user_permissions p
      where p.company_id=md5('web-override-company')::uuid),
    'overrides',(select jsonb_agg(to_jsonb(o) order by o.id) from public.user_permission_overrides o
      where o.company_id=md5('web-override-company')::uuid)) into scoped_after;
  if scoped_after is distinct from (select snapshot from web_override_scoped_before) then
    raise exception 'Global decisions modified company direct grants or override records';
  end if;
  select jsonb_build_object(
    'direct',(select jsonb_agg(to_jsonb(p) order by p.user_id,p.permission_id) from public.user_permissions p
      where p.user_id in(md5('web-override-user-8')::uuid,md5('web-override-user-9')::uuid)),
    'overrides',(select jsonb_agg(to_jsonb(o) order by o.id) from public.user_permission_overrides o
      where o.user_id in(md5('web-override-user-8')::uuid,md5('web-override-user-9')::uuid))) into global_after;
  if global_after is distinct from (select snapshot from web_override_global_after_success) then
    raise exception 'Rejected override calls changed target data';
  end if;
end $$;

-- Force the final history INSERT to fail after both deactivation UPDATEs. A
-- failed setter call must retain the previous direct grant and override rows.
update public.user_permissions set is_active=true,status='active'
where user_id=md5('web-override-user-8')::uuid and company_id is null;
create temp table web_override_atomic_before as
select jsonb_build_object(
  'direct',(select jsonb_agg(to_jsonb(p) order by p.permission_id) from public.user_permissions p
    where p.user_id=md5('web-override-user-8')::uuid),
  'overrides',(select jsonb_agg(to_jsonb(o) order by o.id) from public.user_permission_overrides o
    where o.user_id=md5('web-override-user-8')::uuid)) as snapshot;
create function public.web_override_fixture_fail() returns trigger language plpgsql as $$
begin
  if new.user_id=md5('web-override-user-8')::uuid and new.company_id is null
    and new.permission_key='web_override_permission' then
    raise exception using errcode='23514',message='Synthetic override insertion failure';
  end if;
  return new;
end $$;
create trigger web_override_fixture_fail before insert on public.user_permission_overrides
for each row execute function public.web_override_fixture_fail();
set local role service_role;
do $$ declare failed boolean:=false; begin
  begin perform public.gridex_web_set_global_permission_override(md5('web-override-user-1')::uuid,
    md5('web-override-user-8')::uuid,md5('web-override-permission')::uuid,'allow');
  exception when check_violation then failed:=sqlerrm='Synthetic override insertion failure'; end;
  if not failed then raise exception 'Final override INSERT failure was not exercised'; end if;
end $$;
reset role;
do $$ declare after_failure jsonb; begin
  select jsonb_build_object(
    'direct',(select jsonb_agg(to_jsonb(p) order by p.permission_id) from public.user_permissions p
      where p.user_id=md5('web-override-user-8')::uuid),
    'overrides',(select jsonb_agg(to_jsonb(o) order by o.id) from public.user_permission_overrides o
      where o.user_id=md5('web-override-user-8')::uuid)) into after_failure;
  if after_failure is distinct from (select snapshot from web_override_atomic_before) then
    raise exception 'Failed override INSERT left partially deactivated permission records';
  end if;
end $$;
drop trigger web_override_fixture_fail on public.user_permission_overrides;
drop function public.web_override_fixture_fail();

select 'Global RBAC overrides preserved scoped rows/history, replaced legacy denies, denied unauthorized actors, avoided Auth grants and passed atomic failure' as result;
rollback;
