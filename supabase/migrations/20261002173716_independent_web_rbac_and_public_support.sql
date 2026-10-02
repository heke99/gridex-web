-- Web is an independent OPS API tenant. Authenticated cases live in OPS;
-- these local support tables retain historical records and anonymous enquiries.
-- Keep all arbitrary-user authorization RPCs server-only.

create or replace function public.gridex_get_user_roles(p_user_id uuid, p_company_id uuid)
returns table(role_key text, key text, code text, name text)
language sql stable security definer set search_path = ''
as $$
  with scope as (
    select cm.company_id, cm.role_id, cm.role_key, cm.membership_role, cm.role
    from public.company_memberships cm join public.companies c on c.id = cm.company_id
    where p_company_id is not null and cm.company_id = p_company_id and cm.user_id = p_user_id
      and coalesce(cm.is_active, true) and coalesce(cm.status, 'active') = 'active'
      and coalesce(c.is_active, true) and coalesce(c.status, 'active') in ('active', 'onboarding')
  ), assigned as (
    select coalesce(nullif(r.key, ''), nullif(r.name, ''), nullif(ur.role, '')) as role_key,
      coalesce(nullif(r.name, ''), nullif(r.key, ''), nullif(ur.role, '')) as name
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id or
      (ur.role_id is null and lower(coalesce(r.key, r.name, '')) = lower(ur.role))
    where ur.user_id = p_user_id and coalesce(ur.is_active, true)
      and not exists (select 1 from public.user_profiles up where (up.user_id = p_user_id or up.id = p_user_id)
        and coalesce(up.user_status, 'active') <> 'active')
      and coalesce(ur.status, 'active') = 'active' and r.is_active
      and (ur.company_id is null or (ur.company_id = p_company_id and exists(select 1 from scope)))
    union
    select coalesce(nullif(r.key, ''), nullif(r.name, '')),
      coalesce(nullif(r.name, ''), nullif(r.key, ''))
    from scope s join public.roles r
      on r.id = s.role_id or (s.role_id is null and lower(coalesce(r.key, r.name, '')) =
        lower(coalesce(nullif(s.role_key, ''), nullif(nullif(s.membership_role, ''),'member'),nullif(s.role,''),s.membership_role)))
    where r.is_active and not exists (select 1 from public.user_profiles up where (up.user_id = p_user_id or up.id = p_user_id)
      and coalesce(up.user_status, 'active') <> 'active')
  ) select distinct a.role_key, a.role_key, a.role_key, a.name from assigned a where a.role_key is not null;
$$;

create or replace function public.gridex_get_user_roles(p_user_id uuid)
returns table(role_key text, key text, code text, name text)
language sql stable security definer set search_path = ''
as $$ select * from public.gridex_get_user_roles(p_user_id, null::uuid); $$;

create or replace function public.gridex_get_user_permission_overrides(p_user_id uuid, p_company_id uuid)
returns table(permission_key text, effect text, valid_from timestamptz, valid_to timestamptz, is_active boolean)
language sql volatile security definer set search_path = ''
as $$
  -- Validity is evaluated when authorization actually runs, including a caller
  -- that waited for a transaction lock. now() would freeze request-start time.
  with current_clock as materialized(select clock_timestamp() as at), scope as (
    select 1 from public.company_memberships cm join public.companies c on c.id = cm.company_id
    where p_company_id is not null and cm.company_id = p_company_id and cm.user_id = p_user_id
      and coalesce(cm.is_active, true) and coalesce(cm.status, 'active') = 'active'
      and coalesce(c.is_active, true) and coalesce(c.status, 'active') in ('active', 'onboarding')
  )
  select o.permission_key, o.effect, o.valid_from, o.valid_to, o.is_active
  from public.user_permission_overrides o cross join current_clock c
  where o.user_id = p_user_id and o.is_active
    and not exists (select 1 from public.user_profiles up where (up.user_id = p_user_id or up.id = p_user_id)
      and coalesce(up.user_status, 'active') <> 'active')
    and (o.company_id is null or (o.company_id = p_company_id and exists(select 1 from scope)))
    and (o.valid_from is null or o.valid_from <= c.at) and (o.valid_to is null or o.valid_to > c.at)
  union all
  select coalesce(nullif(up.permission_key, ''), p.key, p.name), coalesce(up.effect, 'allow'),
    null::timestamptz, null::timestamptz, true
  from public.user_permissions up join public.permissions p on p.id = up.permission_id
  where up.user_id = p_user_id and coalesce(up.is_active, true) and coalesce(up.status, 'active') = 'active'
    and not exists (select 1 from public.user_profiles profile where (profile.user_id = p_user_id or profile.id = p_user_id)
      and coalesce(profile.user_status, 'active') <> 'active')
    and (up.company_id is null or (up.company_id = p_company_id and exists(select 1 from scope)));
$$;

create or replace function public.gridex_get_user_permission_overrides(p_user_id uuid)
returns table(permission_key text, effect text)
language sql volatile security definer set search_path = ''
as $$ select o.permission_key,o.effect from public.gridex_get_user_permission_overrides(p_user_id, null::uuid) o; $$;

create or replace function public.gridex_get_user_permissions(p_user_id uuid, p_company_id uuid)
returns text[] language sql volatile security definer set search_path = ''
as $$
  with role_grants as (
    select coalesce(p.key, p.name) as permission_key
    from public.gridex_get_user_roles(p_user_id, p_company_id) u
    join public.roles r on coalesce(r.key, r.name) = u.role_key
    join public.role_permissions rp on rp.role_id = r.id
    join public.permissions p on p.id = rp.permission_id
  ), overrides as (
    select * from public.gridex_get_user_permission_overrides(p_user_id, p_company_id)
  ), allowed as (
    select permission_key from role_grants
    union select permission_key from overrides where effect = 'allow'
  )
  select coalesce(array_agg(distinct a.permission_key order by a.permission_key), '{}'::text[])
  from allowed a where a.permission_key is not null and not exists (
    select 1 from overrides o where o.permission_key = a.permission_key and o.effect = 'deny'
  );
$$;

create or replace function public.gridex_get_user_permissions(p_user_id uuid)
returns text[] language sql volatile security definer set search_path = ''
as $$ select public.gridex_get_user_permissions(p_user_id, null::uuid); $$;

revoke all on function public.gridex_get_user_roles(uuid,uuid), public.gridex_get_user_roles(uuid),
  public.gridex_get_user_permissions(uuid,uuid), public.gridex_get_user_permissions(uuid),
  public.gridex_get_user_permission_overrides(uuid,uuid), public.gridex_get_user_permission_overrides(uuid)
  from public, anon, authenticated;
grant execute on function public.gridex_get_user_roles(uuid,uuid), public.gridex_get_user_roles(uuid),
  public.gridex_get_user_permissions(uuid,uuid), public.gridex_get_user_permissions(uuid),
  public.gridex_get_user_permission_overrides(uuid,uuid), public.gridex_get_user_permission_overrides(uuid)
  to service_role;

-- Console entry never implies permission to change users, RBAC or pricing.
insert into public.permissions(name,key,description)
select p,p,'Independent Web operation permission' from unnest(array[
  'support_tickets.read','support_tickets.reply','support_tickets.manage',
  'users.read','users.write','rbac.read','rbac.write',
  'spot.read','spot.publish','portfolio.read',
  'agreements.read','agreements.write','agreements.export',
  'integrations.read','integrations.write','cis.sync.write','cis.signature.write',
  'billing.read','settlements.read','incidents.read','audit.read','compliance.read'
]) p where not exists (select 1 from public.permissions x where x.key = p or x.name = p);

with additions(role_key,permission_key) as (
  select 'super_admin',p from unnest(array[
    'support_tickets.read','support_tickets.reply','support_tickets.manage','users.read','users.write','rbac.read','rbac.write',
    'spot.read','spot.publish','portfolio.read','agreements.read','agreements.write','agreements.export',
    'integrations.read','integrations.write','cis.sync.write','cis.signature.write','billing.read','settlements.read',
    'incidents.read','audit.read','compliance.read'
  ]) p union all
  select 'admin',p from unnest(array[
    'support_tickets.read','support_tickets.reply','support_tickets.manage','users.read','users.write','rbac.read','rbac.write',
    'spot.read','spot.publish','portfolio.read','agreements.read','agreements.write','agreements.export',
    'integrations.read','integrations.write','cis.sync.write','cis.signature.write','billing.read','settlements.read',
    'incidents.read','audit.read','compliance.read'
  ]) p union all
  select 'customer_service_agent',p from unnest(array['support_tickets.read','support_tickets.reply']) p union all
  select 'customer_service_manager',p from unnest(array['admin.access','support_tickets.read','support_tickets.reply','support_tickets.manage']) p union all
  select 'pricing_manager',p from unnest(array['spot.read','portfolio.read']) p union all
  select 'pricing_approver',p from unnest(array['spot.read','spot.publish','portfolio.read']) p union all
  select 'compliance_manager',p from unnest(array['audit.read','compliance.read']) p
)
insert into public.role_permissions(role_id,permission_id,role_key,permission_key)
select r.id,p.id,a.role_key,a.permission_key from additions a
join public.roles r on coalesce(r.key,r.name) = a.role_key
join public.permissions p on coalesce(p.key,p.name) = a.permission_key
on conflict (role_id,permission_id) do nothing;

-- Only a caller's own global Web permissions are used by local prospect RLS.
-- This schema is not exposed through PostgREST; the helper accepts no user ID.
create schema if not exists gridex_web_private;
revoke all on schema gridex_web_private from public, anon;
grant usage on schema gridex_web_private to authenticated, service_role;
create or replace function gridex_web_private.can(p_permission text)
returns boolean language sql volatile security definer set search_path = ''
as $$ select auth.uid() is not null and p_permission = any(public.gridex_get_user_permissions(auth.uid(),null::uuid)); $$;
revoke all on function gridex_web_private.can(text) from public, anon;
grant execute on function gridex_web_private.can(text) to authenticated, service_role;

create or replace function gridex_web_private.active_user()
returns boolean language sql stable security definer set search_path = ''
as $$ select auth.uid() is not null and not exists (
  select 1 from public.user_profiles p where (p.user_id = auth.uid() or p.id = auth.uid())
    and coalesce(p.user_status,'active') <> 'active'
); $$;
revoke all on function gridex_web_private.active_user() from public,anon;
grant execute on function gridex_web_private.active_user() to authenticated,service_role;

-- Block disabled accounts even while their previously issued JWT is unexpired.
-- Keep these self-identity helpers callable: existing company RLS depends on them.
create or replace function public.gridex_user_is_platform_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select gridex_web_private.active_user() and (
  exists(select 1 from public.admin_users a where a.user_id=auth.uid() and coalesce(a.is_active,true)
    and lower(coalesce(a.role,'')) in('super_admin','superadmin','platform_admin'))
  or exists(select 1 from public.user_roles u join public.roles r on r.id=u.role_id or
    (u.role_id is null and lower(coalesce(r.key,r.name,''))=lower(u.role))
    where u.user_id=auth.uid() and u.company_id is null and coalesce(u.is_active,true)
      and coalesce(u.status,'active')='active' and r.is_active
      and lower(coalesce(r.key,r.name,'')) in('super_admin','superadmin','platform_admin'))
); $$;
create or replace function public.gridex_user_company_ids()
returns setof uuid language sql stable security definer set search_path = ''
as $$ select m.company_id from public.company_memberships m join public.companies c on c.id=m.company_id
  where gridex_web_private.active_user() and m.user_id=auth.uid() and coalesce(m.status,'active')='active'
    and coalesce(m.is_active,true) and coalesce(c.is_active,true)
    and coalesce(c.status,'active') not in('archived','suspended','pending_deletion'); $$;
create or replace function public.gridex_can_write_company(p_company_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select gridex_web_private.active_user() and p_company_id is not null and (
  public.gridex_user_is_platform_admin() or exists (
    select 1 from public.company_memberships m join public.companies c on c.id=m.company_id
    where m.company_id=p_company_id and m.user_id=auth.uid() and coalesce(m.status,'active')='active'
      and coalesce(m.is_active,true) and coalesce(c.is_active,true) and coalesce(c.status,'active') in('active','onboarding')
      and lower(coalesce(m.membership_role,m.role,'')) in
        ('owner','admin','company_admin','company_owner','tenant_admin','operations_manager','customer_service_manager')
  )
); $$;
create or replace function public.gridex_user_has_role_key(p_role_key text)
returns boolean language sql stable security definer set search_path = ''
as $$ select gridex_web_private.active_user() and p_role_key is not null and exists(
  select 1 from public.user_roles u join public.roles r on r.id=u.role_id or
    (u.role_id is null and lower(coalesce(r.key,r.name,''))=lower(u.role))
  where u.user_id=auth.uid() and coalesce(u.is_active,true) and coalesce(u.status,'active')='active' and r.is_active
    and lower(coalesce(r.key,r.name,''))=lower(p_role_key)
    and (u.company_id is null or u.company_id in(select public.gridex_user_company_ids()))
); $$;
revoke all on function public.gridex_user_is_platform_admin(), public.gridex_user_company_ids(),
  public.gridex_can_write_company(uuid), public.gridex_user_has_role_key(text) from public,anon;
grant execute on function public.gridex_user_is_platform_admin(), public.gridex_user_company_ids(),
  public.gridex_can_write_company(uuid), public.gridex_user_has_role_key(text) to authenticated,service_role;

-- An owner can edit their account name/contact, never authorization or verification.
-- Auth/admin synchronization continues through its existing service-role path.
drop policy if exists user_profiles_admin_read on public.user_profiles;
drop policy if exists user_profiles_admin_update on public.user_profiles;
revoke all on public.user_profiles from public,anon,authenticated;
grant select on public.user_profiles to authenticated;
grant insert(id,user_id,full_name,phone), update(id,user_id,full_name,phone) on public.user_profiles to authenticated;

-- Canonical customer identifiers drive authenticated OPS headers. Browser edits
-- must not redirect a session to a different upstream customer or tenant.
drop policy if exists customer_profiles_owner_insert on public.customer_profiles;
drop policy if exists customer_profiles_owner_update on public.customer_profiles;
revoke all on public.customer_profiles from public,anon,authenticated;
grant select on public.customer_profiles to authenticated;

drop policy if exists customer_support_tickets_owner_all on public.customer_support_tickets;
drop policy if exists customer_support_tickets_admin_select on public.customer_support_tickets;
drop policy if exists customer_support_tickets_admin_update on public.customer_support_tickets;
drop policy if exists customer_support_messages_owner_select on public.customer_support_messages;
drop policy if exists customer_support_messages_owner_insert on public.customer_support_messages;
drop policy if exists customer_support_messages_admin_select on public.customer_support_messages;
drop policy if exists customer_support_messages_admin_insert on public.customer_support_messages;

create policy customer_support_tickets_history_select on public.customer_support_tickets
for select to authenticated using ((select auth.uid()) = user_id);
create policy customer_support_messages_history_select on public.customer_support_messages
for select to authenticated using (not is_internal_note and exists (
  select 1 from public.customer_support_tickets t where t.id = ticket_id and t.user_id = (select auth.uid())
));
create policy customer_support_tickets_prospect_select on public.customer_support_tickets
for select to authenticated using (user_id is null and metadata->>'source' = 'public_kundservice_form'
  and (select gridex_web_private.can('support_tickets.read')));
create policy customer_support_tickets_prospect_update on public.customer_support_tickets
for update to authenticated using (user_id is null and metadata->>'source' = 'public_kundservice_form'
  and (select gridex_web_private.can('support_tickets.manage')))
with check (user_id is null and metadata->>'source' = 'public_kundservice_form'
  and (select gridex_web_private.can('support_tickets.manage')));
create policy customer_support_messages_prospect_select on public.customer_support_messages
for select to authenticated using ((select gridex_web_private.can('support_tickets.read')) and exists (
  select 1 from public.customer_support_tickets t where t.id = ticket_id and t.user_id is null
    and t.metadata->>'source' = 'public_kundservice_form'
));
create policy customer_support_messages_prospect_insert on public.customer_support_messages
for insert to authenticated with check (sender_type = 'agent' and sender_user_id = (select auth.uid())
  and (select gridex_web_private.can('support_tickets.reply')) and exists (
    select 1 from public.customer_support_tickets t where t.id = ticket_id and t.user_id is null
      and t.metadata->>'source' = 'public_kundservice_form'
  ));
revoke all on public.customer_support_tickets,public.customer_support_messages from public,anon;
revoke insert,delete,truncate,references,trigger on public.customer_support_tickets from authenticated;
revoke update,delete,truncate,references,trigger on public.customer_support_messages from authenticated;
grant select,update on public.customer_support_tickets to authenticated;
grant select,insert on public.customer_support_messages to authenticated;

create index if not exists idx_customer_support_tickets_assigned_user on public.customer_support_tickets(assigned_user_id);
create index if not exists idx_customer_support_tickets_portal_contract on public.customer_support_tickets(portal_contract_id);
create index if not exists idx_customer_support_messages_sender_user on public.customer_support_messages(sender_user_id);
create index if not exists idx_customer_support_tickets_prospect_status_created
  on public.customer_support_tickets(status,created_at desc,id) where user_id is null and metadata->>'source' = 'public_kundservice_form';
create index if not exists idx_role_permissions_permission on public.role_permissions(permission_id);
create index if not exists idx_user_permissions_permission on public.user_permissions(permission_id);

-- One database transaction prevents a contact with a missing initial message.
-- Email delivery is not queued: the former system_emails target does not exist.
create or replace function public.gridex_create_public_support_contact(
  p_request_id uuid,p_name text,p_email text,p_phone text,p_category text,p_subject text,p_message text,p_ip_hash text
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_ticket public.customer_support_tickets%rowtype;
  v_request text := 'public:' || p_request_id::text;
  v_payload jsonb := jsonb_build_object('name',btrim(p_name),'email',lower(btrim(p_email)),
    'phone',nullif(btrim(p_phone),''),'category',btrim(p_category),'subject',btrim(p_subject),'message',btrim(p_message));
begin
  if p_request_id is null or nullif(btrim(p_name),'') is null or length(btrim(p_name)) > 120
    or nullif(btrim(p_email),'') is null or length(btrim(p_email)) > 180
    or btrim(p_email) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or length(coalesce(p_phone,'')) > 60 or nullif(btrim(p_category),'') is null or length(p_category) > 80
    or nullif(btrim(p_subject),'') is null or length(p_subject) > 180
    or nullif(btrim(p_message),'') is null or length(p_message) > 4000 or length(coalesce(p_ip_hash,'')) > 128 then
    raise exception using errcode='22023',message='PUBLIC_SUPPORT_INVALID_REQUEST';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_request,0));
  select * into v_ticket from public.customer_support_tickets where client_request_id = v_request;
  if found then
    if v_ticket.metadata->'contact_payload' is distinct from v_payload then
      raise exception using errcode='22023',message='PUBLIC_SUPPORT_IDEMPOTENCY_CONFLICT';
    end if;
    return v_ticket.id;
  end if;
  insert into public.customer_support_tickets(user_id,subject,description,category,priority,status,client_request_id,metadata)
  values (null,btrim(p_subject),btrim(p_message),btrim(p_category),'normal','open',v_request,
    jsonb_build_object('source','public_kundservice_form','customer_name',btrim(p_name),'customer_email',lower(btrim(p_email)),
      'customer_phone',nullif(btrim(p_phone),''),'ip_hash',nullif(p_ip_hash,''),'contact_payload',v_payload))
  returning * into v_ticket;
  insert into public.customer_support_messages(ticket_id,sender_user_id,sender_type,body,client_request_id,is_internal_note)
  values(v_ticket.id,null,'customer',btrim(p_message),v_request || ':initial-message',false);
  return v_ticket.id;
end;
$$;
revoke all on function public.gridex_create_public_support_contact(uuid,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.gridex_create_public_support_contact(uuid,text,text,text,text,text,text,text) to service_role;
