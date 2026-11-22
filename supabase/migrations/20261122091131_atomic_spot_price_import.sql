alter table public.gridex_monthly_spot_prices
  drop constraint if exists gridex_monthly_spot_prices_avg_spot_ore_check,
  add constraint gridex_monthly_spot_prices_avg_spot_ore_finite
    check (avg_spot_ore <> 'NaN'::numeric) not valid;

create function public.gridex_import_monthly_spot_prices(
  p_year integer,
  p_month integer,
  p_areas jsonb,
  p_publish boolean,
  p_reason text
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_job_id uuid;
  v_period text := p_year::text || '-' || lpad(p_month::text, 2, '0');
begin
  if jsonb_typeof(p_areas) is distinct from 'array' or jsonb_array_length(p_areas) = 0 then
    raise exception 'Monthly spot prices must include at least one area';
  end if;

  insert into public.gridex_monthly_spot_prices (
    price_area, year, month, avg_spot_ore, source, source_payload
  )
  select "priceArea", p_year, p_month, "avgSpotOre", 'elprisetjustnu',
         jsonb_build_object('samples', samples)
  from jsonb_to_recordset(p_areas) as area("priceArea" text, "avgSpotOre" numeric, samples integer)
  order by "priceArea"
  on conflict (price_area, year, month) do update set
    avg_spot_ore = excluded.avg_spot_ore,
    source = excluded.source,
    source_payload = excluded.source_payload;

  if p_publish then
    perform 1 from public.gridex_spot_basis_config where id = 1 for update;
    perform public.gridex_spot_publish_active_basis(p_year, p_month, p_reason);
  end if;

  insert into public.integration_sync_jobs (
    provider_key, entity_type, entity_id, direction, status, payload, idempotency_key
  )
  values (
    'elprisetjustnu', 'spot_monthly_prices', v_period, 'inbound', 'success',
    jsonb_build_object('source', 'elprisetjustnu', 'year', p_year, 'month', p_month, 'areas', p_areas),
    'elprisetjustnu:spot:' || v_period
  ) returning id into v_job_id;

  return v_job_id;
end;
$$;

revoke execute on function public.gridex_import_monthly_spot_prices(integer, integer, jsonb, boolean, text)
  from public, anon, authenticated;
grant execute on function public.gridex_import_monthly_spot_prices(integer, integer, jsonb, boolean, text)
  to service_role;
