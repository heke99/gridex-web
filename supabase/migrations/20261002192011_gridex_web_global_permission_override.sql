-- The legacy direct-grant primary key is (user_id, permission_id), without
-- company_id. A global upsert there could convert a company-scoped grant into
-- a global grant. Keep those company rows unchanged and record global decisions
-- in the explicit override history, serializing on the target/canonical key.
create or replace function public.gridex_web_set_global_permission_override(
  p_actor_id uuid,
  p_user_id uuid,
  p_permission_id uuid,
  p_effect text
) returns jsonb
-- Definer rights are needed only because service_role cannot SELECT auth.users;
-- do not widen Auth table grants. This RPC is callable only by the trusted
-- server service role and checks its supplied, server-verified actor below.
language plpgsql security definer set search_path = ''
as $$
declare
  v_permission_key text;
  v_override_id uuid;
begin
  if p_actor_id is null or p_user_id is null or p_permission_id is null
    or p_effect is null or p_effect not in ('allow', 'deny') then
    raise exception using errcode = '22023', message = 'Actor, user, permission and allow/deny effect are required';
  end if;
  if not exists(select 1 from auth.users where id = p_user_id) then
    raise exception using errcode = 'P0002', message = 'User not found';
  end if;
  select coalesce(nullif(p.key, ''), nullif(p.name, '')) into v_permission_key
  from public.permissions p where p.id = p_permission_id;
  if not found or v_permission_key is null then
    raise exception using errcode = 'P0002', message = 'Permission not found';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'gridex_web_global_override:' || p_user_id::text || ':' || v_permission_key, 0
  ));
  if not ('rbac.write' = any(public.gridex_get_user_permissions(p_actor_id, null::uuid))) then
    raise exception using errcode = '42501', message = 'Global rbac.write is required';
  end if;

  -- A prior GLOBAL legacy deny must not override a later explicit allow.
  -- Never change a company-scoped direct grant, including the same PK pair.
  update public.user_permissions up set is_active = false, status = 'inactive'
  where up.user_id = p_user_id and up.company_id is null and (
    up.permission_id = p_permission_id or up.permission_key = v_permission_key
    or up.permission_id in(select p.id from public.permissions p
      where coalesce(nullif(p.key, ''), nullif(p.name, '')) = v_permission_key)
  );
  update public.user_permission_overrides o
  set is_active = false, updated_at = now(), updated_by = p_actor_id
  where o.user_id = p_user_id and o.company_id is null
    and o.permission_key = v_permission_key and o.is_active;
  insert into public.user_permission_overrides(
    user_id, company_id, permission_key, effect, reason,
    valid_from, valid_to, is_active, created_by, updated_by
  ) values (
    p_user_id, null, v_permission_key, p_effect, 'Web global permission override',
    now(), null, true, p_actor_id, p_actor_id
  ) returning id into v_override_id;
  return jsonb_build_object('id', v_override_id, 'permission_key', v_permission_key, 'effect', p_effect);
end;
$$;
revoke all on function public.gridex_web_set_global_permission_override(uuid,uuid,uuid,text)
  from public, anon, authenticated;
grant execute on function public.gridex_web_set_global_permission_override(uuid,uuid,uuid,text)
  to service_role;
