-- Rehearsable native behavioral tests. Every fixture and test trigger rolls back.
-- Run after the security and atomic-pricing migrations, using a PostgreSQL
-- owner connection (never invoke a publication outside this transaction).
begin;

create function pg_temp.assert_true(p_ok boolean, p_message text) returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'Pricing test failed: %', p_message; end if;
end;
$$;
create function pg_temp.expect_error(p_sql text, p_state text) returns void language plpgsql as $$
declare v_state text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
  end;
  if v_state is distinct from p_state then
    raise exception 'Expected SQLSTATE %, got % for %', p_state, coalesce(v_state,'success'), p_sql;
  end if;
end;
$$;
create function pg_temp.pricing_rows(p_markup numeric default 8, p_price numeric default 0) returns jsonb language sql as $$
select jsonb_agg(jsonb_build_object('price_area',a,'markup_ore',p_markup,'price_per_kwh_ore',p_price,
  'monthly_fee_sek',49,'variable_fee_ore',2,'elcert_ore',1) order by a)
from unnest(array['SE1','SE2','SE3','SE4']) a;
$$;
create function pg_temp.reject_pricing_test_insert() returns trigger language plpgsql as $$
begin
  if new.price_area='SE2' and new.markup_ore=9876 then raise exception using errcode='23514',message='Synthetic insertion failure'; end if;
  return new;
end;
$$;
create function pg_temp.reject_pricing_test_audit() returns trigger language plpgsql as $$
begin
  if new.reason='__gridex_pricing_test_reject_audit__' then raise exception using errcode='23514',message='Synthetic audit failure'; end if;
  return new;
end;
$$;
create trigger gridex_pricing_test_fail_insert before insert on public.contract_area_pricing for each row execute function pg_temp.reject_pricing_test_insert();
create trigger gridex_pricing_test_fail_audit before insert on public.pricing_version_audit for each row execute function pg_temp.reject_pricing_test_audit();

insert into auth.users(id,email) values
('eed10000-0000-4000-8000-000000000001','pricing-reader@example.invalid'),
('eed10000-0000-4000-8000-000000000002','pricing-customer@example.invalid'),
('eed10000-0000-4000-8000-000000000003','pricing-tenant-reader@example.invalid'),
('eed10000-0000-4000-8000-000000000004','pricing-legacy-admin@example.invalid'),
('eed10000-0000-4000-8000-000000000005','pricing-disabled-reader@example.invalid'),
('eed10000-0000-4000-8000-000000000006','pricing-auditor@example.invalid'),
('eed10000-0000-4000-8000-000000000007','contract-catalog-reader@example.invalid');
insert into public.companies(id,name) values('eed20000-0000-4000-8000-000000000001','Synthetic pricing tenant');
insert into public.user_permission_overrides(user_id,permission_key,effect,company_id) values
('eed10000-0000-4000-8000-000000000001','pricing.read','allow',null),
('eed10000-0000-4000-8000-000000000003','pricing.read','allow','eed20000-0000-4000-8000-000000000001'),
('eed10000-0000-4000-8000-000000000005','pricing.read','allow',null),
('eed10000-0000-4000-8000-000000000006','audit.read','allow',null),
('eed10000-0000-4000-8000-000000000007','contracts.read','allow',null);
insert into public.company_memberships(company_id,user_id) values
('eed20000-0000-4000-8000-000000000001','eed10000-0000-4000-8000-000000000003');
insert into public.admin_users(user_id,role) values('eed10000-0000-4000-8000-000000000004','admin');
insert into public.user_profiles(id,user_id,user_status) values
('eed10000-0000-4000-8000-000000000005','eed10000-0000-4000-8000-000000000005','disabled');

insert into public.contract_products(id,name,slug,contract_type,is_active) values
('eed30000-0000-4000-8000-000000000001','Synthetic spot','__test_spot__','spot_hourly',true),
('eed30000-0000-4000-8000-000000000002','Synthetic portfolio','__test_portfolio__','portfolio_managed',true),
('eed30000-0000-4000-8000-000000000003','Synthetic future','__test_future__','spot_hourly',true),
('eed30000-0000-4000-8000-000000000004','Synthetic inactive','__test_inactive__','spot_hourly',false);
insert into public.contract_pricing_versions(id,contract_id,version_number,valid_from,status,is_published) values
('eed40000-0000-4000-8000-000000000011','eed30000-0000-4000-8000-000000000001',1,current_date-1,'published',true),
('eed40000-0000-4000-8000-000000000012','eed30000-0000-4000-8000-000000000001',2,current_date,'draft',false),
('eed40000-0000-4000-8000-000000000021','eed30000-0000-4000-8000-000000000002',1,current_date,'draft',false),
('eed40000-0000-4000-8000-000000000031','eed30000-0000-4000-8000-000000000003',1,current_date+10,'published',true),
('eed40000-0000-4000-8000-000000000041','eed30000-0000-4000-8000-000000000004',1,current_date-1,'published',true);
insert into public.contract_area_pricing(pricing_version_id,price_area,price_per_kwh_ore,markup_ore,monthly_fee_sek,variable_fee_ore,elcert_ore)
select v.id,a,case when v.contract_id='eed30000-0000-4000-8000-000000000002' then 125 else 0 end,
  case when v.contract_id='eed30000-0000-4000-8000-000000000002' then 0 else 8 end,49,2,1
from public.contract_pricing_versions v cross join unnest(array['SE1','SE2','SE3','SE4']) a
where v.id::text like 'eed40000-%';
insert into public.pricing_version_audit(contract_id,version_id,action,performed_by,reason) values
('eed30000-0000-4000-8000-000000000001','eed40000-0000-4000-8000-000000000011','publish','eed10000-0000-4000-8000-000000000001','Synthetic initial publication');

do $$
declare t text; c text;
begin
  foreach t in array array['contract_products','contract_pricing_versions','contract_area_pricing','pricing_version_audit'] loop
    foreach c in array array['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] loop
      perform pg_temp.assert_true(not has_table_privilege('authenticated','public.'||t,c), 'authenticated must have no '||c||' on '||t);
      perform pg_temp.assert_true(not has_table_privilege('anon','public.'||t,c), 'anon must have no '||c||' on '||t);
    end loop;
  end loop;
  perform pg_temp.assert_true(not has_column_privilege('authenticated','public.contract_pricing_versions','status','UPDATE'),'legacy column mutation grant removed');
  perform pg_temp.assert_true(not has_function_privilege('anon','public.gridex_web_save_draft_pricing(uuid,jsonb)','EXECUTE'),'anon cannot save');
  perform pg_temp.assert_true(not has_function_privilege('authenticated','public.gridex_web_save_draft_pricing(uuid,jsonb)','EXECUTE'),'authenticated cannot save');
  perform pg_temp.assert_true(not has_function_privilege('anon','public.gridex_web_publish_pricing(uuid,uuid,uuid,text)','EXECUTE'),'anon cannot publish');
  perform pg_temp.assert_true(not has_function_privilege('authenticated','public.gridex_web_publish_pricing(uuid,uuid,uuid,text)','EXECUTE'),'authenticated cannot publish');
  perform pg_temp.assert_true(has_function_privilege('service_role','public.gridex_web_save_draft_pricing(uuid,jsonb)','EXECUTE'),'service can save');
  perform pg_temp.assert_true(has_function_privilege('service_role','public.gridex_web_publish_pricing(uuid,uuid,uuid,text)','EXECUTE'),'service can publish');
end;
$$;

set local role anon;
do $$ begin
  perform pg_temp.assert_true((select count(*) from public.contract_products where id::text like 'eed30000-%')=3,'anon sees active products');
  perform pg_temp.assert_true((select count(*) from public.contract_pricing_versions where id::text like 'eed40000-%')=1,'anon sees only current published active pricing');
  perform pg_temp.assert_true((select count(*) from public.contract_area_pricing where pricing_version_id::text like 'eed40000-%')=4,'anon cannot see drafts/future/inactive area pricing');
  perform pg_temp.expect_error('select * from public.pricing_version_audit','42501');
  perform pg_temp.expect_error('select public.gridex_web_save_draft_pricing(null,null)','42501');
end; $$;
reset role;

set local role authenticated;
do $$
declare u uuid;
begin
  foreach u in array array[
    'eed10000-0000-4000-8000-000000000002'::uuid,
    'eed10000-0000-4000-8000-000000000003'::uuid,
    'eed10000-0000-4000-8000-000000000004'::uuid,
    'eed10000-0000-4000-8000-000000000005'::uuid
  ] loop
    perform set_config('request.jwt.claim.sub',u::text,true);
    perform pg_temp.assert_true((select count(*) from public.contract_pricing_versions where id::text like 'eed40000-%')=1,'customer/tenant/legacy-admin/disabled role cannot read drafts');
    perform pg_temp.assert_true((select count(*) from public.contract_area_pricing where pricing_version_id::text like 'eed40000-%')=4,'customer/tenant/legacy-admin/disabled role sees only public areas');
    perform pg_temp.assert_true((select count(*) from public.pricing_version_audit where contract_id::text like 'eed30000-%')=0,'unprivileged role cannot read audit');
  end loop;
  perform set_config('request.jwt.claim.sub','eed10000-0000-4000-8000-000000000001',true);
  perform pg_temp.assert_true((select count(*) from public.contract_pricing_versions where id::text like 'eed40000-%')=5,'global pricing.read can read all pricing versions');
  perform pg_temp.assert_true((select count(*) from public.contract_area_pricing where pricing_version_id::text like 'eed40000-%')=20,'global pricing.read can read drafts');
  perform pg_temp.assert_true((select count(*) from public.pricing_version_audit where contract_id::text like 'eed30000-%')=1,'global pricing.read can read pricing audit');
  perform pg_temp.expect_error('update public.contract_pricing_versions set status=''published'' where id=''eed40000-0000-4000-8000-000000000012''','42501');
  perform pg_temp.expect_error('select public.gridex_web_publish_pricing(null,null,null,null)','42501');
  perform set_config('request.jwt.claim.sub','eed10000-0000-4000-8000-000000000006',true);
  perform pg_temp.assert_true((select count(*) from public.pricing_version_audit where contract_id::text like 'eed30000-%')=1,'auditor sees audit');
  perform pg_temp.assert_true((select count(*) from public.contract_pricing_versions where id::text like 'eed40000-%')=1,'audit.read does not imply draft pricing read');
  perform set_config('request.jwt.claim.sub','eed10000-0000-4000-8000-000000000007',true);
  perform pg_temp.assert_true((select count(*) from public.contract_products where id::text like 'eed30000-%')=4,'global contracts.read can read inactive product metadata');
  perform pg_temp.assert_true((select count(*) from public.contract_pricing_versions where id::text like 'eed40000-%')=1,'contracts.read does not imply draft pricing read');
  perform pg_temp.assert_true((select count(*) from public.contract_area_pricing where pricing_version_id::text like 'eed40000-%')=4,'contracts.read does not imply draft area pricing read');
end;
$$;
reset role;

set local role service_role;
do $$
declare
  v_draft uuid := 'eed40000-0000-4000-8000-000000000012';
  v_contract uuid := 'eed30000-0000-4000-8000-000000000001';
  v_actor uuid := 'eed10000-0000-4000-8000-000000000001';
  v_before jsonb;
  v_after jsonb;
begin
  perform pg_temp.expect_error(format('select public.gridex_web_save_draft_pricing(%L,pg_temp.pricing_rows())','eed40000-0000-4000-8000-000000000011'),'55000');
  select jsonb_agg(to_jsonb(p) order by price_area) into v_before from public.contract_area_pricing p where pricing_version_id=v_draft;
  perform pg_temp.expect_error(format('select public.gridex_web_save_draft_pricing(%L,pg_temp.pricing_rows() - 0)',v_draft),'22023');
  perform pg_temp.expect_error(format('select public.gridex_web_save_draft_pricing(%L,jsonb_set(pg_temp.pricing_rows(),''{1,price_area}'',''"SE1"''))',v_draft),'22023');
  perform pg_temp.expect_error(format('select public.gridex_web_save_draft_pricing(%L,jsonb_set(pg_temp.pricing_rows(),''{0,markup_ore}'',''"NaN"''))',v_draft),'22023');
  perform pg_temp.expect_error(format('select public.gridex_web_save_draft_pricing(%L,jsonb_set(pg_temp.pricing_rows(),''{0,markup_ore}'',''1e1000''))',v_draft),'22023');
  perform pg_temp.expect_error(format('select public.gridex_web_save_draft_pricing(%L,jsonb_set(pg_temp.pricing_rows(),''{0,markup_ore}'',''-1e1000''))',v_draft),'22023');
  perform pg_temp.expect_error(format('select public.gridex_web_save_draft_pricing(%L,pg_temp.pricing_rows(8,125))',v_draft),'22023');
  perform pg_temp.expect_error(format('select public.gridex_web_save_draft_pricing(%L,jsonb_set(pg_temp.pricing_rows(),''{0,pricing_version_id}'',''"eed40000-0000-4000-8000-000000000021"''))',v_draft),'22023');
  -- Failure during INSERT happens after DELETE. The old values and row IDs must
  -- survive unchanged, proving transaction rollback rather than compensation.
  perform pg_temp.expect_error(format('select public.gridex_web_save_draft_pricing(%L,pg_temp.pricing_rows(9876))',v_draft),'23514');
  select jsonb_agg(to_jsonb(p) order by price_area) into v_after from public.contract_area_pricing p where pricing_version_id=v_draft;
  perform pg_temp.assert_true(v_before=v_after,'invalid payloads and failed insertion preserve exact previous draft rows');
  perform public.gridex_web_save_draft_pricing(v_draft,jsonb_set(pg_temp.pricing_rows(-8),'{0,monthly_fee_sek}','-1'));
  perform pg_temp.assert_true((select count(*)=4 and min(markup_ore)=-8 and max(markup_ore)=-8 and min(monthly_fee_sek)=-1 from public.contract_area_pricing where pricing_version_id=v_draft),'signed discount components remain compatible with existing pricing semantics');
  perform public.gridex_web_save_draft_pricing(v_draft,pg_temp.pricing_rows(9));
  perform pg_temp.assert_true((select count(*)=4 and min(markup_ore)=9 and max(markup_ore)=9 from public.contract_area_pricing where pricing_version_id=v_draft),'valid replacement saves all four area rows');

  perform pg_temp.expect_error(format('select public.gridex_web_publish_pricing(%L,%L,%L,%L)',v_contract,'eed40000-0000-4000-8000-000000000021',v_actor,'wrong contract'),'22023');
  perform pg_temp.expect_error(format('select public.gridex_web_publish_pricing(%L,%L,%L,%L)',v_contract,v_draft,v_actor,''),'22023');
  perform pg_temp.expect_error(format('select public.gridex_web_publish_pricing(%L,%L,%L,%L)',v_contract,v_draft,v_actor,'__gridex_pricing_test_reject_audit__'),'23514');
  perform pg_temp.assert_true((select is_published and status='published' from public.contract_pricing_versions where id='eed40000-0000-4000-8000-000000000011'),'failed audit preserves previous published version');
  perform pg_temp.assert_true((select not is_published and status='draft' from public.contract_pricing_versions where id=v_draft),'failed audit leaves target draft');
  perform pg_temp.assert_true((select count(*) from public.pricing_version_audit where contract_id=v_contract)=1,'failed publish leaves audit unchanged');

  delete from public.contract_area_pricing where pricing_version_id=v_draft and price_area='SE4';
  perform pg_temp.expect_error(format('select public.gridex_web_publish_pricing(%L,%L,%L,%L)',v_contract,v_draft,v_actor,'missing area'),'22023');
  perform pg_temp.assert_true((select is_published from public.contract_pricing_versions where id='eed40000-0000-4000-8000-000000000011'),'invalid target validation precedes unpublishing');
  perform public.gridex_web_save_draft_pricing(v_draft,pg_temp.pricing_rows(9));
  update public.contract_area_pricing set markup_ore='NaN'::numeric where pricing_version_id=v_draft and price_area='SE1';
  perform pg_temp.expect_error(format('select public.gridex_web_publish_pricing(%L,%L,%L,%L)',v_contract,v_draft,v_actor,'nonfinite pricing'),'22023');
  perform public.gridex_web_save_draft_pricing(v_draft,pg_temp.pricing_rows(9));

  perform public.gridex_web_save_draft_pricing(v_draft,pg_temp.pricing_rows(-9));
  perform public.gridex_web_publish_pricing(v_contract,v_draft,v_actor,'Synthetic publish');
  perform pg_temp.assert_true((select min(markup_ore)=-9 and max(markup_ore)=-9 from public.contract_area_pricing where pricing_version_id=v_draft),'signed discounts can publish');
  perform pg_temp.assert_true((select count(*) from public.contract_pricing_versions where contract_id=v_contract and is_published)=1,'publication has exactly one active version');
  perform pg_temp.assert_true((select is_published and status='published' and published_at is not null from public.contract_pricing_versions where id=v_draft),'target publication flags synchronized');
  perform pg_temp.assert_true((select count(*) from public.pricing_version_audit where contract_id=v_contract and version_id=v_draft and action='publish' and performed_by=v_actor and reason='Synthetic publish')=1,'publication audit matches actor/version/reason');
  perform pg_temp.expect_error(format('select public.gridex_web_save_draft_pricing(%L,pg_temp.pricing_rows())',v_draft),'55000');
  perform pg_temp.expect_error(format('select public.gridex_web_publish_pricing(%L,null,%L,%L)',v_contract,v_actor,'__gridex_pricing_test_reject_audit__'),'23514');
  perform pg_temp.assert_true((select is_published from public.contract_pricing_versions where id=v_draft),'failed unpublish audit restores current publication');
  perform public.gridex_web_publish_pricing(v_contract,null,v_actor,'Synthetic unpublish');
  perform pg_temp.assert_true((select count(*) from public.contract_pricing_versions where contract_id=v_contract and (is_published or status='published'))=0,'unpublish clears all published flags');
  perform pg_temp.assert_true((select count(*) from public.pricing_version_audit where contract_id=v_contract and version_id=v_draft and action='unpublish' and performed_by=v_actor)=1,'unpublish records audit');
  perform public.gridex_web_save_draft_pricing('eed40000-0000-4000-8000-000000000021',pg_temp.pricing_rows(0,-125));
  perform public.gridex_web_publish_pricing('eed30000-0000-4000-8000-000000000002','eed40000-0000-4000-8000-000000000021',v_actor,'Synthetic portfolio publish');
  perform pg_temp.assert_true((select min(price_per_kwh_ore)=-125 and max(price_per_kwh_ore)=-125 from public.contract_area_pricing where pricing_version_id='eed40000-0000-4000-8000-000000000021'),'signed portfolio price semantics preserved');
  raise notice 'Atomic pricing, rollback, public visibility and permission tests passed';
end;
$$;
reset role;
rollback;
