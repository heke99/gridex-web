-- Monthly spot administration is global Web history/control, not canonical OPS
-- publication. Require the current global actor permission after the shared
-- transaction lock. Legacy RPC signatures remain untouched for compatibility.
-- Production publish logs store snapshot JSON and have no previous_year/month
-- columns; record the previous period and ordered Web history inside snapshot.
create or replace function public.gridex_web_save_monthly_spot_prices(
  p_actor_id uuid,p_year integer,p_month integer,p_rows jsonb
) returns jsonb language plpgsql security invoker set search_path=''
as $$
declare v_row jsonb; v_value numeric;
begin
  if p_actor_id is null then raise exception using errcode='42501',message='Actor is required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('gridex_web_spot_basis',0));
  if not ('spot.write'=any(public.gridex_get_user_permissions(p_actor_id,null::uuid))) then
    raise exception using errcode='42501',message='Global spot.write is required';
  end if;
  if p_year is null or p_year not between 2000 and 2100 or p_month is null or p_month not between 1 and 12 then
    raise exception using errcode='22023',message='Invalid year/month';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception using errcode='22023',message='Exactly four canonical price areas are required';
  end if;
  if jsonb_array_length(p_rows)<>4 or exists(
    select 1 from jsonb_array_elements(p_rows) r(value)
    where jsonb_typeof(value) is distinct from 'object'
      or jsonb_typeof(value->'price_area') is distinct from 'string'
      or value->>'price_area' not in('SE1','SE2','SE3','SE4')
      or jsonb_typeof(value->'avg_spot_ore') is distinct from 'number'
  ) or (select count(distinct value->>'price_area') from jsonb_array_elements(p_rows) r(value))<>4 then
    raise exception using errcode='22023',message='Exactly four canonical finite price rows are required';
  end if;
  for v_row in select value from jsonb_array_elements(p_rows) r(value) loop
    v_value:=(v_row->>'avg_spot_ore')::numeric;
    if abs(v_value)>=10000000 then
      raise exception using errcode='22023',message='Spot price exceeds the existing numeric(10,3) range';
    end if;
  end loop;
  insert into public.gridex_monthly_spot_prices(price_area,year,month,avg_spot_ore,updated_by)
  select value->>'price_area',p_year,p_month,(value->>'avg_spot_ore')::numeric,p_actor_id
  from jsonb_array_elements(p_rows) r(value)
  on conflict(price_area,year,month) do update set
    avg_spot_ore=excluded.avg_spot_ore,updated_by=excluded.updated_by,updated_at=now();
  insert into public.permission_audit(actor_id,action,metadata)
  values(p_actor_id,'spot.monthly_prices.upsert',jsonb_build_object('year',p_year,'month',p_month,
    'values',(select jsonb_agg(jsonb_build_object('area',price_area,'avg_spot_ore',avg_spot_ore) order by price_area)
      from public.gridex_monthly_spot_prices where year=p_year and month=p_month)));
  return jsonb_build_object('year',p_year,'month',p_month,'row_count',4);
end;
$$;

create or replace function public.gridex_web_publish_spot_basis(
  p_actor_id uuid,p_year integer,p_month integer,p_reason text
) returns jsonb language plpgsql security invoker set search_path=''
as $$
declare v_previous_year integer; v_previous_month integer; v_sequence bigint; v_rows jsonb; v_log_id uuid;
begin
  if p_actor_id is null then raise exception using errcode='42501',message='Actor is required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('gridex_web_spot_basis',0));
  if not ('spot.publish'=any(public.gridex_get_user_permissions(p_actor_id,null::uuid))) then
    raise exception using errcode='42501',message='Global spot.publish is required';
  end if;
  if p_year is null or p_year not between 2000 and 2100 or p_month is null or p_month not between 1 and 12 then
    raise exception using errcode='22023',message='Invalid year/month';
  end if;
  if (select count(*) from public.gridex_monthly_spot_prices
      where year=p_year and month=p_month and price_area in('SE1','SE2','SE3','SE4'))<>4
    or exists(select 1 from public.gridex_monthly_spot_prices where year=p_year and month=p_month
      and avg_spot_ore::text in('NaN','Infinity','-Infinity')) then
    raise exception using errcode='22023',message='All four finite spot price areas are required';
  end if;
  select active_year,active_month into v_previous_year,v_previous_month
    from public.gridex_spot_basis_config where id=1 for update;
  select jsonb_agg(jsonb_build_object('price_area',price_area,'avg_spot_ore',avg_spot_ore) order by price_area)
    into v_rows from public.gridex_monthly_spot_prices where year=p_year and month=p_month;
  select coalesce(max((snapshot->>'web_sequence')::bigint),0)+1 into v_sequence
    from public.gridex_spot_basis_publish_log where snapshot->>'web_sequence' ~ '^[0-9]{1,18}$';
  insert into public.gridex_spot_basis_config(id,active_year,active_month,updated_by)
    values(1,p_year,p_month,p_actor_id) on conflict(id) do update set
    active_year=excluded.active_year,active_month=excluded.active_month,
    updated_by=excluded.updated_by,updated_at=now();
  insert into public.gridex_spot_basis_publish_log(action,active_year,active_month,snapshot,reason,created_by,created_at)
    values('publish',p_year,p_month,jsonb_build_object('previous_year',v_previous_year,
      'previous_month',v_previous_month,'rows',v_rows,'web_sequence',v_sequence),
      nullif(btrim(p_reason),''),p_actor_id,clock_timestamp()) returning id into v_log_id;
  return jsonb_build_object('id',v_log_id,'active_year',p_year,'active_month',p_month);
end;
$$;

create or replace function public.gridex_web_rollback_spot_basis(p_actor_id uuid,p_reason text)
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare
  v_current_year integer; v_current_month integer; v_target_year integer; v_target_month integer;
  v_latest public.gridex_spot_basis_publish_log%rowtype;
  v_rows jsonb; v_log_id uuid; v_sequence bigint;
begin
  if p_actor_id is null then raise exception using errcode='42501',message='Actor is required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('gridex_web_spot_basis',0));
  if not ('spot.publish'=any(public.gridex_get_user_permissions(p_actor_id,null::uuid))) then
    raise exception using errcode='42501',message='Global spot.publish is required';
  end if;
  select active_year,active_month into v_current_year,v_current_month
    from public.gridex_spot_basis_config where id=1 for update;
  if not found then raise exception using errcode='55000',message='No active spot basis exists'; end if;
  select * into v_latest from public.gridex_spot_basis_publish_log
    where action in('publish','rollback')
    order by case when snapshot->>'web_sequence' ~ '^[0-9]{1,18}$'
      then (snapshot->>'web_sequence')::bigint end desc nulls last,created_at desc,id desc limit 1;
  if not found or jsonb_typeof(v_latest.snapshot->'previous_year') is distinct from 'number'
    or jsonb_typeof(v_latest.snapshot->'previous_month') is distinct from 'number'
    or v_latest.snapshot->>'previous_year' !~ '^[0-9]{4}$'
    or v_latest.snapshot->>'previous_month' !~ '^[0-9]{1,2}$' then
    raise exception using errcode='55000',message='No recorded previous spot period exists';
  end if;
  if v_latest.active_year is distinct from v_current_year or v_latest.active_month is distinct from v_current_month then
    raise exception using errcode='40001',message='Active spot basis differs from its latest history';
  end if;
  v_target_year:=(v_latest.snapshot->>'previous_year')::integer;
  v_target_month:=(v_latest.snapshot->>'previous_month')::integer;
  if v_target_year not between 2000 and 2100 or v_target_month not between 1 and 12
    or (select count(*) from public.gridex_monthly_spot_prices where year=v_target_year and month=v_target_month
      and price_area in('SE1','SE2','SE3','SE4'))<>4
    or exists(select 1 from public.gridex_monthly_spot_prices where year=v_target_year and month=v_target_month
      and avg_spot_ore::text in('NaN','Infinity','-Infinity')) then
    raise exception using errcode='22023',message='Recorded previous period lacks four finite spot price areas';
  end if;
  select jsonb_agg(jsonb_build_object('price_area',price_area,'avg_spot_ore',avg_spot_ore) order by price_area)
    into v_rows from public.gridex_monthly_spot_prices where year=v_target_year and month=v_target_month;
  select coalesce(max((snapshot->>'web_sequence')::bigint),0)+1 into v_sequence
    from public.gridex_spot_basis_publish_log where snapshot->>'web_sequence' ~ '^[0-9]{1,18}$';
  update public.gridex_spot_basis_config set active_year=v_target_year,active_month=v_target_month,
    updated_by=p_actor_id,updated_at=now() where id=1;
  insert into public.gridex_spot_basis_publish_log(action,active_year,active_month,snapshot,reason,created_by,created_at)
    values('rollback',v_target_year,v_target_month,jsonb_build_object('previous_year',v_current_year,
      'previous_month',v_current_month,'rows',v_rows,'web_sequence',v_sequence,'reverts_log_id',v_latest.id),
      nullif(btrim(p_reason),''),p_actor_id,clock_timestamp()) returning id into v_log_id;
  return jsonb_build_object('id',v_log_id,'active_year',v_target_year,'active_month',v_target_month);
end;
$$;

revoke all on function public.gridex_web_save_monthly_spot_prices(uuid,integer,integer,jsonb),
  public.gridex_web_publish_spot_basis(uuid,integer,integer,text),
  public.gridex_web_rollback_spot_basis(uuid,text) from public,anon,authenticated;
grant execute on function public.gridex_web_save_monthly_spot_prices(uuid,integer,integer,jsonb),
  public.gridex_web_publish_spot_basis(uuid,integer,integer,text),
  public.gridex_web_rollback_spot_basis(uuid,text) to service_role;

-- Server operations now own all three affected writes. Keep SELECT grants,
-- existing RLS policies and every service-role grant byte-for-byte unchanged.
do $$ declare v_table text; v_columns text; begin
  foreach v_table in array array['gridex_monthly_spot_prices','gridex_spot_basis_config','gridex_spot_basis_publish_log'] loop
    execute format('revoke insert,update,delete,truncate,references,trigger on table public.%I from public,anon,authenticated',v_table);
    if current_setting('server_version_num')::integer>=170000 then
      execute format('revoke maintain on table public.%I from public,anon,authenticated',v_table);
    end if;
    select string_agg(quote_ident(a.attname),', ' order by a.attnum) into v_columns
      from pg_catalog.pg_attribute a where a.attrelid=format('public.%I',v_table)::regclass
      and a.attnum>0 and not a.attisdropped;
    execute format('revoke insert (%s),update (%s),references (%s) on table public.%I from public,anon,authenticated',
      v_columns,v_columns,v_columns,v_table);
  end loop;
end $$;
