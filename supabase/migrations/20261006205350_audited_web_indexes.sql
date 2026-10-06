begin;
-- Only remove observed duplicates when the live catalog proves structural equality.
-- Constraint-backed indexes are always retained; DROP uses RESTRICT, never CASCADE.
do $$
declare pair record; k oid; d oid;
begin
  for pair in select * from (values
    ('company_memberships_company_id_user_id_key','ux_company_memberships_company_user'),
    ('contract_area_pricing_pricing_version_id_price_area_key','contract_area_pricing_unique_area'),
    ('contract_area_pricing_pricing_version_id_price_area_key','contract_area_pricing_unique_version_area'),
    ('contract_pricing_versions_one_published_per_contract','one_live_version_per_contract'),
    ('contract_pricing_versions_one_published_per_contract','one_published_version_per_contract'),
    ('customer_sites_customer_company_created_idx','customer_sites_customer_company_idx'),
    ('gridex_monthly_spot_prices_ym_area_idx','gridex_monthly_spot_prices_ym_idx'),
    ('gridex_spot_basis_publish_log_created_at_idx','idx_gridex_spot_publish_log_created_at')
  ) as pairs(keep_name,drop_name) loop
    k:=to_regclass('public.'||pair.keep_name); d:=to_regclass('public.'||pair.drop_name);
    if k is null or d is null then continue; end if;
    if exists(select 1 from pg_constraint where conindid=d) then continue; end if;
    if exists(select 1 from pg_index a join pg_index b on a.indrelid=b.indrelid join pg_class ac on ac.oid=a.indexrelid join pg_class bc on bc.oid=b.indexrelid
      where a.indexrelid=k and b.indexrelid=d and a.indisvalid and b.indisvalid
      and ac.relam=bc.relam and a.indisunique=b.indisunique and a.indnullsnotdistinct=b.indnullsnotdistinct
      and a.indnkeyatts=b.indnkeyatts and a.indnatts=b.indnatts
      and a.indkey::text=b.indkey::text and a.indclass::text=b.indclass::text and a.indcollation::text=b.indcollation::text and a.indoption::text=b.indoption::text
      and pg_get_expr(a.indpred,a.indrelid) is not distinct from pg_get_expr(b.indpred,b.indrelid)
      and pg_get_expr(a.indexprs,a.indrelid) is not distinct from pg_get_expr(b.indexprs,b.indrelid)) then
      execute format('drop index public.%I',pair.drop_name);
    end if;
  end loop;
end $$;
do $$
declare item record;
begin
  for item in select * from (values
    ('customer_contracts','user_id'),('customer_invoices','portal_contract_id'),
    ('customer_portal_write_outbox','user_id'),('customer_support_messages','sender_user_id'),
    ('customer_support_tickets','assigned_user_id'),('customer_support_tickets','portal_contract_id'),
    ('website_application_results','user_id'),('contract_agreements','user_id'),
    ('contract_agreement_audit','agreement_id'),('contract_acceptance_log','agreement_id')
  ) as items(table_name,column_name) loop
    if to_regclass('public.'||item.table_name) is null then continue; end if;
    execute format('create index if not exists %I on public.%I (%I)',item.table_name||'_'||item.column_name||'_audit_idx',item.table_name,item.column_name);
  end loop;
end $$;
commit;
