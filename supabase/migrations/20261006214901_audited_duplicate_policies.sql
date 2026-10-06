-- Remove only exact observed policy duplicates. Keep access expressions and roles.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $$
declare pair record; k pg_policy%rowtype; d pg_policy%rowtype; relation oid;
begin
  for pair in select * from (values
    ('audit_logs','gridex_db1_audit_logs_insert','gridex_db3_audit_logs_insert_company'),
    ('audit_logs','gridex_db1_audit_logs_select','gridex_db3_audit_logs_select_company'),
    ('audit_logs','gridex_db1_audit_logs_update','gridex_db3_audit_logs_update_company'),
    ('billing_export_runs','gridex_db1_billing_export_runs_insert','gridex_db3_billing_export_runs_insert_company'),
    ('billing_export_runs','gridex_db1_billing_export_runs_select','gridex_db3_billing_export_runs_select_company'),
    ('billing_export_runs','gridex_db1_billing_export_runs_update','gridex_db3_billing_export_runs_update_company'),
    ('billing_underlays','gridex_db1_billing_underlays_insert','gridex_db3_billing_underlays_insert_company'),
    ('billing_underlays','gridex_db1_billing_underlays_select','gridex_db3_billing_underlays_select_company'),
    ('billing_underlays','gridex_db1_billing_underlays_update','gridex_db3_billing_underlays_update_company'),
    ('communication_routes','gridex_db1_communication_routes_insert','gridex_db3_communication_routes_insert_company'),
    ('communication_routes','gridex_db1_communication_routes_select','gridex_db3_communication_routes_select_company'),
    ('communication_routes','gridex_db1_communication_routes_update','gridex_db3_communication_routes_update_company'),
    ('companies','gridex_db1_companies_insert','gridex_db3_companies_platform_insert'),
    ('companies','gridex_db1_companies_update','gridex_db3_companies_platform_update'),
    ('company_invitations','gridex_db1_company_invitations_insert','gridex_db3_company_invitations_insert_company'),
    ('company_invitations','gridex_db1_company_invitations_select','gridex_db3_company_invitations_select_company'),
    ('company_invitations','gridex_db1_company_invitations_update','gridex_db3_company_invitations_update_company'),
    ('company_memberships','gridex_db1_company_memberships_insert','gridex_db3_company_memberships_insert_company'),
    ('company_memberships','gridex_db1_company_memberships_select','gridex_db3_company_memberships_select_company'),
    ('company_memberships','gridex_db1_company_memberships_update','gridex_db3_company_memberships_update_company'),
    ('contract_agreements','user_can_read_own_agreements','users can read own agreements'),
    ('customer_contracts','gridex_db1_customer_contracts_insert','gridex_db3_customer_contracts_insert_company'),
    ('customer_contracts','gridex_db1_customer_contracts_select','gridex_db3_customer_contracts_select_company'),
    ('customer_contracts','gridex_db1_customer_contracts_update','gridex_db3_customer_contracts_update_company'),
    ('customer_sites','gridex_db1_customer_sites_insert','gridex_db3_customer_sites_insert_company'),
    ('customer_sites','gridex_db1_customer_sites_select','gridex_db3_customer_sites_select_company'),
    ('customer_sites','gridex_db1_customer_sites_update','gridex_db3_customer_sites_update_company'),
    ('customers','gridex_db1_customers_insert','gridex_db3_customers_insert_company'),
    ('customers','gridex_db1_customers_select','gridex_db3_customers_select_company'),
    ('customers','gridex_db1_customers_update','gridex_db3_customers_update_company'),
    ('ediel_actor_settings','gridex_db1_ediel_actor_settings_insert','gridex_db3_ediel_actor_settings_insert_company'),
    ('ediel_actor_settings','gridex_db1_ediel_actor_settings_select','gridex_db3_ediel_actor_settings_select_company'),
    ('ediel_actor_settings','gridex_db1_ediel_actor_settings_update','gridex_db3_ediel_actor_settings_update_company'),
    ('ediel_message_events','gridex_db1_ediel_message_events_insert','gridex_db3_ediel_message_events_insert_company'),
    ('ediel_message_events','gridex_db1_ediel_message_events_select','gridex_db3_ediel_message_events_select_company'),
    ('ediel_message_events','gridex_db1_ediel_message_events_update','gridex_db3_ediel_message_events_update_company'),
    ('ediel_messages','gridex_db1_ediel_messages_insert','gridex_db3_ediel_messages_insert_company'),
    ('ediel_messages','gridex_db1_ediel_messages_select','gridex_db3_ediel_messages_select_company'),
    ('ediel_messages','gridex_db1_ediel_messages_update','gridex_db3_ediel_messages_update_company'),
    ('ediel_route_profiles','gridex_db1_ediel_route_profiles_insert','gridex_db3_ediel_route_profiles_insert_company'),
    ('ediel_route_profiles','gridex_db1_ediel_route_profiles_select','gridex_db3_ediel_route_profiles_select_company'),
    ('ediel_route_profiles','gridex_db1_ediel_route_profiles_update','gridex_db3_ediel_route_profiles_update_company'),
    ('metering_points','gridex_db1_metering_points_insert','gridex_db3_metering_points_insert_company'),
    ('metering_points','gridex_db1_metering_points_select','gridex_db3_metering_points_select_company'),
    ('metering_points','gridex_db1_metering_points_update','gridex_db3_metering_points_update_company'),
    ('outbound_requests','gridex_db1_outbound_requests_insert','gridex_db3_outbound_requests_insert_company'),
    ('outbound_requests','gridex_db1_outbound_requests_select','gridex_db3_outbound_requests_select_company'),
    ('outbound_requests','gridex_db1_outbound_requests_update','gridex_db3_outbound_requests_update_company'),
    ('powers_of_attorney','gridex_db1_powers_of_attorney_insert','gridex_db3_powers_of_attorney_insert_company'),
    ('powers_of_attorney','gridex_db1_powers_of_attorney_select','gridex_db3_powers_of_attorney_select_company'),
    ('powers_of_attorney','gridex_db1_powers_of_attorney_update','gridex_db3_powers_of_attorney_update_company'),
    ('supplier_switch_requests','gridex_db1_supplier_switch_requests_insert','gridex_db3_supplier_switch_requests_insert_company'),
    ('supplier_switch_requests','gridex_db1_supplier_switch_requests_select','gridex_db3_supplier_switch_requests_select_company'),
    ('supplier_switch_requests','gridex_db1_supplier_switch_requests_update','gridex_db3_supplier_switch_requests_update_company')
  ) as pairs(table_name,keep_name,drop_name) loop
    relation:=to_regclass('public.'||pair.table_name);
    if relation is null then continue; end if;
    select * into k from pg_policy where polrelid=relation and polname=pair.keep_name;
    if not found then continue; end if;
    select * into d from pg_policy where polrelid=relation and polname=pair.drop_name;
    if not found then continue; end if;
    if k.polpermissive and d.polpermissive and k.polcmd=d.polcmd
      and k.polroles=d.polroles
      and pg_get_expr(k.polqual,k.polrelid) is not distinct from pg_get_expr(d.polqual,d.polrelid)
      and pg_get_expr(k.polwithcheck,k.polrelid) is not distinct from pg_get_expr(d.polwithcheck,d.polrelid)
    then
      execute format('drop policy %I on public.%I',pair.drop_name,pair.table_name);
    end if;
  end loop;
end $$;
commit;
