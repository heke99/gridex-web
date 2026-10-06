begin;
alter table public.contract_pricing_versions add column if not exists created_by uuid references auth.users(id), add column if not exists published_by uuid references auth.users(id);
create index if not exists contract_pricing_versions_created_by_idx on public.contract_pricing_versions(created_by);
create index if not exists contract_pricing_versions_published_by_idx on public.contract_pricing_versions(published_by);

create or replace function public.gridex_save_pricing_rows_v1(p_version_id uuid,p_actor uuid,p_rows jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.contract_pricing_versions%rowtype;
begin
  if not (public.gridex_has_permission(p_actor,'admin.access') or public.gridex_has_permission(p_actor,'pricing.publish') or public.gridex_has_permission(p_actor,'pricing.manage') or public.gridex_has_permission(p_actor,'pricing.write') or exists(select 1 from public.admin_users where user_id=p_actor and role='admin' and is_active is not false)) then raise exception 'Pricing permission required' using errcode='42501'; end if;
  select * into strict v from public.contract_pricing_versions where id=p_version_id;
  perform pg_advisory_xact_lock(hashtextextended(v.contract_id::text,1));
  select * into strict v from public.contract_pricing_versions where id=p_version_id for update;
  if v.is_published or v.status<>'draft' or v.published_at is not null or exists(select 1 from public.pricing_version_audit a where a.version_id=v.id and a.action='publish') then raise exception 'Published pricing is immutable'; end if;
  if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)<>4 or (select count(distinct r->>'price_area') from jsonb_array_elements(p_rows) r where r->>'price_area' in ('SE1','SE2','SE3','SE4'))<>4 then raise exception 'Four unique price areas required'; end if;
  delete from public.contract_area_pricing where pricing_version_id=p_version_id;
  insert into public.contract_area_pricing(pricing_version_id,price_area,price_per_kwh_ore,markup_ore,monthly_fee_sek,variable_fee_ore,elcert_ore)
    select p_version_id,r.price_area,r.price_per_kwh_ore,r.markup_ore,r.monthly_fee_sek,r.variable_fee_ore,r.elcert_ore
    from jsonb_to_recordset(p_rows) as r(price_area text,price_per_kwh_ore numeric,markup_ore numeric,monthly_fee_sek numeric,variable_fee_ore numeric,elcert_ore numeric);
  insert into public.pricing_version_audit(contract_id,version_id,action,performed_by,reason) values(v.contract_id,v.id,'update',p_actor,'Atomic draft price update');
end $$;
create or replace function public.gridex_publish_pricing_v1(p_contract_id uuid,p_version_id uuid,p_actor uuid,p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.contract_pricing_versions%rowtype; active uuid;
begin
  if not (public.gridex_has_permission(p_actor,'admin.access') or public.gridex_has_permission(p_actor,'pricing.publish') or public.gridex_has_permission(p_actor,'pricing.publish_prod') or exists(select 1 from public.admin_users where user_id=p_actor and role='admin' and is_active is not false)) then raise exception 'Pricing publish permission required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_contract_id::text,1));
  if p_version_id is not null then
    select * into strict v from public.contract_pricing_versions where id=p_version_id and contract_id=p_contract_id for update;
    if (select count(distinct price_area) from public.contract_area_pricing where pricing_version_id=p_version_id)<>4 then raise exception 'Complete pricing required'; end if;
  end if;
  select id into active from public.contract_pricing_versions where contract_id=p_contract_id and is_published order by valid_from desc limit 1;
  update public.contract_pricing_versions set is_published=false,status='draft' where contract_id=p_contract_id and (is_published or status='published');
  if p_version_id is not null then
    update public.contract_pricing_versions set is_published=true,status='published',published_at=now(),published_by=p_actor where id=p_version_id;
    insert into public.pricing_version_audit(contract_id,version_id,action,performed_by,reason) values(p_contract_id,p_version_id,'publish',p_actor,p_reason);
  elsif active is not null then
    insert into public.pricing_version_audit(contract_id,version_id,action,performed_by,reason) values(p_contract_id,active,'unpublish',p_actor,p_reason);
  end if;
end $$;
create or replace function public.gridex_create_pricing_version_v1(p_contract_id uuid,p_actor uuid,p_valid_from date,p_source_id uuid default null,p_reason text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare source public.contract_pricing_versions%rowtype; created uuid := gen_random_uuid(); number integer;
begin
  if not (public.gridex_has_permission(p_actor,'admin.access') or public.gridex_has_permission(p_actor,'pricing.write') or public.gridex_has_permission(p_actor,'pricing.manage') or public.gridex_has_permission(p_actor,'pricing.publish') or exists(select 1 from public.admin_users where user_id=p_actor and role='admin' and is_active is not false)) then raise exception 'Pricing permission required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_contract_id::text,1));
  if p_source_id is not null then select * into strict source from public.contract_pricing_versions where id=p_source_id and contract_id=p_contract_id for share; end if;
  if coalesce(p_valid_from,source.valid_from) is null then raise exception 'Valid date required'; end if;
  select coalesce(max(version_number),0)+1 into number from public.contract_pricing_versions where contract_id=p_contract_id;
  insert into public.contract_pricing_versions(id,contract_id,version_number,valid_from,is_published,status,created_by)
    values(created,p_contract_id,number,coalesce(p_valid_from,source.valid_from),false,'draft',p_actor);
  if p_source_id is not null then
    insert into public.contract_area_pricing(pricing_version_id,price_area,price_per_kwh_ore,markup_ore,monthly_fee_sek,variable_fee_ore,elcert_ore)
      select created,price_area,price_per_kwh_ore,markup_ore,monthly_fee_sek,variable_fee_ore,elcert_ore from public.contract_area_pricing where pricing_version_id=p_source_id;
  end if;
  insert into public.pricing_version_audit(contract_id,version_id,action,performed_by,reason) values(p_contract_id,created,case when p_source_id is null then 'create' else 'clone' end,p_actor,p_reason);
  return created;
end $$;
revoke all on function public.gridex_create_pricing_version_v1(uuid,uuid,date,uuid,text) from public,anon,authenticated;
grant execute on function public.gridex_create_pricing_version_v1(uuid,uuid,date,uuid,text) to service_role;
revoke all on function public.gridex_save_pricing_rows_v1(uuid,uuid,jsonb), public.gridex_publish_pricing_v1(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.gridex_save_pricing_rows_v1(uuid,uuid,jsonb), public.gridex_publish_pricing_v1(uuid,uuid,uuid,text) to service_role;
commit;
