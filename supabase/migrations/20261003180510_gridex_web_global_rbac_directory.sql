-- Read the global assignment directory in one statement snapshot. Every filter
-- runs before pagination, and only that page's global assignment details return.
create or replace function public.gridex_web_list_global_rbac_users(
  p_actor_id uuid,
  p_query text default null,
  p_role_id uuid default null,
  p_active boolean default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb language plpgsql volatile security invoker set search_path = ''
as $$
declare
  v_query text := nullif(btrim(p_query),'');
  v_result jsonb;
begin
  if p_actor_id is null or not coalesce('rbac.write'=any(public.gridex_get_user_permissions(p_actor_id,null::uuid)),false) then
    raise exception using errcode='42501',message='RBAC_GLOBAL_WRITE_REQUIRED';
  end if;
  if p_limit is null or p_limit<1 or p_limit>200 or p_offset is null or p_offset<0
    or length(v_query)>200 then
    raise exception using errcode='22023',message='RBAC_DIRECTORY_INVALID_FILTER';
  end if;

  with filtered as materialized (
    select profile.id,profile.email,profile.full_name,profile.created_at
    from public.user_profiles profile
    where (v_query is null
      or strpos(lower(coalesce(profile.email,'')),lower(v_query))>0
      or strpos(lower(coalesce(profile.full_name,'')),lower(v_query))>0)
      and (p_role_id is null or exists (
        select 1 from gridex_web_private.assigned_roles(profile.id,null::uuid) r where r.role_id=p_role_id
      ))
      and (p_active is null or p_active=exists (
        select 1 from gridex_web_private.assigned_roles(profile.id,null::uuid)
      ))
  ), page as materialized (
    select * from filtered order by created_at desc nulls last,id desc limit p_limit offset p_offset
  )
  select jsonb_build_object(
    'users',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc nulls last,p.id desc) from page p),'[]'::jsonb),
    'total',(select count(*) from filtered),
    'user_roles',coalesce((
      select jsonb_agg(jsonb_build_object('user_id',u.user_id,'role',u.role,'role_id',u.role_id,'is_active',u.is_active,'status',u.status)
        order by u.user_id,u.role_id,u.role)
      from public.user_roles u where u.company_id is null and u.user_id in(select id from page)
    ),'[]'::jsonb),
    'user_permissions',coalesce((
      select jsonb_agg(jsonb_build_object('user_id',u.user_id,'permission_id',u.permission_id,'effect',u.effect,'is_active',u.is_active,'status',u.status)
        order by u.user_id,u.permission_id)
      from public.user_permissions u where u.company_id is null and u.user_id in(select id from page)
    ),'[]'::jsonb),
    'user_permission_overrides',coalesce((
      select jsonb_agg(jsonb_build_object('user_id',u.user_id,'permission_key',u.permission_key,'effect',u.effect,
        'is_active',u.is_active,'valid_from',u.valid_from,'valid_to',u.valid_to)
        order by u.user_id,u.permission_key,u.valid_from)
      from public.user_permission_overrides u where u.company_id is null and u.user_id in(select id from page)
    ),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.gridex_web_list_global_rbac_users(uuid,text,uuid,boolean,integer,integer)
  from public,anon,authenticated;
grant execute on function public.gridex_web_list_global_rbac_users(uuid,text,uuid,boolean,integer,integer)
  to service_role;
