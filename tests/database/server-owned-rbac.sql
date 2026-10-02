-- LOCAL ONLY: synthetic behavioral tests; every data change is rolled back.
-- Requires server-owned-rbac-fixture.sql before the third migration, including
-- gridex_test.rbac_catalog_before, and all three final Web migrations.
-- Run with psql -v ON_ERROR_STOP=1. Do not run fixture tests in production.
begin;

-- ACL hardening must preserve every policy, RLS setting and effective SELECT
-- grant exactly. The fixture captures this catalog before the third migration.
do $$
declare actual record; baseline record; select_acl jsonb; column_select_acl jsonb; policies jsonb;
begin
  if (select count(*) from gridex_test.rbac_catalog_before)<>9 then
    raise exception 'Expected nine pre-migration RBAC catalog snapshots';
  end if;
  for baseline in select * from gridex_test.rbac_catalog_before loop
    select c.oid,c.relacl,c.relrowsecurity,c.relforcerowsecurity into strict actual
    from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname=baseline.tablename;
    select jsonb_build_object(
      'public',exists(select 1 from pg_catalog.aclexplode(actual.relacl) a where a.grantee=0 and a.privilege_type='SELECT'),
      'anon',has_table_privilege('anon',actual.oid,'SELECT'),
      'authenticated',has_table_privilege('authenticated',actual.oid,'SELECT'),
      'service_role',has_table_privilege('service_role',actual.oid,'SELECT')) into select_acl;
    select coalesce(jsonb_agg(to_jsonb(p) order by p.polname),'[]'::jsonb) into policies
    from pg_catalog.pg_policy p where p.polrelid=actual.oid;
    select jsonb_agg(jsonb_build_object('attnum',a.attnum,'attname',a.attname,
      'select_grants',(select jsonb_agg(to_jsonb(x) order by x.grantee,x.grantor,x.is_grantable)
        from pg_catalog.aclexplode(a.attacl) x where x.privilege_type='SELECT')) order by a.attnum)
      into column_select_acl
    from pg_catalog.pg_attribute a where a.attrelid=actual.oid and a.attnum>0 and not a.attisdropped;
    if actual.relrowsecurity is distinct from baseline.relrowsecurity
      or actual.relforcerowsecurity is distinct from baseline.relforcerowsecurity
      or select_acl is distinct from baseline.select_acl
      or column_select_acl is distinct from baseline.column_select_acl
      or policies is distinct from baseline.policies then
      raise exception 'SELECT privileges or RLS definitions changed on public.%',baseline.tablename;
    end if;
  end loop;
end $$;

insert into auth.users(id,email) values
 (md5('web-acl-console-user')::uuid,'web-acl-console@invalid.example'),
 (md5('web-acl-owner-user')::uuid,'web-acl-owner@invalid.example'),
 (md5('web-acl-platform-user')::uuid,'web-acl-platform@invalid.example'),
 (md5('web-acl-service-user')::uuid,'web-acl-service@invalid.example');
insert into public.user_profiles(id,user_id,user_status)
select id,id,'active' from auth.users where id in(
  md5('web-acl-console-user')::uuid,md5('web-acl-owner-user')::uuid,
  md5('web-acl-platform-user')::uuid,md5('web-acl-service-user')::uuid);
insert into public.companies(id,name) values(md5('web-acl-owner-company')::uuid,'ACL fixture owner company');
insert into public.roles(id,name,key,scope,is_active)
values(md5('web-acl-console-role')::uuid,'web_acl_console','web_acl_console','global',true);
insert into public.role_permissions(role_id,permission_id,role_key,permission_key)
select md5('web-acl-console-role')::uuid,id,'web_acl_console',coalesce(key,name)
from public.permissions where coalesce(key,name)='admin.access';
insert into public.user_roles(id,user_id,role,role_id,company_id,status,is_active)
values(md5('web-acl-console-assignment')::uuid,md5('web-acl-console-user')::uuid,
       'web_acl_console',md5('web-acl-console-role')::uuid,null,'active',true);
insert into public.user_roles(id,user_id,role,role_id,company_id,status,is_active)
select md5('web-acl-platform-assignment')::uuid,md5('web-acl-platform-user')::uuid,
       'super_admin',id,null,'active',true from public.roles where coalesce(key,name)='super_admin';
insert into public.company_memberships(id,company_id,user_id,role,membership_role,status,is_active)
values(md5('web-acl-owner-membership')::uuid,md5('web-acl-owner-company')::uuid,
       md5('web-acl-owner-user')::uuid,'owner','owner','active',true);
do $$ begin
  if public.gridex_get_user_permissions(md5('web-acl-console-user')::uuid)<>array['admin.access'] then
    raise exception 'Console-only identity is not an admin.access-only fixture';
  end if;
end $$;

-- Each command addresses a real row once service INSERT has completed.
-- The service loop inserts parent tables first and deletes child tables first.
create temp table web_acl_commands(
  ordinal integer primary key,table_name text not null,
  insert_sql text not null,update_sql text not null,delete_sql text not null
);
insert into web_acl_commands values
 (1,'roles',
  $q$insert into public.roles(id,name,key,scope,is_active) values(md5('web-acl-service-role')::uuid,'web_acl_service','web_acl_service','global',true)$q$,
  $q$update public.roles set description='Service updated role' where id=md5('web-acl-service-role')::uuid$q$,
  $q$delete from public.roles where id=md5('web-acl-service-role')::uuid$q$),
 (2,'permissions',
  $q$insert into public.permissions(id,name,key) values(md5('web-acl-service-permission')::uuid,'web_acl_service_permission','web_acl_service_permission')$q$,
  $q$update public.permissions set description='Service updated permission' where id=md5('web-acl-service-permission')::uuid$q$,
  $q$delete from public.permissions where id=md5('web-acl-service-permission')::uuid$q$),
 (3,'companies',
  $q$insert into public.companies(id,name) values(md5('web-acl-service-company')::uuid,'ACL fixture service company')$q$,
  $q$update public.companies set name='ACL fixture updated company' where id=md5('web-acl-service-company')::uuid$q$,
  $q$delete from public.companies where id=md5('web-acl-service-company')::uuid$q$),
 (4,'role_permissions',
  $q$insert into public.role_permissions(role_id,permission_id,role_key,permission_key) values(md5('web-acl-service-role')::uuid,md5('web-acl-service-permission')::uuid,'web_acl_service','web_acl_service_permission')$q$,
  $q$update public.role_permissions set permission_key='web_acl_service_permission' where role_id=md5('web-acl-service-role')::uuid and permission_id=md5('web-acl-service-permission')::uuid$q$,
  $q$delete from public.role_permissions where role_id=md5('web-acl-service-role')::uuid and permission_id=md5('web-acl-service-permission')::uuid$q$),
 (5,'user_roles',
  $q$insert into public.user_roles(id,user_id,role,role_id,company_id,status,is_active) values(md5('web-acl-service-assignment')::uuid,md5('web-acl-service-user')::uuid,'web_acl_service',md5('web-acl-service-role')::uuid,md5('web-acl-service-company')::uuid,'active',true)$q$,
  $q$update public.user_roles set status='disabled',is_active=false where id=md5('web-acl-service-assignment')::uuid$q$,
  $q$delete from public.user_roles where id=md5('web-acl-service-assignment')::uuid$q$),
 (6,'user_permissions',
  $q$insert into public.user_permissions(user_id,permission_id,permission_key,company_id,effect,status,is_active) values(md5('web-acl-service-user')::uuid,md5('web-acl-service-permission')::uuid,'web_acl_service_permission',md5('web-acl-service-company')::uuid,'allow','active',true)$q$,
  $q$update public.user_permissions set effect='deny' where user_id=md5('web-acl-service-user')::uuid and permission_id=md5('web-acl-service-permission')::uuid$q$,
  $q$delete from public.user_permissions where user_id=md5('web-acl-service-user')::uuid and permission_id=md5('web-acl-service-permission')::uuid$q$),
 (7,'user_permission_overrides',
  $q$insert into public.user_permission_overrides(id,user_id,permission_key,company_id,effect,is_active) values(md5('web-acl-service-override')::uuid,md5('web-acl-service-user')::uuid,'web_acl_service_permission',md5('web-acl-service-company')::uuid,'allow',true)$q$,
  $q$update public.user_permission_overrides set effect='deny' where id=md5('web-acl-service-override')::uuid$q$,
  $q$delete from public.user_permission_overrides where id=md5('web-acl-service-override')::uuid$q$),
 (8,'admin_users',
  $q$insert into public.admin_users(user_id,role,is_active) values(md5('web-acl-service-user')::uuid,'admin',true)$q$,
  $q$update public.admin_users set is_active=false where user_id=md5('web-acl-service-user')::uuid$q$,
  $q$delete from public.admin_users where user_id=md5('web-acl-service-user')::uuid$q$),
 (9,'company_memberships',
  $q$insert into public.company_memberships(id,company_id,user_id,role,membership_role,status,is_active) values(md5('web-acl-service-membership')::uuid,md5('web-acl-service-company')::uuid,md5('web-acl-service-user')::uuid,'member','member','active',true)$q$,
  $q$update public.company_memberships set membership_role='admin' where id=md5('web-acl-service-membership')::uuid$q$,
  $q$delete from public.company_memberships where id=md5('web-acl-service-membership')::uuid$q$);
grant select on web_acl_commands to anon,authenticated,service_role;

set local role service_role;
do $$ declare command record; affected integer; begin
  for command in select * from web_acl_commands order by ordinal loop
    execute command.insert_sql;
    get diagnostics affected=row_count;
    if affected<>1 then raise exception 'Service INSERT did not create one % row',command.table_name; end if;
  end loop;
end $$;
reset role;

-- A console user, company owner and platform administrator must all use guarded
-- server endpoints. Even the broadest existing RLS write policy cannot bypass
-- the relation and explicit column ACL boundary.
select set_config('request.jwt.claim.sub',md5('web-acl-console-user')::uuid::text,true);
set local role authenticated;
do $$ declare command record; statement text; blocked boolean; begin
  if public.gridex_user_is_platform_admin() then raise exception 'Console fixture unexpectedly has platform role'; end if;
  for command in select * from web_acl_commands order by ordinal loop
    foreach statement in array array[command.insert_sql,command.update_sql,command.delete_sql] loop
      blocked:=false;
      begin execute statement; exception when insufficient_privilege then blocked:=true; end;
      if not blocked then raise exception 'Console browser mutation was accepted on %: %',command.table_name,statement; end if;
    end loop;
  end loop;
end $$;
reset role;

select set_config('request.jwt.claim.sub',md5('web-acl-owner-user')::uuid::text,true);
set local role authenticated;
do $$ declare command record; statement text; blocked boolean; begin
  if not public.gridex_can_write_company(md5('web-acl-owner-company')::uuid) then
    raise exception 'Company owner helper stopped authorizing its existing company';
  end if;
  for command in select * from web_acl_commands order by ordinal loop
    foreach statement in array array[command.insert_sql,command.update_sql,command.delete_sql] loop
      blocked:=false;
      begin execute statement; exception when insufficient_privilege then blocked:=true; end;
      if not blocked then raise exception 'Company owner browser mutation was accepted on %: %',command.table_name,statement; end if;
    end loop;
  end loop;
end $$;
reset role;

select set_config('request.jwt.claim.sub',md5('web-acl-platform-user')::uuid::text,true);
set local role authenticated;
do $$ declare command record; statement text; blocked boolean; begin
  if not public.gridex_user_is_platform_admin() then raise exception 'Platform fixture lacks its existing platform role'; end if;
  for command in select * from web_acl_commands order by ordinal loop
    foreach statement in array array[command.insert_sql,command.update_sql,command.delete_sql] loop
      blocked:=false;
      begin execute statement; exception when insufficient_privilege then blocked:=true; end;
      if not blocked then raise exception 'Platform browser mutation was accepted on %: %',command.table_name,statement; end if;
    end loop;
  end loop;
end $$;
reset role;

select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$ declare command record; statement text; blocked boolean; begin
  for command in select * from web_acl_commands order by ordinal loop
    foreach statement in array array[command.insert_sql,command.update_sql,command.delete_sql] loop
      blocked:=false;
      begin execute statement; exception when insufficient_privilege then blocked:=true; end;
      if not blocked then raise exception 'Anonymous browser mutation was accepted on %: %',command.table_name,statement; end if;
    end loop;
  end loop;
end $$;
reset role;

set local role service_role;
do $$ declare command record; affected integer; begin
  for command in select * from web_acl_commands order by ordinal loop
    execute command.update_sql;
    get diagnostics affected=row_count;
    if affected<>1 then raise exception 'Service UPDATE did not affect one % row',command.table_name; end if;
  end loop;
  for command in select * from web_acl_commands order by ordinal desc loop
    execute command.delete_sql;
    get diagnostics affected=row_count;
    if affected<>1 then raise exception 'Service DELETE did not remove one % row',command.table_name; end if;
  end loop;
end $$;
reset role;

select 'Server-owned RBAC preserved SELECT/RLS, denied 108 browser DML attempts, and allowed 27 service DML operations' as result;
rollback;
