-- Production security surface hardening
-- 2026-08-14
--
-- Scope:
-- * Remove browser/client execution rights from internal SECURITY DEFINER repair,
--   backfill, admin, publishing and lifecycle RPCs.
-- * Keep only authenticated access for tenant/RLS helpers that derive identity
--   from auth.uid(), while removing anonymous/public execution.
-- * Prevent arbitrary-user RBAC inspection RPCs from being callable by clients.
-- * Make exposed views obey caller permissions/RLS (security_invoker).
-- * Remove client access from internal diagnostic/reconciliation views.
-- * Pin search_path on functions reported as mutable by the database linter.
--
-- This migration intentionally changes privileges/security semantics only.
-- It does not delete customer data or relax RLS.

do $$
declare
  r record;
  v_signature text;
begin
  -- Internal / privileged routines must never be callable through PostgREST by
  -- anon or regular authenticated clients.
  for r in
    select n.nspname, p.proname, p.oid,
           pg_get_function_identity_arguments(p.oid) as identity_args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
        'admin_customer_latest_contract_counts',
        'backfill_companies',
        'backfill_contracts',
        'backfill_customer_sites',
        'backfill_customers',
        'backfill_metering_points',
        'backfill_poa_scopes',
        'ediel_resolve_inbound_message_rules',
        'ediel_resolve_message_rule',
        'gridex_apply_signup_order_status',
        'gridex_companies_missing_ediel_profile',
        'gridex_companies_missing_route_setup',
        'gridex_db1_default_company_id',
        'gridex_db1_finish_backfill_run',
        'gridex_db1_log_finding',
        'gridex_db1_start_backfill_run',
        'gridex_db1_try_exec',
        'gridex_db2_v4_assert_ready',
        'gridex_db2_v4_default_company_id',
        'gridex_db2_v4_log_backfill_item',
        'gridex_db2_v4_log_finding',
        'gridex_db2_v4_run_customer_profile_backfill',
        'gridex_db2_v4_run_membership_reconciliation',
        'gridex_db4b_archive_customer_registry_row',
        'gridex_log_customer_agreement_event',
        'gridex_spot_publish_active_basis',
        'gridex_spot_rollback_last_publish'
      ]::text[])
  loop
    v_signature := format('%I.%I(%s)', r.nspname, r.proname, r.identity_args);
    execute 'revoke execute on function ' || v_signature || ' from public, anon, authenticated';
    execute 'grant execute on function ' || v_signature || ' to service_role';
  end loop;

  -- These helpers are intentionally callable by signed-in users because they
  -- are used to enforce tenant/RLS decisions based on auth.uid(). They must
  -- never be callable anonymously and must not inherit PUBLIC execute.
  for r in
    select n.nspname, p.proname, p.oid,
           pg_get_function_identity_arguments(p.oid) as identity_args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
        'gridex_can_read_company',
        'gridex_can_write_company',
        'gridex_user_can_manage_company',
        'gridex_user_company_ids',
        'gridex_user_has_role_key',
        'gridex_user_is_platform_admin'
      ]::text[])
  loop
    v_signature := format('%I.%I(%s)', r.nspname, r.proname, r.identity_args);
    execute 'revoke execute on function ' || v_signature || ' from public, anon';
    execute 'grant execute on function ' || v_signature || ' to authenticated, service_role';
  end loop;

  -- These functions accept an arbitrary user_id and are SECURITY DEFINER.
  -- Client execution creates an IDOR/privilege-enumeration surface. Server-side
  -- privileged callers retain service_role access.
  for r in
    select n.nspname, p.proname, p.oid,
           pg_get_function_identity_arguments(p.oid) as identity_args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
        'gridex_get_user_permission_overrides',
        'gridex_get_user_permissions',
        'gridex_get_user_roles'
      ]::text[])
  loop
    v_signature := format('%I.%I(%s)', r.nspname, r.proname, r.identity_args);
    execute 'revoke execute on function ' || v_signature || ' from public, anon, authenticated';
    execute 'grant execute on function ' || v_signature || ' to service_role';
  end loop;
end
$$;

-- Views flagged by the Supabase security advisor must evaluate underlying
-- permissions and RLS as the querying role, not as the view owner.
do $$
declare
  v_name text;
begin
  foreach v_name in array array[
    'gridex_debug_step1_2_schema_alignment_v',
    'gridex_debug_batch2_rbac_v',
    'ediel_active_actor_settings_v',
    'ediel_route_runtime_v',
    'ediel_message_ack_state_v',
    'ediel_overdue_message_acks_v',
    'ediel_duplicate_ack_candidates_v',
    'ediel_rule_ambiguities_v',
    'gridex_debug_batch2_tenant_policy_gaps_v',
    'gridex_user_auth_integrity_v',
    'customer_portal_overview_v1',
    'gridex_db1_schema_gap_v',
    'gridex_db1_tenant_gap_v',
    'gridex_db1_duplicate_customer_candidates_v',
    'gridex_db1_duplicate_site_candidates_v',
    'gridex_db1_duplicate_metering_point_candidates_v',
    'gridex_db1_rbac_health_v',
    'gridex_db1_rls_policy_gap_v',
    'gridex_db1_storage_gap_v',
    'gridex_db1_backfill_readiness_v',
    'customer_contract_status_v1',
    'gridex_db2_v4_source_inventory_v',
    'gridex_db2_v4_schema_contract_v',
    'gridex_db2_v4_company_overview_v',
    'gridex_db2_v4_company_reconciliation_v',
    'gridex_db2_v4_membership_candidates_v',
    'gridex_db2_v4_customer_profile_candidates_v',
    'gridex_db2_v4_customer_profile_mapping_v',
    'gridex_db2_v4_current_backfill_items_v',
    'gridex_db2_v4_profile_review_v',
    'gridex_db2_v4_backfill_run_summary_v',
    'gridex_db2_v4_final_readiness_v',
    'gridex_db2b_superadmin_target_v',
    'gridex_db2b_preflight_v',
    'gridex_db3_rbac_snapshot_v',
    'gridex_db3_final_readiness_v',
    'gridex_db2b_superadmin_membership_v',
    'gridex_db2b_final_readiness_v',
    'gridex_db2b_rbac_snapshot_v',
    'gridex_db3_tenant_policy_gaps_v',
    'gridex_db3_tenant_data_gaps_v',
    'gridex_db4b_customer_registry_visibility_v'
  ]
  loop
    if to_regclass(format('public.%I', v_name)) is not null then
      execute format('alter view public.%I set (security_invoker = true)', v_name);
    end if;
  end loop;

  -- auth.users integrity diagnostics are internal only.
  if to_regclass('public.gridex_user_auth_integrity_v') is not null then
    execute 'revoke all on public.gridex_user_auth_integrity_v from public, anon, authenticated';
    execute 'grant select on public.gridex_user_auth_integrity_v to service_role';
  end if;

  -- Debug, repair, Ediel operational and reconciliation views are internal
  -- diagnostics; regular browser roles must not read them directly.
  foreach v_name in array array[
    'gridex_debug_step1_2_schema_alignment_v',
    'gridex_debug_batch2_rbac_v',
    'gridex_debug_batch2_tenant_policy_gaps_v',
    'ediel_active_actor_settings_v',
    'ediel_route_runtime_v',
    'ediel_message_ack_state_v',
    'ediel_overdue_message_acks_v',
    'ediel_duplicate_ack_candidates_v',
    'ediel_rule_ambiguities_v',
    'gridex_db1_schema_gap_v',
    'gridex_db1_tenant_gap_v',
    'gridex_db1_duplicate_customer_candidates_v',
    'gridex_db1_duplicate_site_candidates_v',
    'gridex_db1_duplicate_metering_point_candidates_v',
    'gridex_db1_rbac_health_v',
    'gridex_db1_rls_policy_gap_v',
    'gridex_db1_storage_gap_v',
    'gridex_db1_backfill_readiness_v',
    'gridex_db2_v4_source_inventory_v',
    'gridex_db2_v4_schema_contract_v',
    'gridex_db2_v4_company_overview_v',
    'gridex_db2_v4_company_reconciliation_v',
    'gridex_db2_v4_membership_candidates_v',
    'gridex_db2_v4_customer_profile_candidates_v',
    'gridex_db2_v4_customer_profile_mapping_v',
    'gridex_db2_v4_current_backfill_items_v',
    'gridex_db2_v4_profile_review_v',
    'gridex_db2_v4_backfill_run_summary_v',
    'gridex_db2_v4_final_readiness_v',
    'gridex_db2b_superadmin_target_v',
    'gridex_db2b_preflight_v',
    'gridex_db3_rbac_snapshot_v',
    'gridex_db3_final_readiness_v',
    'gridex_db2b_superadmin_membership_v',
    'gridex_db2b_final_readiness_v',
    'gridex_db2b_rbac_snapshot_v',
    'gridex_db3_tenant_policy_gaps_v',
    'gridex_db3_tenant_data_gaps_v',
    'gridex_db4b_customer_registry_visibility_v'
  ]
  loop
    if to_regclass(format('public.%I', v_name)) is not null then
      execute format('revoke all on public.%I from public, anon, authenticated', v_name);
      execute format('grant select on public.%I to service_role', v_name);
    end if;
  end loop;
end
$$;

-- Pin search_path on the specific functions reported by the current security
-- advisor. Include extensions because several normalizers/hash helpers depend
-- on extension-provided operators/functions.
do $$
declare
  r record;
  v_signature text;
begin
  for r in
    select n.nspname, p.proname, p.oid,
           pg_get_function_identity_arguments(p.oid) as identity_args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
        'gridex_db2_v4_col_exists',
        'gridex_debug_column_exists',
        'gridex_table_has_company_id',
        'gridex_make_idempotency_key',
        'make_idempotency_key',
        'gridex_normalize_email',
        'gridex_normalize_phone',
        'gridex_normalize_personal_number',
        'gridex_normalize_org_number',
        'gridex_normalize_facility_id',
        'gridex_normalize_metering_point_id',
        'gridex_make_source_hash',
        'normalize_email',
        'normalize_phone',
        'normalize_personal_number',
        'normalize_facility_id',
        'set_current_timestamp_updated_at',
        'gridex_db2_v4_table_exists',
        'gridex_db2_v4_text_has_value',
        'gridex_db2_v4_normalize_membership_role',
        'gridex_db2_v4_customer_signal',
        'gridex_db2_v4_profile_decision',
        'gridex_customer_status_label',
        'gridex_customer_status_step'
      ]::text[])
  loop
    v_signature := format('%I.%I(%s)', r.nspname, r.proname, r.identity_args);
    execute 'alter function ' || v_signature ||
            ' set search_path = pg_catalog, public, extensions';
  end loop;
end
$$;
