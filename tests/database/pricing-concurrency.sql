-- LOCAL ONLY setup for concurrent multi-connection tests. This is deliberately
-- restricted to the isolated test database and commits synthetic test fixtures
-- so separate PostgreSQL sessions can observe each other.
-- Harness scenarios: (1) publish then concurrent save -> save waits/rejects;
-- (2) save then concurrent publish -> publisher waits/sees saved four rows;
-- (3) two publishers -> serialized, last publication wins, both audits persist.
do $$ begin
  if current_database() <> 'gridex_pricing_security_20261002' then
    raise exception 'Native pricing concurrency setup must only run in its isolated test database';
  end if;
end; $$;
create or replace function public.gridex_pricing_native_test_rows(p_markup numeric) returns jsonb
language sql security invoker set search_path='' as $$
select jsonb_agg(jsonb_build_object('price_area',a,'markup_ore',p_markup,'price_per_kwh_ore',0,
  'monthly_fee_sek',49,'variable_fee_ore',2,'elcert_ore',1) order by a)
from unnest(array['SE1','SE2','SE3','SE4']) a;
$$;
grant execute on function public.gridex_pricing_native_test_rows(numeric) to service_role;
insert into auth.users(id,email) values('ccd10000-0000-4000-8000-000000000001','native-pricing-concurrency@example.invalid');
insert into public.contract_products(id,name,slug,contract_type,is_active) values
('ccd30000-0000-4000-8000-000000000001','Native concurrency publish/save','__native_concurrency_1__','spot_hourly',true),
('ccd30000-0000-4000-8000-000000000002','Native concurrency save/publish','__native_concurrency_2__','spot_hourly',true),
('ccd30000-0000-4000-8000-000000000003','Native concurrency publishers','__native_concurrency_3__','spot_hourly',true);
insert into public.contract_pricing_versions(id,contract_id,version_number,valid_from) values
('ccd40000-0000-4000-8000-000000000011','ccd30000-0000-4000-8000-000000000001',1,current_date),
('ccd40000-0000-4000-8000-000000000021','ccd30000-0000-4000-8000-000000000002',1,current_date),
('ccd40000-0000-4000-8000-000000000031','ccd30000-0000-4000-8000-000000000003',1,current_date),
('ccd40000-0000-4000-8000-000000000032','ccd30000-0000-4000-8000-000000000003',2,current_date);
insert into public.contract_area_pricing(pricing_version_id,price_area,price_per_kwh_ore,markup_ore,monthly_fee_sek,variable_fee_ore,elcert_ore)
select v.id,a,0,8,49,2,1
from public.contract_pricing_versions v cross join unnest(array['SE1','SE2','SE3','SE4']) a
where v.id::text like 'ccd40000-%';
