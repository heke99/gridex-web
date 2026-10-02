-- LOCAL ONLY: exact production RBAC table grants/policies inspected 2026-10-02.
-- Load the independent Web fixture, exact existing functions and migrations
-- one/two first. This does not undo their hardened company/profile helpers.

-- Exact inspected constraints for affected company/direct/override writes.
do $$ begin
  if not exists(select 1 from pg_constraint where conrelid='public.user_permissions'::regclass and conname='user_permissions_permission_id_fkey') then
    alter table public.user_permissions add constraint "user_permissions_permission_id_fkey" FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE;
  end if;
  if not exists(select 1 from pg_constraint where conrelid='public.user_permissions'::regclass and conname='user_permissions_pkey') then
    alter table public.user_permissions add constraint "user_permissions_pkey" PRIMARY KEY (user_id, permission_id);
  end if;
  if not exists(select 1 from pg_constraint where conrelid='public.company_memberships'::regclass and conname='company_memberships_company_id_fkey') then
    alter table public.company_memberships add constraint "company_memberships_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
  end if;
  if not exists(select 1 from pg_constraint where conrelid='public.company_memberships'::regclass and conname='company_memberships_company_id_user_id_key') then
    alter table public.company_memberships add constraint "company_memberships_company_id_user_id_key" UNIQUE (company_id, user_id);
  end if;
  if not exists(select 1 from pg_constraint where conrelid='public.company_memberships'::regclass and conname='company_memberships_pkey') then
    alter table public.company_memberships add constraint "company_memberships_pkey" PRIMARY KEY (id);
  end if;
  if not exists(select 1 from pg_constraint where conrelid='public.company_memberships'::regclass and conname='company_memberships_role_check') then
    alter table public.company_memberships add constraint "company_memberships_role_check" CHECK ((membership_role = ANY (ARRAY['company_admin'::text, 'member'::text, 'viewer'::text, 'owner'::text, 'admin'::text, 'operations'::text, 'support'::text])));
  end if;
  if not exists(select 1 from pg_constraint where conrelid='public.company_memberships'::regclass and conname='company_memberships_status_check') then
    alter table public.company_memberships add constraint "company_memberships_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'invited'::text, 'pending'::text, 'suspended'::text, 'disabled'::text, 'removed'::text, 'removed_from_company'::text, 'invitation_revoked'::text, 'locked_security'::text, 'revoked'::text])));
  end if;
  if not exists(select 1 from pg_constraint where conrelid='public.user_permission_overrides'::regclass and conname='user_permission_overrides_company_id_fkey') then
    alter table public.user_permission_overrides add constraint "user_permission_overrides_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
  end if;
  if not exists(select 1 from pg_constraint where conrelid='public.user_permission_overrides'::regclass and conname='user_permission_overrides_company_id_user_id_permission_key_key') then
    alter table public.user_permission_overrides add constraint "user_permission_overrides_company_id_user_id_permission_key_key" UNIQUE (company_id, user_id, permission_key);
  end if;
  if not exists(select 1 from pg_constraint where conrelid='public.user_permission_overrides'::regclass and conname='user_permission_overrides_pkey') then
    alter table public.user_permission_overrides add constraint "user_permission_overrides_pkey" PRIMARY KEY (id);
  end if;
end $$;
CREATE OR REPLACE FUNCTION public.gridex_can_read_company(p_company_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select p_company_id is not null and (
    public.gridex_user_is_platform_admin()
    or exists (
      select 1
      from public.gridex_user_company_ids() as c(company_id)
      where c.company_id = p_company_id
    )
  )
$function$;
revoke all on function public.gridex_can_read_company(uuid) from public,anon;
grant execute on function public.gridex_can_read_company(uuid) to authenticated,service_role;
CREATE OR REPLACE FUNCTION auth.role()
 RETURNS text
 LANGUAGE sql
 STABLE
AS $function$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$function$;

grant execute on function auth.role() to public;

CREATE OR REPLACE FUNCTION public.gridex_can(p_permission text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
begin
  if p_permission is null or auth.uid() is null then
    return false;
  end if;

  if public.gridex_user_is_platform_admin() then
    return true;
  end if;

  return public.gridex_has_permission(auth.uid(), p_permission);
exception when others then
  return false;
end;
$function$;

CREATE OR REPLACE FUNCTION public.gridex_has_permission(p_user_id uuid, p_permission text)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p_user_id is not null
    and p_permission is not null
    and p_permission = any(public.gridex_get_user_permissions(p_user_id));
$function$;

revoke all on function public.gridex_can(text),public.gridex_has_permission(uuid,text) from public,anon,authenticated;
grant execute on function public.gridex_can(text),public.gridex_has_permission(uuid,text) to service_role;

alter table public."admin_users" enable row level security;
alter table public."admin_users" no force row level security;
grant all on table public."admin_users" to anon,authenticated,service_role;

alter table public."companies" enable row level security;
alter table public."companies" no force row level security;
grant all on table public."companies" to anon,authenticated,service_role;

alter table public."company_memberships" enable row level security;
alter table public."company_memberships" no force row level security;
grant all on table public."company_memberships" to anon,authenticated,service_role;

alter table public."permissions" enable row level security;
alter table public."permissions" no force row level security;
grant all on table public."permissions" to anon,authenticated,service_role;

alter table public."role_permissions" enable row level security;
alter table public."role_permissions" no force row level security;
grant all on table public."role_permissions" to anon,authenticated,service_role;

alter table public."roles" enable row level security;
alter table public."roles" no force row level security;
grant all on table public."roles" to anon,authenticated,service_role;

alter table public."user_permission_overrides" enable row level security;
alter table public."user_permission_overrides" no force row level security;
grant all on table public."user_permission_overrides" to anon,authenticated,service_role;

alter table public."user_permissions" enable row level security;
alter table public."user_permissions" no force row level security;
grant all on table public."user_permissions" to anon,authenticated,service_role;

alter table public."user_roles" enable row level security;
alter table public."user_roles" no force row level security;
grant all on table public."user_roles" to anon,authenticated,service_role;

create policy "admin_users_self_read" on public."admin_users" as PERMISSIVE for SELECT to public using ((( SELECT auth.uid() AS uid) = user_id));

create policy "gridex_db1_companies_insert" on public."companies" as PERMISSIVE for INSERT to public with check (gridex_user_is_platform_admin());

create policy "gridex_db1_companies_member_select" on public."companies" as PERMISSIVE for SELECT to public using ((gridex_user_is_platform_admin() OR (id IN ( SELECT gridex_user_company_ids.gridex_user_company_ids
   FROM gridex_user_company_ids() gridex_user_company_ids(gridex_user_company_ids)))));

create policy "gridex_db1_companies_select" on public."companies" as PERMISSIVE for SELECT to public using (gridex_user_is_platform_admin());

create policy "gridex_db1_companies_update" on public."companies" as PERMISSIVE for UPDATE to public using (gridex_user_is_platform_admin()) with check (gridex_user_is_platform_admin());

create policy "gridex_db3_companies_member_select" on public."companies" as PERMISSIVE for SELECT to public using ((gridex_user_is_platform_admin() OR (id IN ( SELECT c.company_id
   FROM gridex_user_company_ids() c(company_id)))));

create policy "gridex_db3_companies_platform_insert" on public."companies" as PERMISSIVE for INSERT to public with check (gridex_user_is_platform_admin());

create policy "gridex_db3_companies_platform_update" on public."companies" as PERMISSIVE for UPDATE to public using (gridex_user_is_platform_admin()) with check (gridex_user_is_platform_admin());

create policy "gridex_db1_company_memberships_insert" on public."company_memberships" as PERMISSIVE for INSERT to public with check ((gridex_user_is_platform_admin() OR ((company_id IS NOT NULL) AND gridex_can_write_company(company_id))));

create policy "gridex_db1_company_memberships_select" on public."company_memberships" as PERMISSIVE for SELECT to public using ((gridex_user_is_platform_admin() OR ((company_id IS NOT NULL) AND gridex_can_read_company(company_id))));

create policy "gridex_db1_company_memberships_update" on public."company_memberships" as PERMISSIVE for UPDATE to public using ((gridex_user_is_platform_admin() OR ((company_id IS NOT NULL) AND gridex_can_read_company(company_id)))) with check ((gridex_user_is_platform_admin() OR ((company_id IS NOT NULL) AND gridex_can_write_company(company_id))));

create policy "gridex_db3_company_memberships_insert_company" on public."company_memberships" as PERMISSIVE for INSERT to public with check ((gridex_user_is_platform_admin() OR ((company_id IS NOT NULL) AND gridex_can_write_company(company_id))));

create policy "gridex_db3_company_memberships_select_company" on public."company_memberships" as PERMISSIVE for SELECT to public using ((gridex_user_is_platform_admin() OR ((company_id IS NOT NULL) AND gridex_can_read_company(company_id))));

create policy "gridex_db3_company_memberships_update_company" on public."company_memberships" as PERMISSIVE for UPDATE to public using ((gridex_user_is_platform_admin() OR ((company_id IS NOT NULL) AND gridex_can_read_company(company_id)))) with check ((gridex_user_is_platform_admin() OR ((company_id IS NOT NULL) AND gridex_can_write_company(company_id))));

create policy "rbac_permissions_read_authenticated_v1" on public."permissions" as PERMISSIVE for SELECT to public using ((( SELECT auth.role() AS role) = 'authenticated'::text));

create policy "rbac_role_permissions_read_authenticated_v1" on public."role_permissions" as PERMISSIVE for SELECT to public using ((( SELECT auth.role() AS role) = 'authenticated'::text));

create policy "rbac_roles_read_authenticated_v1" on public."roles" as PERMISSIVE for SELECT to public using ((( SELECT auth.role() AS role) = 'authenticated'::text));

create policy "gridex_db1_user_permission_overrides_delete" on public."user_permission_overrides" as PERMISSIVE for DELETE to public using (gridex_user_is_platform_admin());

create policy "gridex_db1_user_permission_overrides_insert" on public."user_permission_overrides" as PERMISSIVE for INSERT to public with check ((gridex_user_is_platform_admin() OR ((company_id IS NOT NULL) AND gridex_can_write_company(company_id))));

create policy "gridex_db1_user_permission_overrides_select" on public."user_permission_overrides" as PERMISSIVE for SELECT to public using ((gridex_user_is_platform_admin() OR ((company_id IS NOT NULL) AND gridex_can_read_company(company_id))));

create policy "gridex_db1_user_permission_overrides_update" on public."user_permission_overrides" as PERMISSIVE for UPDATE to public using ((gridex_user_is_platform_admin() OR ((company_id IS NOT NULL) AND gridex_can_read_company(company_id)))) with check ((gridex_user_is_platform_admin() OR ((company_id IS NOT NULL) AND gridex_can_write_company(company_id))));

create policy "user_permissions_admin_delete" on public."user_permissions" as PERMISSIVE for DELETE to "authenticated" using (gridex_can('admin.access'::text));

create policy "user_permissions_admin_insert" on public."user_permissions" as PERMISSIVE for INSERT to "authenticated" with check (gridex_can('admin.access'::text));

create policy "user_permissions_admin_read" on public."user_permissions" as PERMISSIVE for SELECT to "authenticated" using (gridex_can('admin.access'::text));

create policy "user_permissions_admin_update" on public."user_permissions" as PERMISSIVE for UPDATE to "authenticated" using (gridex_can('admin.access'::text)) with check (gridex_can('admin.access'::text));

create policy "user_permissions_owner_select" on public."user_permissions" as PERMISSIVE for SELECT to public using ((( SELECT auth.uid() AS uid) = user_id));

create policy "rbac_user_roles_read_own_v1" on public."user_roles" as PERMISSIVE for SELECT to public using ((user_id = ( SELECT auth.uid() AS uid)));

-- Defense-in-depth synthetic column ACLs: live catalog had no column ACLs.
-- SELECT grants must survive while INSERT/UPDATE/REFERENCES grants are removed.
grant select (user_id),insert (user_id),update (effect),references (user_id)
  on public.user_permissions to public,anon,authenticated;

create schema gridex_test;
create table gridex_test.rbac_catalog_before as
select c.relname::text as tablename,c.relrowsecurity,c.relforcerowsecurity,
  jsonb_build_object('anon',has_table_privilege('anon',c.oid,'SELECT'),
    'authenticated',has_table_privilege('authenticated',c.oid,'SELECT'),
    'service_role',has_table_privilege('service_role',c.oid,'SELECT'),
    'public',exists(select 1 from aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
      where a.grantee=0 and a.privilege_type='SELECT')) as select_acl,
  coalesce((select jsonb_agg(to_jsonb(p) order by p.polname) from pg_policy p where p.polrelid=c.oid),'[]'::jsonb) as policies,
  (select jsonb_agg(jsonb_build_object('attnum',a.attnum,'attname',a.attname,
    'select_grants',(select jsonb_agg(to_jsonb(x) order by x.grantee,x.grantor,x.is_grantable)
      from aclexplode(a.attacl) x where x.privilege_type='SELECT')) order by a.attnum)
    from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped) as column_select_acl
from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
  and c.relname in('roles','permissions','role_permissions','user_roles','user_permissions','user_permission_overrides','admin_users','companies','company_memberships');
alter table gridex_test.rbac_catalog_before add primary key(tablename);
