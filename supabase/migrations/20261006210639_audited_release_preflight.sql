begin;
-- Catalog-only readiness: no customer data or credentials are returned.
create or replace function public.gridex_web_audit_readiness_v1()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare missing text[] := '{}'; t text; signature text; r regclass;
begin
  foreach t in array array['customer_profiles','customer_delivery_points','customer_notifications','customer_contracts'] loop
    r := to_regclass('public.' || t);
    if r is null then missing := array_append(missing, 'table:' || t);
    elsif has_table_privilege('authenticated',r,'INSERT,UPDATE,DELETE') or has_any_column_privilege('authenticated',r,'INSERT,UPDATE')
      or has_table_privilege('anon',r,'INSERT,UPDATE,DELETE') or has_any_column_privilege('anon',r,'INSERT,UPDATE') then
      missing := array_append(missing, 'client_write_grants:' || t);
    end if;
  end loop;
  foreach signature in array array[
    'public.gridex_my_permissions_v1()', 'public.gridex_my_has_permission_v1(text)', 'public.gridex_my_log_login_v1()',
    'public.gridex_enqueue_auth_profile_v1(uuid,text)', 'public.gridex_commit_auth_profile_v1(uuid,integer,timestamp with time zone)',
    'public.gridex_create_pricing_version_v1(uuid,uuid,date,uuid,text)', 'public.gridex_save_pricing_rows_v1(uuid,uuid,jsonb)', 'public.gridex_publish_pricing_v1(uuid,uuid,uuid,text)',
    'public.gridex_create_public_inquiry_v1(uuid,text,text,text,text,text,text,text,text,text)', 'public.gridex_claim_public_receipts_v1(integer)',
    'public.gridex_support_claim_staff_delivery_v1(jsonb)', 'public.gridex_support_complete_staff_delivery_v1(jsonb)',
    'public.gridex_support_existing_invitation_subject_v1(text)'
  ] loop
    if to_regprocedure(signature) is null then missing := array_append(missing, 'function:' || signature); end if;
  end loop;
  foreach t in array array['public.auth_profile_sync_jobs','public.public_support_receipts','support_private.staff_invitation_deliveries'] loop
    if to_regclass(t) is null then missing := array_append(missing, 'table:' || t); end if;
  end loop;
  return jsonb_build_object('ready',cardinality(missing)=0,'missing',to_jsonb(missing),'schema_revision','2026-10-06-audit-1');
end $$;
revoke all on function public.gridex_web_audit_readiness_v1() from public, anon, authenticated;
grant execute on function public.gridex_web_audit_readiness_v1() to service_role;
commit;
