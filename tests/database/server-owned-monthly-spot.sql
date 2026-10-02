-- LOCAL ONLY. Exact independent-Web authorization + monthly production fixture.
-- Apply the server-owned monthly migration before this file. ON_ERROR_STOP=1.
begin;
do $$ declare actual record; baseline record; begin
  for baseline in select * from gridex_test.monthly_catalog_before loop
    select c.relname::text as tablename,c.relrowsecurity,c.relforcerowsecurity,
      (select jsonb_agg(to_jsonb(a) order by a.grantee,a.grantor,a.is_grantable)
        from pg_catalog.aclexplode(c.relacl) a where a.privilege_type='SELECT') as select_acl,
      (select jsonb_agg(to_jsonb(a) order by a.grantee,a.grantor,a.privilege_type,a.is_grantable)
        from pg_catalog.aclexplode(c.relacl) a where a.grantee='service_role'::regrole) as service_acl,
      (select jsonb_agg(jsonb_build_object('name',a.attname,
        'select_grants',(select jsonb_agg(to_jsonb(x) order by x.grantee,x.grantor,x.is_grantable)
          from pg_catalog.aclexplode(a.attacl) x where x.privilege_type='SELECT')) order by a.attnum)
        from pg_catalog.pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped) as column_select_acl,
      (select jsonb_agg(to_jsonb(p) order by p.polname) from pg_catalog.pg_policy p where p.polrelid=c.oid) as policies,
      (select jsonb_agg(to_jsonb(t) order by t.tgname) from pg_catalog.pg_trigger t where t.tgrelid=c.oid and not t.tgisinternal) as triggers
    into strict actual from pg_catalog.pg_class c where c.oid=('public.'||baseline.tablename)::regclass;
    if to_jsonb(actual) is distinct from to_jsonb(baseline) then
      raise exception 'Monthly table SELECT/service ACL, RLS, policies or triggers changed: %',baseline.tablename;
    end if;
  end loop;
  if exists(select 1 from gridex_test.monthly_authorization_signatures_before b
    left join pg_proc p on p.oid=b.oid where p.oid is null or
      row(p.proargnames,p.prorettype,p.proargtypes::text,p.pronargs,p.prosecdef)
        is distinct from row(b.proargnames,b.prorettype,b.proargtypes,b.pronargs,b.prosecdef)) then
    raise exception 'Shared authorization signatures changed';
  end if;
end $$;

-- ACLs prevent browser mutation even with a privileged identity and permissive
-- legacy policies. We require a privilege error, not a policy-filtered zero row.
select set_config('request.jwt.claim.sub',md5('monthly-legacy-admin')::uuid::text,true);
set local role authenticated;
do $$ declare statement text; blocked boolean; begin
  if (select count(*) from public.gridex_monthly_spot_prices)<>8
    or (select active_month from public.gridex_spot_basis_config where id=1)<>7 then
    raise exception 'Authenticated public monthly/basis lookup stopped working';
  end if;
  foreach statement in array array[
    $q$insert into public.gridex_monthly_spot_prices(price_area,year,month,avg_spot_ore) values('SE1',2026,9,5)$q$,
    $q$update public.gridex_monthly_spot_prices set avg_spot_ore=9 where year=2026 and month=7$q$,
    $q$delete from public.gridex_monthly_spot_prices where year=2026 and month=7$q$,
    $q$truncate public.gridex_monthly_spot_prices$q$,
    $q$insert into public.gridex_spot_basis_config(id,active_year,active_month) values(1,2026,9) on conflict(id) do update set active_month=9$q$,
    $q$update public.gridex_spot_basis_config set active_month=9 where id=1$q$,
    $q$delete from public.gridex_spot_basis_config where id=1$q$,
    $q$truncate public.gridex_spot_basis_config$q$,
    $q$insert into public.gridex_spot_basis_publish_log(action,active_year,active_month,snapshot) values('publish',2026,9,'{}')$q$,
    $q$update public.gridex_spot_basis_publish_log set reason='forged'$q$,
    $q$delete from public.gridex_spot_basis_publish_log$q$,
    $q$truncate public.gridex_spot_basis_publish_log$q$,
    $q$select public.gridex_web_save_monthly_spot_prices(md5('monthly-global-writer')::uuid,2026,9,'[]')$q$,
    $q$select public.gridex_web_publish_spot_basis(md5('monthly-global-publisher')::uuid,2026,8,'forged')$q$,
    $q$select public.gridex_web_rollback_spot_basis(md5('monthly-global-publisher')::uuid,'forged')$q$
  ] loop
    blocked:=false;
    begin execute statement; exception when insufficient_privilege then blocked:=true; end;
    if not blocked then raise exception 'Authenticated mutation accepted: %',statement; end if;
  end loop;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$ declare statement text; blocked boolean; begin
  if (select count(*) from public.gridex_monthly_spot_prices)<>8
    or (select active_month from public.gridex_spot_basis_config where id=1)<>7 then
    raise exception 'Anonymous monthly/basis lookup stopped working';
  end if;
  foreach statement in array array[
    $q$update public.gridex_monthly_spot_prices set avg_spot_ore=9$q$,
    $q$update public.gridex_spot_basis_config set active_month=9$q$,
    $q$insert into public.gridex_spot_basis_publish_log(action,active_year,active_month,snapshot) values('publish',2026,9,'{}')$q$,
    $q$select public.gridex_web_save_monthly_spot_prices(md5('monthly-global-writer')::uuid,2026,9,'[]')$q$,
    $q$select public.gridex_web_publish_spot_basis(md5('monthly-global-publisher')::uuid,2026,8,null)$q$,
    $q$select public.gridex_web_rollback_spot_basis(md5('monthly-global-publisher')::uuid,null)$q$
  ] loop
    blocked:=false;
    begin execute statement; exception when insufficient_privilege then blocked:=true; end;
    if not blocked then raise exception 'Anonymous mutation accepted: %',statement; end if;
  end loop;
end $$;
reset role;
set local role service_role;

-- An active company-local assignment never becomes a global grant. Deny
-- overrides, disabled role/profile, support-console and pricing.write alone
-- are insufficient. Check the exact canonical global permission function too.
do $$ declare actor text; blocked boolean; rows jsonb:='[
  {"price_area":"SE1","avg_spot_ore":-10.123},{"price_area":"SE2","avg_spot_ore":0},
  {"price_area":"SE3","avg_spot_ore":23.456},{"price_area":"SE4","avg_spot_ore":100}]';
begin
  if not 'spot.write'=any(public.gridex_get_user_permissions(md5('monthly-company-only')::uuid,md5('monthly-company')::uuid))
    or 'spot.write'=any(public.gridex_get_user_permissions(md5('monthly-company-only')::uuid,null::uuid)) then
    raise exception 'Fixture does not demonstrate company/global permission isolation';
  end if;
  foreach actor in array array['company-only','disabled-role','disabled-profile','legacy-admin','pricing-only','unprivileged','global-deny'] loop
    blocked:=false;
    begin perform public.gridex_web_save_monthly_spot_prices(md5('monthly-'||actor)::uuid,2026,9,rows);
    exception when insufficient_privilege then blocked:=true; end;
    if not blocked then raise exception 'Unauthorized actor saved monthly rows: %',actor; end if;
    blocked:=false;
    begin perform public.gridex_web_publish_spot_basis(md5('monthly-'||actor)::uuid,2026,8,null);
    exception when insufficient_privilege then blocked:=true; end;
    if not blocked then raise exception 'Unauthorized actor published basis: %',actor; end if;
    blocked:=false;
    begin perform public.gridex_web_rollback_spot_basis(md5('monthly-'||actor)::uuid,null);
    exception when insufficient_privilege then blocked:=true; end;
    if not blocked then raise exception 'Unauthorized actor rolled back basis: %',actor; end if;
  end loop;
  blocked:=false;
  begin perform public.gridex_web_save_monthly_spot_prices(null,2026,9,rows);
  exception when insufficient_privilege then blocked:=true; end;
  if not blocked then raise exception 'Null actor saved monthly rows'; end if;
  blocked:=false;
  begin perform public.gridex_web_publish_spot_basis(md5('monthly-global-writer')::uuid,2026,8,null);
  exception when insufficient_privilege then blocked:=true; end;
  if not blocked then raise exception 'spot.write implied publish permission'; end if;
  blocked:=false;
  begin perform public.gridex_web_save_monthly_spot_prices(md5('monthly-global-publisher')::uuid,2026,9,rows);
  exception when insufficient_privilege then blocked:=true; end;
  if not blocked then raise exception 'spot.publish implied save permission'; end if;
end $$;

-- Schema-invalid and incomplete requests must not partially mutate prices or
-- add audit records. Positive/negative finite values are both valid electricity
-- prices; reject non-numeric JSON, infinities, duplicate/missing/extra areas.
do $$ declare payload jsonb; blocked boolean; baseline jsonb; baseline_audit bigint; rows jsonb:='[
  {"price_area":"SE1","avg_spot_ore":-10.123},{"price_area":"SE2","avg_spot_ore":0},
  {"price_area":"SE3","avg_spot_ore":23.456},{"price_area":"SE4","avg_spot_ore":100}]';
begin
  select jsonb_agg(to_jsonb(p) order by price_area,year,month) into baseline from public.gridex_monthly_spot_prices p;
  select count(*) into baseline_audit from public.permission_audit;
  foreach payload in array array[
    null::jsonb,'null'::jsonb,'{}'::jsonb,'[]'::jsonb,
    rows-0,rows||jsonb_build_array(jsonb_build_object('price_area','SE1','avg_spot_ore',5)),
    jsonb_set(rows,'{3,price_area}','"SE1"'),jsonb_set(rows,'{3,price_area}','"SE5"'),
    jsonb_set(rows,'{0,avg_spot_ore}','null'),jsonb_set(rows,'{0,avg_spot_ore}','"NaN"'),
    jsonb_set(rows,'{0,avg_spot_ore}','"Infinity"'),jsonb_set(rows,'{0,avg_spot_ore}','true'),
    jsonb_set(rows,'{0,avg_spot_ore}','[]'),jsonb_set(rows,'{0,avg_spot_ore}','10000000'),
    jsonb_set(rows,'{0,avg_spot_ore}','-10000000'),jsonb_set(rows,'{0}','{}')
  ] loop
    blocked:=false;
    begin perform public.gridex_web_save_monthly_spot_prices(md5('monthly-global-writer')::uuid,2026,9,payload);
    exception when invalid_parameter_value then blocked:=true; end;
    if not blocked then raise exception 'Invalid monthly payload accepted: %',payload; end if;
  end loop;
  foreach payload in array array['[1999,1]'::jsonb,'[2101,1]'::jsonb,'[2026,0]'::jsonb,'[2026,13]'::jsonb,'[null,1]'::jsonb,'[2026,null]'::jsonb] loop
    blocked:=false;
    begin perform public.gridex_web_save_monthly_spot_prices(md5('monthly-global-writer')::uuid,(payload->>0)::int,(payload->>1)::int,rows);
    exception when invalid_parameter_value then blocked:=true; end;
    if not blocked then raise exception 'Invalid monthly period accepted: %',payload; end if;
  end loop;
  if (select jsonb_agg(to_jsonb(p) order by price_area,year,month) from public.gridex_monthly_spot_prices p) is distinct from baseline
    or (select count(*) from public.permission_audit)<>baseline_audit then
    raise exception 'Invalid save partially changed prices/audit';
  end if;
  blocked:=false;
  begin perform public.gridex_web_publish_spot_basis(md5('monthly-global-publisher')::uuid,2026,9,'missing period');
  exception when invalid_parameter_value then blocked:=true; end;
  if not blocked then raise exception 'Published missing monthly area rows'; end if;
  blocked:=false;
  begin perform public.gridex_web_rollback_spot_basis(md5('monthly-global-publisher')::uuid,'no history');
  exception when object_not_in_prerequisite_state then blocked:=true; end;
  if not blocked then raise exception 'Rollback accepted without prior snapshot'; end if;
end $$;

-- Service JWT is actor-free. Live attribution triggers must preserve the
-- explicit audited actor; browser auth.uid() would override it in production.
do $$ declare writer uuid:=md5('monthly-global-writer')::uuid; publisher uuid:=md5('monthly-global-publisher')::uuid;
  rows jsonb:='[{"price_area":"SE1","avg_spot_ore":-10.123},{"price_area":"SE2","avg_spot_ore":0},
    {"price_area":"SE3","avg_spot_ore":23.456},{"price_area":"SE4","avg_spot_ore":100}]';
  latest public.gridex_spot_basis_publish_log%rowtype;
begin
  if auth.uid() is not null then raise exception 'Service RPC fixture has a leaked browser identity'; end if;
  perform public.gridex_web_save_monthly_spot_prices(writer,2026,9,
    jsonb_set(rows,'{2,avg_spot_ore}','1.2345'));
  if (select avg_spot_ore from public.gridex_monthly_spot_prices where year=2026 and month=9 and price_area='SE3')<>1.235 then
    raise exception 'Save changed existing numeric(10,3) rounding semantics';
  end if;
  if (select count(*) from public.gridex_monthly_spot_prices where year=2026 and month=9 and updated_by=writer)<>4
    or (select avg_spot_ore from public.gridex_monthly_spot_prices where year=2026 and month=9 and price_area='SE1')<>-10.123 then
    raise exception 'Save lost signed prices or explicit actor';
  end if;
  if not exists(select 1 from public.permission_audit where actor_id=writer and action='spot.monthly_prices.upsert'
    and metadata->>'year'='2026' and metadata->>'month'='9') then
    raise exception 'Save lacks actor-attributed period audit';
  end if;
  -- Global allow override uses the actual permission merge function.
  perform public.gridex_web_save_monthly_spot_prices(md5('monthly-global-allow')::uuid,2026,9,rows);
  perform public.gridex_web_publish_spot_basis(publisher,2026,8,'first publish');
  select * into strict latest from public.gridex_spot_basis_publish_log where reason='first publish';
  if latest.action<>'publish' or latest.created_by is distinct from publisher
    or latest.snapshot->>'previous_year'<>'2026' or latest.snapshot->>'previous_month'<>'7'
    or jsonb_array_length(latest.snapshot->'rows')<>4
    or (select updated_by from public.gridex_spot_basis_config where id=1) is distinct from publisher then
    raise exception 'Publish actor or prior-period snapshot incorrect: %',to_jsonb(latest);
  end if;
  -- A first publish must be reversible using its snapshot; OFFSET 1 among
  -- publish events fails this real-world case when there is just one history row.
  perform public.gridex_web_rollback_spot_basis(publisher,'undo first publish');
  select * into strict latest from public.gridex_spot_basis_publish_log where reason='undo first publish';
  if (select active_month from public.gridex_spot_basis_config where id=1)<>7
    or latest.action<>'rollback' or latest.created_by is distinct from publisher
    or latest.active_month<>7 or latest.snapshot->>'previous_month'<>'8' then
    raise exception 'Rollback did not restore first publish previous state';
  end if;
  -- Newest state change includes rollback. A second rollback must undo that
  -- change (7 -> 8), not skip past it to an older publish event.
  perform public.gridex_web_rollback_spot_basis(publisher,'undo latest state change');
  if (select active_month from public.gridex_spot_basis_config where id=1)<>8 then
    raise exception 'Rollback ignored newest rollback history';
  end if;
  perform public.gridex_web_publish_spot_basis(md5('monthly-global-allow')::uuid,2026,9,'override publish');
  if (select active_month from public.gridex_spot_basis_config where id=1)<>9 then
    raise exception 'Global publish override did not work';
  end if;
end $$;
reset role;

-- Each request checks current permission state; a cached Web authorization
-- cannot authorize writes after a assignment, role or profile is disabled.
update public.user_roles set is_active=false where user_id=md5('monthly-global-writer')::uuid;
set local role service_role;
do $$ declare blocked boolean:=false; begin
  begin perform public.gridex_web_save_monthly_spot_prices(md5('monthly-global-writer')::uuid,2026,10,'[
    {"price_area":"SE1","avg_spot_ore":1},{"price_area":"SE2","avg_spot_ore":2},
    {"price_area":"SE3","avg_spot_ore":3},{"price_area":"SE4","avg_spot_ore":4}]');
  exception when insufficient_privilege then blocked:=true; end;
  if not blocked then raise exception 'Revoked writer assignment still authorized'; end if;
end $$;
reset role;
update public.user_roles set is_active=true where user_id=md5('monthly-global-writer')::uuid;
update public.gridex_spot_basis_config set active_month=8 where id=1;
set local role service_role;
do $$ declare blocked boolean:=false; begin
  begin perform public.gridex_web_rollback_spot_basis(md5('monthly-global-publisher')::uuid,'stale current state');
  exception when serialization_failure then blocked:=true; end;
  if not blocked then raise exception 'Rollback overwrote state changed outside newest snapshot'; end if;
end $$;
reset role;
update public.gridex_spot_basis_config set active_month=9 where id=1;

-- Fail the required audit sink after data mutation: PostgreSQL must roll all
-- four price updates and the active-basis change back as one operation.
create function gridex_test.monthly_fail_audit() returns trigger language plpgsql as $$ begin
  raise exception using errcode='23514',message='MONTHLY_TEST_AUDIT_UNAVAILABLE';
end $$;
create trigger monthly_fail_save_audit before insert on public.permission_audit
for each row execute function gridex_test.monthly_fail_audit();
create trigger monthly_fail_basis_audit before insert on public.gridex_spot_basis_publish_log
for each row execute function gridex_test.monthly_fail_audit();
set local role service_role;
do $$ declare blocked boolean; baseline jsonb; config_before jsonb; audit_count bigint; log_count bigint; begin
  select jsonb_agg(to_jsonb(p) order by price_area,year,month) into baseline from public.gridex_monthly_spot_prices p;
  select to_jsonb(c) into config_before from public.gridex_spot_basis_config c where id=1;
  select count(*) into audit_count from public.permission_audit;
  select count(*) into log_count from public.gridex_spot_basis_publish_log;
  blocked:=false;
  begin perform public.gridex_web_save_monthly_spot_prices(md5('monthly-global-writer')::uuid,2026,9,'[
    {"price_area":"SE1","avg_spot_ore":111},{"price_area":"SE2","avg_spot_ore":222},
    {"price_area":"SE3","avg_spot_ore":333},{"price_area":"SE4","avg_spot_ore":444}]');
  exception when check_violation then blocked:=true; end;
  if not blocked then raise exception 'Save succeeded without mandatory audit'; end if;
  blocked:=false;
  begin perform public.gridex_web_publish_spot_basis(md5('monthly-global-publisher')::uuid,2026,8,'failed audit publish');
  exception when check_violation then blocked:=true; end;
  if not blocked then raise exception 'Publish succeeded without mandatory audit'; end if;
  blocked:=false;
  begin perform public.gridex_web_rollback_spot_basis(md5('monthly-global-publisher')::uuid,'failed audit rollback');
  exception when check_violation then blocked:=true; end;
  if not blocked then raise exception 'Rollback succeeded without mandatory audit'; end if;
  if (select jsonb_agg(to_jsonb(p) order by price_area,year,month) from public.gridex_monthly_spot_prices p) is distinct from baseline
    or (select to_jsonb(c) from public.gridex_spot_basis_config c where id=1) is distinct from config_before
    or (select count(*) from public.permission_audit)<>audit_count
    or (select count(*) from public.gridex_spot_basis_publish_log)<>log_count then
    raise exception 'Audit failure left partial prices/basis/history changes';
  end if;
end $$;
reset role;
select 'Monthly spot ACL, global authorization, signed prices, actor audit, snapshot rollback, stale state and atomic audit-failure assertions passed' as result;
rollback;
