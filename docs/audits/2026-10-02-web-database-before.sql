-- Sanitized definitions from gridex-prod observed 2026-10-02 before independent Web hardening.
-- No customer/user rows. Reference for review; DO NOT apply as a migration.

CREATE OR REPLACE FUNCTION public.gridex_get_user_permission_overrides(p_user_id uuid)
 RETURNS TABLE(permission_key text, effect text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    upo.permission_key,
    upo.effect
  from public.user_permission_overrides upo
  where upo.user_id = p_user_id
    and coalesce(upo.is_active, true) = true
    and (upo.valid_from is null or upo.valid_from <= now())
    and (upo.valid_to is null or upo.valid_to >= now());
$function$

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
$function$

CREATE OR REPLACE FUNCTION public.gridex_get_user_permissions(p_user_id uuid)
 RETURNS text[]
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with role_based as (
    select distinct coalesce(p.key, p.name) as permission_name
    from public.user_roles ur
    join public.roles r
      on lower(coalesce(r.key, r.name, '')) = lower(coalesce(ur.role, ''))
    join public.role_permissions rp
      on rp.role_id = r.id
    join public.permissions p
      on p.id = rp.permission_id
    where ur.user_id = p_user_id
      and coalesce(ur.is_active, true) = true
      and coalesce(p.key, p.name) is not null
  ),
  direct_permissions as (
    select distinct coalesce(p.key, p.name) as permission_name
    from public.user_permissions up
    join public.permissions p
      on p.id = up.permission_id
    where up.user_id = p_user_id
      and coalesce(p.key, p.name) is not null
  ),
  explicit_platform_admin_fallback as (
    select 'admin.access'::text as permission_name
    where exists (
      select 1
      from public.admin_users au
      where au.user_id = p_user_id
        and coalesce(au.is_active, true) = true
        and lower(coalesce(au.role, '')) in ('super_admin','superadmin','platform_admin')
    )
  )
  select coalesce(array_agg(distinct permission_name order by permission_name), '{}'::text[])
  from (
    select permission_name from role_based
    union
    select permission_name from direct_permissions
    union
    select permission_name from explicit_platform_admin_fallback
  ) q
  where permission_name is not null;
$function$

CREATE OR REPLACE FUNCTION public.gridex_get_user_roles(p_user_id uuid)
 RETURNS TABLE(role_key text, key text, code text, name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    coalesce(nullif(r.key, ''), nullif(ur.role, ''), nullif(r.name, '')) as role_key,
    coalesce(nullif(r.key, ''), nullif(ur.role, ''), nullif(r.name, '')) as key,
    coalesce(nullif(r.key, ''), nullif(ur.role, ''), nullif(r.name, '')) as code,
    coalesce(nullif(r.name, ''), nullif(r.key, ''), nullif(ur.role, '')) as name
  from public.user_roles ur
  left join public.roles r on r.id = ur.role_id
  where ur.user_id = p_user_id
    and coalesce(ur.is_active, true) = true
    and coalesce(ur.status, 'active') = 'active'

  union

  select
    coalesce(nullif(cm.role_key, ''), nullif(cm.membership_role::text, ''), nullif(cm.role, '')) as role_key,
    coalesce(nullif(cm.role_key, ''), nullif(cm.membership_role::text, ''), nullif(cm.role, '')) as key,
    coalesce(nullif(cm.role_key, ''), nullif(cm.membership_role::text, ''), nullif(cm.role, '')) as code,
    coalesce(nullif(cm.role_key, ''), nullif(cm.membership_role::text, ''), nullif(cm.role, '')) as name
  from public.company_memberships cm
  where cm.user_id = p_user_id
    and coalesce(cm.is_active, true) = true
    and coalesce(cm.status, 'active') = 'active';
$function$

CREATE OR REPLACE FUNCTION public.gridex_user_company_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select cm.company_id
  from public.company_memberships cm
  join public.companies c on c.id = cm.company_id
  where cm.user_id = auth.uid()
    and coalesce(cm.status, 'active') = 'active'
    and coalesce(cm.is_active, true) = true
    and coalesce(c.is_active, true) = true
    and coalesce(c.status, 'active') not in ('archived','suspended','pending_deletion')
$function$

CREATE OR REPLACE FUNCTION public.gridex_user_has_role_key(p_role_key text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  has_role_id boolean := false;
  has_role_text boolean := false;
  has_role_key boolean := false;
  has_status boolean := false;
  has_is_active boolean := false;
  sql text;
  result boolean := false;
begin
  if p_role_key is null or auth.uid() is null then
    return false;
  end if;
  if to_regclass('public.user_roles') is null then
    return false;
  end if;

  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_roles' and column_name='role_id') into has_role_id;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_roles' and column_name='role') into has_role_text;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_roles' and column_name='role_key') into has_role_key;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_roles' and column_name='status') into has_status;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_roles' and column_name='is_active') into has_is_active;

  sql := 'select exists (select 1 from public.user_roles ur ';
  if has_role_id and to_regclass('public.roles') is not null then
    sql := sql || 'left join public.roles r on r.id = ur.role_id ';
  end if;
  sql := sql || 'where ur.user_id = $1 and (';

  if has_role_text then
    sql := sql || 'lower(coalesce(ur.role, '''')) = lower($2)';
  else
    sql := sql || 'false';
  end if;
  if has_role_key then
    sql := sql || ' or lower(coalesce(ur.role_key, '''')) = lower($2)';
  end if;
  if has_role_id and to_regclass('public.roles') is not null then
    sql := sql || ' or lower(coalesce(r.key, r.name, '''')) = lower($2)';
  end if;
  sql := sql || ')';

  if has_status then
    sql := sql || ' and coalesce(ur.status, ''active'') = ''active''';
  end if;
  if has_is_active then
    sql := sql || ' and coalesce(ur.is_active, true) = true';
  end if;

  sql := sql || ')';
  execute sql into result using auth.uid(), p_role_key;
  return coalesce(result, false);
exception when others then
  return false;
end;
$function$

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
$function$

-- customer_profiles: customer_profiles_owner_insert FOR INSERT TO {public}
-- USING: null
-- WITH CHECK: (( SELECT auth.uid() AS uid) = user_id)
-- customer_profiles: customer_profiles_owner_select FOR SELECT TO {public}
-- USING: (( SELECT auth.uid() AS uid) = user_id)
-- WITH CHECK: null
-- customer_profiles: customer_profiles_owner_update FOR UPDATE TO {public}
-- USING: (( SELECT auth.uid() AS uid) = user_id)
-- WITH CHECK: (( SELECT auth.uid() AS uid) = user_id)
-- customer_support_messages: customer_support_messages_admin_insert FOR INSERT TO {public}
-- USING: null
-- WITH CHECK: (gridex_has_permission(( SELECT auth.uid() AS uid), 'support_tickets.manage'::text) OR gridex_has_permission(( SELECT auth.uid() AS uid), 'admin.access'::text))
-- customer_support_messages: customer_support_messages_admin_select FOR SELECT TO {public}
-- USING: (gridex_has_permission(( SELECT auth.uid() AS uid), 'support_tickets.manage'::text) OR gridex_has_permission(( SELECT auth.uid() AS uid), 'admin.access'::text))
-- WITH CHECK: null
-- customer_support_messages: customer_support_messages_owner_insert FOR INSERT TO {public}
-- USING: null
-- WITH CHECK: ((sender_user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM customer_support_tickets t
  WHERE ((t.id = customer_support_messages.ticket_id) AND (t.user_id = ( SELECT auth.uid() AS uid))))))
-- customer_support_messages: customer_support_messages_owner_select FOR SELECT TO {public}
-- USING: (EXISTS ( SELECT 1
   FROM customer_support_tickets t
  WHERE ((t.id = customer_support_messages.ticket_id) AND (t.user_id = ( SELECT auth.uid() AS uid)))))
-- WITH CHECK: null
-- customer_support_tickets: customer_support_tickets_admin_select FOR SELECT TO {public}
-- USING: (gridex_has_permission(( SELECT auth.uid() AS uid), 'support_tickets.manage'::text) OR gridex_has_permission(( SELECT auth.uid() AS uid), 'admin.access'::text))
-- WITH CHECK: null
-- customer_support_tickets: customer_support_tickets_admin_update FOR UPDATE TO {public}
-- USING: (gridex_has_permission(( SELECT auth.uid() AS uid), 'support_tickets.manage'::text) OR gridex_has_permission(( SELECT auth.uid() AS uid), 'admin.access'::text))
-- WITH CHECK: (gridex_has_permission(( SELECT auth.uid() AS uid), 'support_tickets.manage'::text) OR gridex_has_permission(( SELECT auth.uid() AS uid), 'admin.access'::text))
-- customer_support_tickets: customer_support_tickets_owner_all FOR ALL TO {public}
-- USING: (( SELECT auth.uid() AS uid) = user_id)
-- WITH CHECK: (( SELECT auth.uid() AS uid) = user_id)
-- user_profiles: user_profiles_admin_read FOR SELECT TO {authenticated}
-- USING: gridex_can('admin.access'::text)
-- WITH CHECK: null
-- user_profiles: user_profiles_admin_update FOR UPDATE TO {authenticated}
-- USING: gridex_can('admin.access'::text)
-- WITH CHECK: gridex_can('admin.access'::text)
-- user_profiles: user_profiles_owner_insert FOR INSERT TO {public}
-- USING: null
-- WITH CHECK: (( SELECT auth.uid() AS uid) = user_id)
-- user_profiles: user_profiles_owner_select FOR SELECT TO {public}
-- USING: (( SELECT auth.uid() AS uid) = user_id)
-- WITH CHECK: null
-- user_profiles: user_profiles_owner_update FOR UPDATE TO {public}
-- USING: (( SELECT auth.uid() AS uid) = user_id)
-- WITH CHECK: (( SELECT auth.uid() AS uid) = user_id)
-- Original table ACL customer_profiles: {postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}
-- Original table ACL customer_support_messages: {postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}
-- Original table ACL customer_support_tickets: {postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}
-- Original table ACL user_profiles: {postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}
