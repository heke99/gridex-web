begin;
-- Gridex Web customer/Auth/support prerequisites only. No price administration,
-- staff delivery, upstream schemas, or customer data are inspected.
create or replace function public.gridex_web_customer_readiness_v1()
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare missing text[] := '{}'; t text; signature text; r regclass; f regprocedure;
begin
  foreach t in array array['customer_profiles','customer_delivery_points','customer_notifications','customer_contracts','auth_profile_sync_jobs','public_support_receipts'] loop
    r := to_regclass('public.' || t);
    if r is null then missing := array_append(missing,'table:' || t); continue; end if;
    if not (select relrowsecurity from pg_catalog.pg_class where oid=r) then
      missing := array_append(missing,'rls:' || t);
    end if;
    if has_table_privilege('authenticated',r,'INSERT,UPDATE,DELETE,TRUNCATE') or has_any_column_privilege('authenticated',r,'INSERT,UPDATE')
      or has_table_privilege('anon',r,'INSERT,UPDATE,DELETE,TRUNCATE') or has_any_column_privilege('anon',r,'INSERT,UPDATE') then
      missing := array_append(missing,'client_write_grants:' || t);
    end if;
  end loop;
  foreach signature in array array[
    'public.gridex_my_permissions_v1()', 'public.gridex_my_has_permission_v1(text)', 'public.gridex_my_log_login_v1()',
    'public.gridex_enqueue_auth_profile_v1(uuid,text)', 'public.gridex_commit_auth_profile_v1(uuid,integer,timestamp with time zone)',
    'public.gridex_create_public_inquiry_v1(uuid,text,text,text,text,text,text,text,text,text)', 'public.gridex_claim_public_receipts_v1(integer)'
  ] loop
    f := to_regprocedure(signature);
    if f is null then missing := array_append(missing,'function:' || signature); continue; end if;
    if has_function_privilege('anon',f,'EXECUTE') then missing := array_append(missing,'anon_execute:' || signature); end if;
    if not has_function_privilege('service_role',f,'EXECUTE') then missing := array_append(missing,'service_execute:' || signature); end if;
    if signature not like 'public.gridex_my_%' and has_function_privilege('authenticated',f,'EXECUTE') then
      missing := array_append(missing,'client_execute:' || signature);
    elsif signature like 'public.gridex_my_%' and not has_function_privilege('authenticated',f,'EXECUTE') then
      missing := array_append(missing,'session_execute:' || signature);
    end if;
  end loop;
  return jsonb_build_object('ready',cardinality(missing)=0,'missing',to_jsonb(missing),'schema_revision','2026-10-07-web-customer-1');
end $$;
revoke all on function public.gridex_web_customer_readiness_v1() from public,anon,authenticated;
grant execute on function public.gridex_web_customer_readiness_v1() to service_role;
commit;
