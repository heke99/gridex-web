-- Server actions authorize the operator before invoking these service-only RPCs.
-- Keep each pricing replacement/publication and its audit in one transaction.
-- All RPCs take the contract lock before version locks, so a concurrent draft
-- save cannot edit a version after another request publishes it.
-- Replace legacy permissive pricing policies rather than combining with them:
-- PostgreSQL ORs permissive policies, so leaving any old ALL/SELECT policy
-- would retain the draft disclosure and broad admin mutation path.
do $$
declare
  v_policy record;
  v_table text;
  v_columns text;
begin
  for v_policy in select schemaname, tablename, policyname from pg_catalog.pg_policies
    where schemaname = 'public' and tablename in (
      'contract_products', 'contract_pricing_versions', 'contract_area_pricing', 'pricing_version_audit'
    )
  loop
    execute format('drop policy %I on %I.%I', v_policy.policyname, v_policy.schemaname, v_policy.tablename);
  end loop;
  foreach v_table in array array['contract_products', 'contract_pricing_versions', 'contract_area_pricing', 'pricing_version_audit'] loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format('revoke all on table public.%I from public, anon, authenticated', v_table);
    select string_agg(quote_ident(a.attname), ', ' order by a.attnum) into v_columns
      from pg_catalog.pg_attribute a
      where a.attrelid = format('public.%I', v_table)::regclass and a.attnum > 0 and not a.attisdropped;
    execute format('revoke all (%s) on public.%I from public, anon, authenticated', v_columns, v_table);
  end loop;
end;
$$;
grant select on public.contract_products, public.contract_pricing_versions, public.contract_area_pricing to anon, authenticated;
grant select on public.pricing_version_audit to authenticated;

create policy gridex_web_products_public_read on public.contract_products
for select to anon using (is_active is true);
create policy gridex_web_products_authenticated_read on public.contract_products
for select to authenticated using (
  is_active is true or (select gridex_web_private.can('pricing.read')) or (select gridex_web_private.can('contracts.read'))
);

create policy gridex_web_versions_public_read on public.contract_pricing_versions
for select to anon using (
  is_published is true and status = 'published' and valid_from <= current_date
  and exists (select 1 from public.contract_products p where p.id = contract_id and p.is_active is true)
);
create policy gridex_web_versions_authenticated_read on public.contract_pricing_versions
for select to authenticated using (
  (select gridex_web_private.can('pricing.read')) or (
    is_published is true and status = 'published' and valid_from <= current_date
    and exists (select 1 from public.contract_products p where p.id = contract_id and p.is_active is true)
  )
);

create policy gridex_web_areas_public_read on public.contract_area_pricing
for select to anon using (exists (
  select 1 from public.contract_pricing_versions v join public.contract_products p on p.id = v.contract_id
  where v.id = pricing_version_id and v.is_published is true and v.status = 'published'
    and v.valid_from <= current_date and p.is_active is true
));
create policy gridex_web_areas_authenticated_read on public.contract_area_pricing
for select to authenticated using ((select gridex_web_private.can('pricing.read')) or exists (
  select 1 from public.contract_pricing_versions v join public.contract_products p on p.id = v.contract_id
  where v.id = pricing_version_id and v.is_published is true and v.status = 'published'
    and v.valid_from <= current_date and p.is_active is true
));
create policy gridex_web_pricing_audit_read on public.pricing_version_audit
for select to authenticated using (
  (select gridex_web_private.can('audit.read')) or (select gridex_web_private.can('pricing.read'))
);

create or replace function public.gridex_web_save_draft_pricing(
  p_version_id uuid,
  p_rows jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_contract_id uuid;
  v_contract_type text;
  v_version public.contract_pricing_versions%rowtype;
  v_row jsonb;
  v_field text;
  v_number numeric;
begin
  if p_version_id is null then
    raise exception using errcode = '22023', message = 'pricing_version_id is required';
  end if;

  select contract_id into v_contract_id
  from public.contract_pricing_versions where id = p_version_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'Pricing version not found';
  end if;

  select contract_type into v_contract_type
  from public.contract_products where id = v_contract_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Contract not found';
  end if;

  select * into v_version
  from public.contract_pricing_versions where id = p_version_id for update;
  if not found or v_version.contract_id is distinct from v_contract_id then
    raise exception using errcode = '40001', message = 'Pricing version changed; retry the request';
  end if;
  if v_version.is_published is true or v_version.status is distinct from 'draft' then
    raise exception using errcode = '55000', message = 'Published pricing is immutable. Clone the version before editing.';
  end if;
  if v_contract_type not in ('spot_hourly', 'portfolio_managed') or v_contract_type is null then
    raise exception using errcode = '22023', message = 'Unsupported canonical contract type';
  end if;

  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'Pricing must contain exactly one row for each of SE1, SE2, SE3 and SE4';
  end if;
  if jsonb_array_length(p_rows) <> 4 then
    raise exception using errcode = '22023', message = 'Pricing must contain exactly one row for each of SE1, SE2, SE3 and SE4';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_rows) as r(value)
    where jsonb_typeof(value) is distinct from 'object'
       or jsonb_typeof(value -> 'price_area') is distinct from 'string'
       or (value ->> 'price_area') not in ('SE1', 'SE2', 'SE3', 'SE4')
  ) or (select count(distinct value ->> 'price_area') from jsonb_array_elements(p_rows) as r(value)) <> 4 then
    raise exception using errcode = '22023', message = 'Pricing must contain exactly one row for each of SE1, SE2, SE3 and SE4';
  end if;

  -- Validate the complete replacement before removing the previous draft rows.
  for v_row in select value from jsonb_array_elements(p_rows) as r(value) loop
    if v_row ? 'pricing_version_id' and
       (v_row ->> 'pricing_version_id') is distinct from p_version_id::text then
      raise exception using errcode = '22023', message = 'Pricing row belongs to another version';
    end if;
    foreach v_field in array array['price_per_kwh_ore', 'markup_ore', 'monthly_fee_sek', 'variable_fee_ore', 'elcert_ore'] loop
      if jsonb_typeof(v_row -> v_field) is distinct from 'number' then
        raise exception using errcode = '22023', message = 'Pricing values must be finite numbers';
      end if;
      v_number := (v_row ->> v_field)::numeric;
      -- Existing forms/schema allow signed values (for example discounts).
      -- Preserve that domain behavior while excluding JSON numbers that would
      -- overflow the finite numeric range used by the TypeScript API.
      if abs(v_number) > 1.7976931348623157e308::numeric then
        raise exception using errcode = '22023', message = 'Pricing values must be finite numbers';
      end if;
    end loop;
    if (v_contract_type = 'spot_hourly' and (v_row ->> 'price_per_kwh_ore')::numeric <> 0)
       or (v_contract_type = 'portfolio_managed' and (v_row ->> 'markup_ore')::numeric <> 0) then
      raise exception using errcode = '22023', message = 'Pricing values do not match the canonical contract type';
    end if;
  end loop;

  delete from public.contract_area_pricing where pricing_version_id = p_version_id;
  insert into public.contract_area_pricing (
    pricing_version_id, price_area, price_per_kwh_ore, markup_ore,
    monthly_fee_sek, variable_fee_ore, elcert_ore
  )
  select p_version_id, value ->> 'price_area',
    (value ->> 'price_per_kwh_ore')::numeric, (value ->> 'markup_ore')::numeric,
    (value ->> 'monthly_fee_sek')::numeric, (value ->> 'variable_fee_ore')::numeric,
    (value ->> 'elcert_ore')::numeric
  from jsonb_array_elements(p_rows) as r(value);

  return jsonb_build_object('contract_id', v_contract_id, 'version_id', p_version_id, 'row_count', 4);
end;
$$;

create or replace function public.gridex_web_publish_pricing(
  p_contract_id uuid,
  p_version_id uuid,
  p_actor_id uuid,
  p_reason text
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_contract_type text;
  v_version public.contract_pricing_versions%rowtype;
  v_active_id uuid;
  v_unpublished integer := 0;
begin
  if p_contract_id is null or p_actor_id is null or nullif(btrim(p_reason), '') is null then
    raise exception using errcode = '22023', message = 'Contract, actor and publication reason are required';
  end if;
  select contract_type into v_contract_type
  from public.contract_products where id = p_contract_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Contract not found';
  end if;

  -- Lock every version in a stable order, including the target, before changing
  -- publication state. The existing publication triggers remain in force.
  perform id from public.contract_pricing_versions
  where contract_id = p_contract_id order by id for update;

  if p_version_id is null then
    for v_active_id in
      select id from public.contract_pricing_versions
      where contract_id = p_contract_id and (is_published is true or status = 'published') order by id
    loop
      update public.contract_pricing_versions
      set is_published = false, status = 'draft', published_at = null
      where id = v_active_id;
      insert into public.pricing_version_audit (contract_id, version_id, action, performed_by, reason)
      values (p_contract_id, v_active_id, 'unpublish', p_actor_id, btrim(p_reason));
      v_unpublished := v_unpublished + 1;
    end loop;
    return jsonb_build_object('contract_id', p_contract_id, 'published', false, 'unpublished_count', v_unpublished);
  end if;

  select * into v_version from public.contract_pricing_versions
  where id = p_version_id and contract_id = p_contract_id;
  if not found then
    raise exception using errcode = '22023', message = 'Version does not belong to contract';
  end if;
  if v_contract_type not in ('spot_hourly', 'portfolio_managed') or v_contract_type is null then
    raise exception using errcode = '22023', message = 'Unsupported canonical contract type';
  end if;
  if (select count(*) from public.contract_area_pricing where pricing_version_id = p_version_id) <> 4
     or (select count(distinct price_area) from public.contract_area_pricing
         where pricing_version_id = p_version_id and price_area in ('SE1', 'SE2', 'SE3', 'SE4')) <> 4 then
    raise exception using errcode = '22023', message = 'Pricing must contain exactly one row for each of SE1, SE2, SE3 and SE4';
  end if;
  if exists (
    select 1 from public.contract_area_pricing p
    cross join lateral (values (p.monthly_fee_sek), (p.variable_fee_ore), (p.elcert_ore),
       (case when v_contract_type = 'spot_hourly' then coalesce(p.price_per_kwh_ore, 0) else p.price_per_kwh_ore end),
       (case when v_contract_type = 'portfolio_managed' then coalesce(p.markup_ore, 0) else p.markup_ore end)) as n(value)
    where p.pricing_version_id = p_version_id
      and (n.value is null or n.value::text in ('NaN', 'Infinity', '-Infinity')
        or abs(n.value) > 1.7976931348623157e308::numeric)
  ) then
    raise exception using errcode = '22023', message = 'Pricing values must be finite numbers';
  end if;
  if exists (
    select 1 from public.contract_area_pricing where pricing_version_id = p_version_id
      and ((v_contract_type = 'spot_hourly' and price_per_kwh_ore <> 0)
        or (v_contract_type = 'portfolio_managed' and markup_ore <> 0))
  ) then
    raise exception using errcode = '22023', message = 'Pricing values do not match the canonical contract type';
  end if;

  update public.contract_pricing_versions
  set is_published = false, status = 'draft', published_at = null
  where contract_id = p_contract_id and id <> p_version_id
    and (is_published is true or status = 'published');
  update public.contract_pricing_versions
  set is_published = true, status = 'published', published_at = now()
  where id = p_version_id and contract_id = p_contract_id;
  insert into public.pricing_version_audit (contract_id, version_id, action, performed_by, reason)
  values (p_contract_id, p_version_id, 'publish', p_actor_id, btrim(p_reason));

  return jsonb_build_object('contract_id', p_contract_id, 'version_id', p_version_id, 'published', true);
end;
$$;

revoke all on function public.gridex_web_save_draft_pricing(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.gridex_web_publish_pricing(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.gridex_web_save_draft_pricing(uuid, jsonb) to service_role;
grant execute on function public.gridex_web_publish_pricing(uuid, uuid, uuid, text) to service_role;

comment on function public.gridex_web_save_draft_pricing(uuid, jsonb) is
  'Service-only atomic replacement of four canonical area rows on a locked draft pricing version.';
comment on function public.gridex_web_publish_pricing(uuid, uuid, uuid, text) is
  'Service-only atomic pricing publication and audit; a null version unpublishes and audits all active versions.';
