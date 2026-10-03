-- Behavioral regression: synthetic identities only; all fixtures are rolled back.
-- Run after the migration with psql -v ON_ERROR_STOP=1.
begin;

insert into auth.users(id,email) select md5('web-rbac-fixture-'||n)::uuid,'fixture-'||n||'@invalid.example' from generate_series(1,8) n;
insert into public.companies(id,name) values(md5('web-fixture-company-a')::uuid,'Web fixture A'),(md5('web-fixture-company-b')::uuid,'Web fixture B');
insert into public.roles(id,name,key,is_active) values
 (md5('web-role-a')::uuid,'web_fixture_a','web_fixture_a',true),
 (md5('web-role-b')::uuid,'web_fixture_b','web_fixture_b',true),
 (md5('web-role-dead')::uuid,'web_fixture_dead','web_fixture_dead',false),
 (md5('web-role-console')::uuid,'web_fixture_console','web_fixture_console',true),
 (md5('web-role-support')::uuid,'web_fixture_support','web_fixture_support',true);
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p where
 (r.key='web_fixture_a' and p.name='pricing.publish_prod') or
 (r.key='web_fixture_b' and p.name='integrations.write') or
 (r.key='web_fixture_dead' and p.name='users.write') or
 (r.key='web_fixture_console' and p.name='admin.access') or
 (r.key='web_fixture_support' and p.name in('support_tickets.read','support_tickets.reply','support_tickets.manage'));
insert into public.company_memberships(company_id,user_id,role)
values(md5('web-fixture-company-a')::uuid,md5('web-rbac-fixture-1')::uuid,'member'),
      (md5('web-fixture-company-b')::uuid,md5('web-rbac-fixture-1')::uuid,'member'),
      (md5('web-fixture-company-a')::uuid,md5('web-rbac-fixture-8')::uuid,'member');
insert into public.user_roles(user_id,role,role_id,company_id,status) values
 (md5('web-rbac-fixture-1')::uuid,'mismatched-legacy-text',md5('web-role-a')::uuid,md5('web-fixture-company-a')::uuid,'active'),
 (md5('web-rbac-fixture-1')::uuid,'web_fixture_b',md5('web-role-b')::uuid,md5('web-fixture-company-b')::uuid,'active'),
 (md5('web-rbac-fixture-1')::uuid,'web_fixture_dead',md5('web-role-dead')::uuid,null,'active'),
 (md5('web-rbac-fixture-2')::uuid,'web_fixture_a',md5('web-role-a')::uuid,null,'disabled'),
 (md5('web-rbac-fixture-3')::uuid,'web_fixture_console',md5('web-role-console')::uuid,null,'active'),
 (md5('web-rbac-fixture-4')::uuid,'web_fixture_support',md5('web-role-support')::uuid,null,'active'),
 (md5('web-rbac-fixture-8')::uuid,'web_fixture_support',md5('web-role-support')::uuid,md5('web-fixture-company-a')::uuid,'active');

do $$ declare a text[]; begin
 a:=public.gridex_get_user_permissions(md5('web-rbac-fixture-1')::uuid);
 if cardinality(a)<>0 then raise exception 'Missing tenant context leaked scoped permissions: %',a; end if;
 a:=public.gridex_get_user_permissions(md5('web-rbac-fixture-1')::uuid,md5('web-fixture-company-a')::uuid);
 if a<>array['pricing.publish_prod'] then raise exception 'Company A isolation/role_id resolution failed: %',a; end if;
 a:=public.gridex_get_user_permissions(md5('web-rbac-fixture-1')::uuid,md5('web-fixture-company-b')::uuid);
 if a<>array['integrations.write'] then raise exception 'Company B isolation failed: %',a; end if;
 if cardinality(public.gridex_get_user_permissions(md5('web-rbac-fixture-2')::uuid))<>0 then raise exception 'Disabled assignment retained access'; end if;
end $$;

insert into public.user_permissions(user_id,permission_id,effect,is_active,status)
select md5('web-rbac-fixture-1')::uuid,id,'allow',false,'active' from public.permissions where name='users.write';
insert into public.user_permission_overrides(user_id,permission_key,effect,company_id)
values(md5('web-rbac-fixture-1')::uuid,'pricing.publish_prod','deny',null);
do $$ begin
 if cardinality(public.gridex_get_user_permissions(md5('web-rbac-fixture-1')::uuid,md5('web-fixture-company-a')::uuid))<>0
 then raise exception 'Explicit global deny or inactive direct grant failed'; end if;
end $$;
update public.user_permission_overrides set valid_to=now()-interval '1 minute' where user_id=md5('web-rbac-fixture-1')::uuid;
do $$ begin
 if public.gridex_get_user_permissions(md5('web-rbac-fixture-1')::uuid,md5('web-fixture-company-a')::uuid)<>array['pricing.publish_prod']
 then raise exception 'Expired deny still applied'; end if;
end $$;
update public.company_memberships set status='disabled' where company_id=md5('web-fixture-company-a')::uuid and user_id=md5('web-rbac-fixture-1')::uuid;
do $$ begin
 if cardinality(public.gridex_get_user_permissions(md5('web-rbac-fixture-1')::uuid,md5('web-fixture-company-a')::uuid))<>0
 then raise exception 'Disabled membership retained scoped permissions'; end if;
end $$;

insert into public.user_profiles(id,user_id,user_status)
values(md5('web-rbac-fixture-2')::uuid,md5('web-rbac-fixture-2')::uuid,'disabled')
on conflict(id) do update set user_status='disabled';
update public.user_roles set status='active' where user_id=md5('web-rbac-fixture-2')::uuid;
insert into public.user_permissions(user_id,permission_id,effect,is_active,status)
select md5('web-rbac-fixture-2')::uuid,id,'allow',true,'active' from public.permissions where name='users.write';
do $$ begin
 if cardinality(public.gridex_get_user_permissions(md5('web-rbac-fixture-2')::uuid))<>0
 then raise exception 'Disabled profile retained role/direct access'; end if;
end $$;

insert into public.company_memberships(company_id,user_id,membership_role)
values(md5('web-fixture-company-a')::uuid,md5('web-rbac-fixture-2')::uuid,'owner');
insert into public.admin_users(user_id,role,is_active) values(md5('web-rbac-fixture-2')::uuid,'super_admin',true);
select set_config('request.jwt.claim.sub',md5('web-rbac-fixture-2')::uuid::text,true);
set local role authenticated;
do $$ declare blocked boolean:=false; begin
 if public.gridex_user_is_platform_admin() or public.gridex_can_write_company(md5('web-fixture-company-a')::uuid)
   or exists(select 1 from public.gridex_user_company_ids()) or public.gridex_user_has_role_key('web_fixture_a')
 then raise exception 'Unexpired JWT retained disabled account privileges'; end if;
 begin update public.user_profiles set user_status='active' where id=md5('web-rbac-fixture-2')::uuid;
 exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Profile owner reactivated their own account'; end if;
 update public.user_profiles set full_name='Own account name' where id=md5('web-rbac-fixture-2')::uuid;
end $$;
reset role;
insert into public.customer_profiles(user_id,customer_number,external_customer_id,tenant_reference)
values(md5('web-rbac-fixture-5')::uuid,'fixture-own-customer','fixture-own-id','fixture-web-tenant');

insert into public.customer_support_tickets(id,user_id,subject,description)
values(md5('web-history-ticket')::uuid,md5('web-rbac-fixture-5')::uuid,'History fixture','History fixture'),
      (md5('web-other-ticket')::uuid,md5('web-rbac-fixture-6')::uuid,'Other fixture','Other fixture');
insert into public.customer_support_messages(ticket_id,sender_user_id,sender_type,body,is_internal_note)
values(md5('web-history-ticket')::uuid,md5('web-rbac-fixture-5')::uuid,'customer','Public history',false),
      (md5('web-history-ticket')::uuid,md5('web-rbac-fixture-4')::uuid,'agent','Private internal note',true),
      (md5('web-other-ticket')::uuid,md5('web-rbac-fixture-6')::uuid,'customer','Other owner',false);

set local role service_role;
do $$ declare id1 uuid; id2 uuid; blocked boolean:=false; begin
 id1:=public.gridex_create_public_support_contact(md5('web-contact-request')::uuid,'Fixture','fixture@invalid.example','','general','Fixture subject','Fixture body',null);
 id2:=public.gridex_create_public_support_contact(md5('web-contact-request')::uuid,'Fixture','fixture@invalid.example','','general','Fixture subject','Fixture body','different-ip-hash');
 if id1<>id2 then raise exception 'Same request created multiple tickets'; end if;
 begin
  perform public.gridex_create_public_support_contact(md5('web-contact-request')::uuid,'Fixture','fixture@invalid.example','','general','Changed subject','Fixture body',null);
 exception when invalid_parameter_value then blocked:=sqlerrm='PUBLIC_SUPPORT_IDEMPOTENCY_CONFLICT'; end;
 if not blocked then raise exception 'Changed-payload replay was accepted'; end if;
end $$;
reset role;
do $$ begin
 if (select count(*) from public.customer_support_tickets where client_request_id='public:'||md5('web-contact-request')::uuid::text)<>1
 or (select count(*) from public.customer_support_messages where client_request_id='public:'||md5('web-contact-request')::uuid::text||':initial-message')<>1
 then raise exception 'Public contact replay duplicated ticket/message'; end if;
end $$;

select set_config('request.jwt.claim.sub',md5('web-rbac-fixture-5')::uuid::text,true);
set local role authenticated;
do $$ declare n integer; blocked boolean:=false; begin
 if (select count(*) from public.customer_support_tickets)<>1 then raise exception 'Owner ticket isolation failed'; end if;
 if (select count(*) from public.customer_support_messages)<>1 then raise exception 'Internal notes or other customer messages leaked'; end if;
 begin update public.customer_profiles set external_customer_id='different-customer',tenant_reference='different-tenant'
   where user_id=md5('web-rbac-fixture-5')::uuid;
 exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Browser changed canonical customer/tenant identifiers'; end if;
 blocked:=false;
 update public.customer_support_tickets set assigned_user_id=md5('web-rbac-fixture-5')::uuid where id=md5('web-history-ticket')::uuid;
 get diagnostics n=row_count;
 if n<>0 then raise exception 'Owner modified staff assignment'; end if;
 begin
  insert into public.customer_support_messages(ticket_id,sender_user_id,sender_type,body,is_internal_note)
  values(md5('web-history-ticket')::uuid,md5('web-rbac-fixture-5')::uuid,'agent','Spoofed agent',true);
 exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Owner spoofed an agent/internal note'; end if;
 blocked:=false;
 begin perform public.gridex_get_user_permissions(md5('web-rbac-fixture-4')::uuid);
 exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Authenticated arbitrary-user RPC leaked permissions'; end if;
end $$;
reset role;

select set_config('request.jwt.claim.sub',md5('web-rbac-fixture-3')::uuid::text,true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.customer_support_tickets) then raise exception 'admin.access bypassed support permission'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',md5('web-rbac-fixture-8')::uuid::text,true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.customer_support_tickets) then raise exception 'Company scoped staff reached global prospect data'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',md5('web-rbac-fixture-4')::uuid::text,true);
set local role authenticated;
do $$ declare t uuid; begin
 select id into t from public.customer_support_tickets;
 if t is null or (select count(*) from public.customer_support_tickets)<>1 then raise exception 'Global support prospect isolation failed'; end if;
 insert into public.customer_support_messages(ticket_id,sender_user_id,sender_type,body,is_internal_note)
 values(t,md5('web-rbac-fixture-4')::uuid,'agent','Internal prospect triage',true);
 if (select count(*) from public.customer_support_messages)<>2 then raise exception 'Prospect staff conversation scope failed'; end if;
end $$;
reset role;

-- Force the second write to fail. The RPC must roll back its first ticket write.
create function public.web_fixture_fail_message() returns trigger language plpgsql as $$
begin if new.client_request_id='public:'||md5('web-atomic-failure')::uuid::text||':initial-message'
 then raise exception 'Synthetic message failure'; end if; return new; end $$;
create trigger web_fixture_fail_message before insert on public.customer_support_messages
for each row execute function public.web_fixture_fail_message();
do $$ declare failed boolean:=false; begin
 begin
  perform public.gridex_create_public_support_contact(md5('web-atomic-failure')::uuid,'Fixture','fixture@invalid.example','','general','Atomic fixture','Atomic fixture',null);
 exception when raise_exception then failed:=sqlerrm='Synthetic message failure'; end;
 if not failed then raise exception 'Message failure was not exercised'; end if;
 if exists(select 1 from public.customer_support_tickets where client_request_id='public:'||md5('web-atomic-failure')::uuid::text)
 then raise exception 'Failed contact left an orphan ticket'; end if;
end $$;
drop trigger web_fixture_fail_message on public.customer_support_messages;
drop function public.web_fixture_fail_message();

set local role anon;
do $$ declare blocked boolean:=false; begin
 begin perform public.gridex_create_public_support_contact(md5('web-contact-anon')::uuid,'Fixture','fixture@invalid.example','','general','Fixture','Fixture',null);
 exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Anonymous direct RPC access accepted'; end if;
end $$;
reset role;
select 'Independent Web database isolation, denial, support confidentiality, replay and atomicity passed' as result;
rollback;
