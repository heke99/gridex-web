-- REFERENCE ONLY: exact production RBAC catalog 2026-10-02; no user data.
-- Do not execute this audit snapshot as a migration.

-- Auth/profile triggers: only assign_default_role writes any of the nine
-- protected tables, and it runs as SECURITY DEFINER. The invoker identity-sync
-- trigger only edits NEW and does not access these relations.
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.user_profiles (id, user_id, email)
  values (new.id, new.id, new.email)
  on conflict (id) do update
    set email = coalesce(excluded.email, public.user_profiles.email),
        user_id = excluded.user_id,
        updated_at = now();

  return new;
end;
$function$;

CREATE TRIGGER on_user_profile_created AFTER INSERT ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION assign_default_role();
CREATE OR REPLACE FUNCTION public.assign_default_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
begin
  insert into user_roles (user_id, role)
  values (new.id, 'staff');
  return new;
end;
$function$;

CREATE TRIGGER trg_user_profiles_identity_sync BEFORE INSERT OR UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION sync_user_profiles_identity();
CREATE OR REPLACE FUNCTION public.sync_user_profiles_identity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
begin
  if new.id is null and new.user_id is not null then
    new.id := new.user_id;
  end if;

  if new.user_id is null and new.id is not null then
    new.user_id := new.id;
  end if;

  if new.id is not null and new.user_id is not null and new.id <> new.user_id then
    raise exception 'user_profiles identity mismatch: id and user_id must match';
  end if;

  new.updated_at := now();
  return new;
end;
$function$;
-- Original columns had no column-specific ACLs. PostgreSQL 17.6 table grants
-- included INSERT/SELECT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN
-- for anon, authenticated, service_role; RLS enabled and not forced on all nine.

-- admin_users: ACL ["postgres=arwdDxtm/postgres","anon=arwdDxtm/postgres","authenticated=arwdDxtm/postgres","service_role=arwdDxtm/postgres"]
-- companies: ACL ["postgres=arwdDxtm/postgres","anon=arwdDxtm/postgres","authenticated=arwdDxtm/postgres","service_role=arwdDxtm/postgres"]
-- company_memberships: ACL ["postgres=arwdDxtm/postgres","anon=arwdDxtm/postgres","authenticated=arwdDxtm/postgres","service_role=arwdDxtm/postgres"]
-- permissions: ACL ["postgres=arwdDxtm/postgres","anon=arwdDxtm/postgres","authenticated=arwdDxtm/postgres","service_role=arwdDxtm/postgres"]
-- role_permissions: ACL ["postgres=arwdDxtm/postgres","anon=arwdDxtm/postgres","authenticated=arwdDxtm/postgres","service_role=arwdDxtm/postgres"]
-- roles: ACL ["postgres=arwdDxtm/postgres","anon=arwdDxtm/postgres","authenticated=arwdDxtm/postgres","service_role=arwdDxtm/postgres"]
-- user_permission_overrides: ACL ["postgres=arwdDxtm/postgres","anon=arwdDxtm/postgres","authenticated=arwdDxtm/postgres","service_role=arwdDxtm/postgres"]
-- user_permissions: ACL ["postgres=arwdDxtm/postgres","anon=arwdDxtm/postgres","authenticated=arwdDxtm/postgres","service_role=arwdDxtm/postgres"]
-- user_roles: ACL ["postgres=arwdDxtm/postgres","anon=arwdDxtm/postgres","authenticated=arwdDxtm/postgres","service_role=arwdDxtm/postgres"]

-- ACL ["postgres=X/postgres","service_role=X/postgres"]
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

-- ACL ["postgres=X/postgres","authenticated=X/postgres","service_role=X/postgres"]
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

-- ACL ["postgres=X/postgres","authenticated=X/postgres","service_role=X/postgres"]
CREATE OR REPLACE FUNCTION public.gridex_can_write_company(p_company_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select p_company_id is not null and (
    public.gridex_user_is_platform_admin()
    or exists (
      select 1
      from public.company_memberships cm
      join public.companies c on c.id = cm.company_id
      where cm.company_id = p_company_id
        and cm.user_id = auth.uid()
        and coalesce(cm.status, 'active') = 'active'
        and coalesce(cm.is_active, true) = true
        and coalesce(c.is_active, true) = true
        and coalesce(c.status, 'active') in ('active','onboarding')
        and lower(coalesce(cm.membership_role, cm.role, '')) in (
          'owner','admin','company_admin','company_owner','tenant_admin','operations_manager','customer_service_manager'
        )
    )
  )
$function$;

-- ACL ["postgres=X/postgres","authenticated=X/postgres","service_role=X/postgres"]
CREATE OR REPLACE FUNCTION public.gridex_user_is_platform_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_result boolean := false;
begin
  if auth.uid() is null then
    return false;
  end if;

  if to_regclass('public.admin_users') is not null then
    begin
      select exists (
        select 1
        from public.admin_users au
        where au.user_id = auth.uid()
          and coalesce(au.is_active, true) = true
          and lower(coalesce(au.role, '')) in ('super_admin','superadmin','platform_admin')
      ) into v_result;
      if coalesce(v_result, false) then return true; end if;
    exception when undefined_table or undefined_column then
      null;
    end;
  end if;

  if to_regclass('public.user_roles') is not null then
    begin
      select exists (
        select 1
        from public.user_roles ur
        left join public.roles r on r.id = ur.role_id
        where ur.user_id = auth.uid()
          and coalesce(ur.is_active, true) = true
          and coalesce(ur.status, 'active') = 'active'
          and lower(coalesce(r.key, r.name, ur.role, '')) in ('super_admin','superadmin','platform_admin')
      ) into v_result;
      if coalesce(v_result, false) then return true; end if;
    exception when undefined_table or undefined_column then
      null;
    end;
  end if;

  return false;
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
