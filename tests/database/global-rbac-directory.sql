-- LOCAL ONLY: native service-RPC behavior with a synthetic paginated directory.
begin;
insert into auth.users(id,email)
select md5('web-dir-profile-'||n)::uuid,'fixture-dir-'||n||'@invalid.example' from generate_series(1,25) n;
insert into auth.users(id,email) values
 (md5('web-dir-actor')::uuid,'directory-actor@invalid.example'),
 (md5('web-dir-company-actor')::uuid,'directory-company-actor@invalid.example'),
 (md5('web-dir-console-actor')::uuid,'directory-console-actor@invalid.example');
insert into public.user_profiles(id,user_id,email,full_name,created_at,user_status)
select md5('web-dir-profile-'||n)::uuid,md5('web-dir-profile-'||n)::uuid,'fixture-dir-'||n||'@invalid.example',
 case when n=10 then 'Fixture %_ literal' else 'Fixture directory '||n end,
 '2026-10-03 12:00:00+00'::timestamptz-n*interval '1 minute',case when n=18 then 'disabled' else 'active' end
from generate_series(1,25) n;
insert into public.roles(id,name,key,is_active) values
 (md5('web-dir-reader')::uuid,'web_dir_reader','web_dir_reader',true),
 (md5('web-dir-reader-shadow')::uuid,'web_dir_reader_shadow','WEB_DIR_READER',false),
 (md5('web-dir-singleton')::uuid,'web_dir_singleton','web_dir_singleton',true),
 (md5('web-dir-inactive-role')::uuid,'web_dir_inactive_role','web_dir_inactive_role',false),
 (md5('web-dir-writer')::uuid,'web_dir_writer','web_dir_writer',true),
 (md5('web-dir-console')::uuid,'web_dir_console','web_dir_console',true);
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p where
 (r.id=md5('web-dir-writer')::uuid and p.name='rbac.write')
 or (r.id=md5('web-dir-console')::uuid and p.name='admin.access');
insert into public.companies(id,name) values(md5('web-dir-company')::uuid,'Directory company fixture');
insert into public.company_memberships(company_id,user_id,role)
select md5('web-dir-company')::uuid,u,'member' from unnest(array[
 md5('web-dir-company-actor')::uuid,md5('web-dir-profile-19')::uuid,md5('web-dir-profile-21')::uuid]) u;
insert into public.user_roles(user_id,role,role_id,company_id)
values(md5('web-dir-actor')::uuid,'writer',md5('web-dir-writer')::uuid,null),
 (md5('web-dir-company-actor')::uuid,'writer',md5('web-dir-writer')::uuid,md5('web-dir-company')::uuid),
 (md5('web-dir-console-actor')::uuid,'console',md5('web-dir-console')::uuid,null),
 (md5('web-dir-profile-19')::uuid,'reader',md5('web-dir-reader')::uuid,md5('web-dir-company')::uuid),
 (md5('web-dir-profile-21')::uuid,'reader',md5('web-dir-reader')::uuid,md5('web-dir-company')::uuid),
 (md5('web-dir-profile-18')::uuid,'reader',md5('web-dir-reader')::uuid,null),
 (md5('web-dir-profile-17')::uuid,'inactive',md5('web-dir-inactive-role')::uuid,null),
 (md5('web-dir-profile-16')::uuid,'web_dir_reader',null,null),
 (md5('web-dir-profile-15')::uuid,'web_dir_singleton',null,null);
insert into public.user_roles(user_id,role,role_id,is_active,status)
select md5('web-dir-profile-'||n)::uuid,'reader',md5('web-dir-reader')::uuid,n<>20,'active' from generate_series(20,25) n;
insert into public.user_roles(user_id,role,role_id,status)
values(md5('web-dir-profile-21')::uuid,'historical',md5('web-dir-singleton')::uuid,'disabled');
insert into public.user_permissions(user_id,permission_id,effect)
select md5('web-dir-profile-21')::uuid,id,'allow' from public.permissions where name='admin.access';
insert into public.user_permission_overrides(user_id,permission_key,effect,company_id)
values(md5('web-dir-profile-21')::uuid,'users.write','deny',null),
 (md5('web-dir-profile-21')::uuid,'users.write','allow',md5('web-dir-company')::uuid);

set local role service_role;
do $$ declare r jsonb; blocked boolean:=false; actor uuid:=md5('web-dir-actor')::uuid; begin
 r:=public.gridex_web_list_global_rbac_users(actor,'  FIXTURE-DIR-  ',md5('web-dir-reader')::uuid,true,10,0);
 if (r->>'total')::integer<>5 or jsonb_array_length(r->'users')<>5
   or r#>>'{users,0,id}'<>md5('web-dir-profile-21')::uuid::text
 then raise exception 'Role/active filters ran after LIMIT or stable order failed: %',r; end if;
 if jsonb_array_length(r->'user_roles')<>6 or jsonb_array_length(r->'user_permissions')<>1
   or jsonb_array_length(r->'user_permission_overrides')<>1
 then raise exception 'Page global assignment detail isolation failed: %',r; end if;
 if exists(select 1 from jsonb_array_elements(r->'user_roles') u where not exists(
   select 1 from jsonb_array_elements(r->'users') p where p->>'id'=u->>'user_id'))
 then raise exception 'Directory returned assignment details outside its page'; end if;
 r:=public.gridex_web_list_global_rbac_users(actor,'fixture-dir-',md5('web-dir-reader')::uuid,null,2,2);
 if (r->>'total')::integer<>5 or jsonb_array_length(r->'users')<>2
   or r#>>'{users,0,id}'<>md5('web-dir-profile-23')::uuid::text
 then raise exception 'Directory offset or exact total failed'; end if;
 r:=public.gridex_web_list_global_rbac_users(actor,'fixture-dir-',md5('web-dir-reader')::uuid,null,2,99);
 if (r->>'total')::integer<>5 or jsonb_array_length(r->'users')<>0
   or jsonb_array_length(r->'user_roles')<>0 then raise exception 'Empty page lost filtered total or leaked details'; end if;
 r:=public.gridex_web_list_global_rbac_users(actor,'fixture-dir-',null,true,200,0);
 if (r->>'total')::integer<>6 then raise exception 'Effective active global role filter included disabled/scoped/ambiguous grants'; end if;
 r:=public.gridex_web_list_global_rbac_users(actor,'fixture-dir-',null,false,200,0);
 if (r->>'total')::integer<>19 then raise exception 'No active global role filter excluded disabled/scoped assignments'; end if;
 r:=public.gridex_web_list_global_rbac_users(actor,'%_',null,null,10,0);
 if (r->>'total')::integer<>1 or r#>>'{users,0,id}'<>md5('web-dir-profile-10')::uuid::text
 then raise exception 'Directory query interpreted wildcard characters'; end if;
 begin perform public.gridex_web_list_global_rbac_users(md5('web-dir-company-actor')::uuid);
 exception when insufficient_privilege then blocked:=sqlerrm='RBAC_GLOBAL_WRITE_REQUIRED'; end;
 if not blocked then raise exception 'Company-only RBAC permission reached global directory'; end if;
 blocked:=false;
 begin perform public.gridex_web_list_global_rbac_users(md5('web-dir-console-actor')::uuid);
 exception when insufficient_privilege then blocked:=sqlerrm='RBAC_GLOBAL_WRITE_REQUIRED'; end;
 if not blocked then raise exception 'Console entry bypassed global directory permission'; end if;
 blocked:=false;
 begin perform public.gridex_web_list_global_rbac_users(actor,repeat('x',201));
 exception when invalid_parameter_value then blocked:=sqlerrm='RBAC_DIRECTORY_INVALID_FILTER'; end;
 if not blocked then raise exception 'Oversized directory query was accepted'; end if;
 blocked:=false;
 begin perform public.gridex_web_list_global_rbac_users(actor,null,null,null,201,0);
 exception when invalid_parameter_value then blocked:=sqlerrm='RBAC_DIRECTORY_INVALID_FILTER'; end;
 if not blocked then raise exception 'Unbounded directory page was accepted'; end if;
 blocked:=false;
 begin perform public.gridex_web_list_global_rbac_users(actor,null,null,null,10,-1);
 exception when invalid_parameter_value then blocked:=sqlerrm='RBAC_DIRECTORY_INVALID_FILTER'; end;
 if not blocked then raise exception 'Negative directory offset was accepted'; end if;
end $$;
reset role;

select set_config('request.jwt.claim.sub',md5('web-dir-actor')::uuid::text,true);
set local role authenticated;
do $$ declare blocked boolean:=false; begin
 begin perform public.gridex_web_list_global_rbac_users(md5('web-dir-actor')::uuid);
 exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Authenticated user directly invoked global directory RPC'; end if;
end $$;
reset role;
select 'Global RBAC directory filtering, pagination, literal search, page isolation and authorization passed' as result;
rollback;
