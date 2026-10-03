-- LOCAL ONLY: reproduce the inspected production policy weaknesses before the
-- third migration; all synthetic changes roll back. Never run in production.
begin;
insert into auth.users(id,email) values
  (md5('rbac-red-editor')::uuid,'rbac-red-editor@invalid.example'),
  (md5('rbac-red-console')::uuid,'rbac-red-console@invalid.example');
insert into public.user_profiles(id,user_id,user_status)
  values(md5('rbac-red-editor')::uuid,md5('rbac-red-editor')::uuid,'active'),
        (md5('rbac-red-console')::uuid,md5('rbac-red-console')::uuid,'active');
insert into public.companies(id,name) values(md5('rbac-red-company')::uuid,'Synthetic RBAC company');
insert into public.roles(id,name,key,scope) values
  (md5('rbac-red-sensitive-role')::uuid,'rbac_red_sensitive','rbac_red_sensitive','company'),
  (md5('rbac-red-console-role')::uuid,'rbac_red_console','rbac_red_console','global'),
  (md5('rbac-red-basic-role')::uuid,'rbac_red_basic','rbac_red_basic','company');
insert into public.role_permissions(role_id,permission_id)
select md5('rbac-red-sensitive-role')::uuid,p.id from public.permissions p where p.key='rbac.write';
insert into public.role_permissions(role_id,permission_id)
select md5('rbac-red-console-role')::uuid,p.id from public.permissions p where p.key='admin.access';
insert into public.user_roles(user_id,role,role_id,company_id)
values(md5('rbac-red-console')::uuid,'rbac_red_console',md5('rbac-red-console-role')::uuid,null);
insert into public.company_memberships(id,company_id,user_id,role,membership_role,role_id)
values(md5('rbac-red-membership')::uuid,md5('rbac-red-company')::uuid,
  md5('rbac-red-editor')::uuid,'owner','owner',md5('rbac-red-basic-role')::uuid);
do $$ begin
  if 'rbac.write'=any(public.gridex_get_user_permissions(md5('rbac-red-editor')::uuid,md5('rbac-red-company')::uuid)) then
    raise exception 'RED fixture unexpectedly has rbac.write';
  end if;
end $$;
select set_config('request.jwt.claim.sub',md5('rbac-red-editor')::uuid::text,true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
do $$ begin
  if not public.gridex_can_write_company(md5('rbac-red-company')::uuid) then
    raise exception 'RED fixture lacks the real company editor helper';
  end if;
end $$;
-- A company editor can set its own canonical role_id to a sensitive role.
update public.company_memberships set role_id=md5('rbac-red-sensitive-role')::uuid
where id=md5('rbac-red-membership')::uuid;
-- It can also directly grant a scoped permission override without rbac.write.
insert into public.user_permission_overrides(user_id,company_id,permission_key,effect)
values(md5('rbac-red-editor')::uuid,md5('rbac-red-company')::uuid,'users.write','allow');
reset role;
do $$ begin
  if not ('rbac.write'=any(public.gridex_get_user_permissions(md5('rbac-red-editor')::uuid,md5('rbac-red-company')::uuid)))
    or not ('users.write'=any(public.gridex_get_user_permissions(md5('rbac-red-editor')::uuid,md5('rbac-red-company')::uuid))) then
    raise exception 'Expected real policy escalation was not reproduced';
  end if;
end $$;

-- Precision: console-only selfgrant is currently rejected by the function ACL.
-- Preserve that exact live ACL rather than faking a successful console exploit.
select set_config('request.jwt.claim.sub',md5('rbac-red-console')::uuid::text,true);
set local role authenticated;
do $$ declare rejected boolean:=false; begin
  begin
    insert into public.user_permissions(user_id,permission_id,permission_key)
    select md5('rbac-red-console')::uuid,p.id,p.key from public.permissions p where p.key='rbac.write';
  exception when insufficient_privilege then rejected:=true;
  end;
  if not rejected then raise exception 'Actual service-only gridex_can ACL was not retained'; end if;
end $$;
reset role;
select 'RED reproduced company editor role promotion and scoped override grant; console-only helper ACL already rejects selfgrant' as result;
rollback;
