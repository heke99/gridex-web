-- LOCAL ONLY: execute against the production-shaped forward package. Roll back
-- all synthetic identities, keys and grants after exercising native SQL/RLS.
begin;

insert into auth.users(id,email)
select md5('web-exact-role-user-'||n)::uuid,'exact-role-'||n||'@invalid.example' from generate_series(1,9) n;
insert into public.roles(id,name,key,is_active) values
 (md5('web-exact-bound')::uuid,'web_exact_bound_label','web_exact_collision',true),
 (md5('web-exact-shadow')::uuid,'web_exact_collision',null,false),
 (md5('web-exact-case-a')::uuid,'web_exact_case_label_a','web_exact_case',true),
 (md5('web-exact-case-b')::uuid,'web_exact_case_label_b','WEB_EXACT_CASE',true),
 (md5('web-exact-blank')::uuid,'web_exact_blank','',true),
 (md5('web-exact-admin-shadow')::uuid,'web_exact_admin_shadow','SUPER_ADMIN',false);
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p where
 (r.id in(md5('web-exact-bound')::uuid,md5('web-exact-case-a')::uuid) and p.name='pricing.publish_prod')
 or (r.id in(md5('web-exact-shadow')::uuid,md5('web-exact-case-b')::uuid,md5('web-exact-admin-shadow')::uuid) and p.name='users.write')
 or (r.id=md5('web-exact-blank')::uuid and p.name='integrations.write');
insert into public.user_roles(user_id,role,role_id) values
 (md5('web-exact-role-user-1')::uuid,'untrusted-legacy-name',md5('web-exact-bound')::uuid),
 (md5('web-exact-role-user-2')::uuid,'web_exact_collision',null),
 (md5('web-exact-role-user-3')::uuid,'web_exact_case',null),
 (md5('web-exact-role-user-4')::uuid,'WEB_EXACT_CASE',md5('web-exact-case-a')::uuid),
 (md5('web-exact-role-user-5')::uuid,'untrusted-legacy-name',md5('web-exact-blank')::uuid),
 (md5('web-exact-role-user-6')::uuid,'web_exact_blank',null),
 (md5('web-exact-role-user-7')::uuid,'super_admin',null);
insert into public.user_roles(user_id,role,role_id)
select md5('web-exact-role-user-8')::uuid,'untrusted-legacy-name',id from public.roles where key='super_admin';
insert into public.companies(id,name) values(md5('web-exact-company')::uuid,'Exact role fixture');
insert into public.company_memberships(company_id,user_id,role_id,role_key)
values(md5('web-exact-company')::uuid,md5('web-exact-role-user-9')::uuid,md5('web-exact-bound')::uuid,'WEB_EXACT_CASE');

set local role service_role;
do $$ begin
 if public.gridex_get_user_permissions(md5('web-exact-role-user-1')::uuid)<>array['pricing.publish_prod']
 then raise exception 'Exact active role inherited a colliding inactive role grant'; end if;
 if cardinality(public.gridex_get_user_permissions(md5('web-exact-role-user-2')::uuid))<>0
   or exists(select 1 from public.gridex_get_user_roles(md5('web-exact-role-user-2')::uuid))
 then raise exception 'Ambiguous key/name text assignment retained access'; end if;
 if cardinality(public.gridex_get_user_permissions(md5('web-exact-role-user-3')::uuid))<>0
 then raise exception 'Case-insensitive legacy lookup combined distinct role grants'; end if;
 if public.gridex_get_user_permissions(md5('web-exact-role-user-4')::uuid)<>array['pricing.publish_prod']
 then raise exception 'Exact role ID fell back to a conflicting legacy key'; end if;
 if public.gridex_get_user_permissions(md5('web-exact-role-user-5')::uuid)<>array['integrations.write']
   or public.gridex_get_user_permissions(md5('web-exact-role-user-6')::uuid)<>array['integrations.write']
 then raise exception 'Blank canonical key lost assigned role or unique legacy name grants'; end if;
 if cardinality(public.gridex_get_user_permissions(md5('web-exact-role-user-7')::uuid))<>0
 then raise exception 'Ambiguous legacy platform administrator retained access'; end if;
 if cardinality(public.gridex_get_user_permissions(md5('web-exact-role-user-9')::uuid))<>0
   or public.gridex_get_user_permissions(md5('web-exact-role-user-9')::uuid,md5('web-exact-company')::uuid)<>array['pricing.publish_prod']
 then raise exception 'Membership role ID resolution or company isolation failed'; end if;
end $$;
reset role;

-- An additional active role with a colliding canonical name must not change an
-- exact assignment. This collision is legal under both production unique indexes.
update public.roles set is_active=true where id=md5('web-exact-shadow')::uuid;
set local role service_role;
do $$ begin
 if public.gridex_get_user_permissions(md5('web-exact-role-user-1')::uuid)<>array['pricing.publish_prod']
   or public.gridex_get_user_permissions(md5('web-exact-role-user-9')::uuid,md5('web-exact-company')::uuid)<>array['pricing.publish_prod']
 then raise exception 'Exact assignment combined another active role grant'; end if;
end $$;
reset role;

select set_config('request.jwt.claim.sub',md5('web-exact-role-user-2')::uuid::text,true);
set local role authenticated;
do $$ declare blocked boolean:=false; begin
 if public.gridex_user_has_role_key('web_exact_collision')
 then raise exception 'Self-role predicate accepted ambiguous legacy assignment'; end if;
 begin perform * from gridex_web_private.assigned_roles(md5('web-exact-role-user-8')::uuid,null::uuid);
 exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Browser accessed arbitrary-user exact role resolver'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',md5('web-exact-role-user-7')::uuid::text,true);
set local role authenticated;
do $$ begin
 if public.gridex_user_is_platform_admin() or public.gridex_user_has_role_key('super_admin')
 then raise exception 'Ambiguous platform administrator bypassed self-role guard'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',md5('web-exact-role-user-8')::uuid::text,true);
set local role authenticated;
do $$ begin
 if not public.gridex_user_is_platform_admin() or not public.gridex_user_has_role_key('super_admin')
 then raise exception 'Exact platform administrator assignment was lost'; end if;
end $$;
reset role;

select 'Exact role IDs, inactive/case/key-name collisions, legacy ambiguity and resolver ACL passed' as result;
rollback;
