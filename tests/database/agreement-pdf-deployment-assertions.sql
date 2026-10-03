-- Read-only deployment assertions; no contract, signature or customer mutation.
begin;
set local transaction read only;
do $$ declare relation text; browser_role text; definition record; begin
  select prosecdef,prorettype,proconfig into definition from pg_catalog.pg_proc
    where oid=to_regprocedure('public.gridex_web_record_agreement_pdf(uuid,uuid,text)');
  if not found or definition.prosecdef or definition.prorettype<>'jsonb'::regtype
    or not coalesce('search_path=""'=any(definition.proconfig),false) then
    raise exception 'PDF RPC missing or not the service-only invoker JSON function with empty search path';
  end if;
  if has_function_privilege('anon','public.gridex_web_record_agreement_pdf(uuid,uuid,text)','EXECUTE')
    or has_function_privilege('authenticated','public.gridex_web_record_agreement_pdf(uuid,uuid,text)','EXECUTE')
    or not has_function_privilege('service_role','public.gridex_web_record_agreement_pdf(uuid,uuid,text)','EXECUTE') then
    raise exception 'Incorrect PDF RPC execution ACL';
  end if;
  foreach relation in array array['public.contract_agreements','public.contract_agreement_audit'] loop
    if not exists(select 1 from pg_catalog.pg_class where oid=relation::regclass and relrowsecurity) then
      raise exception 'Agreement/audit RLS is not enabled on %',relation;
    end if;
    foreach browser_role in array array['anon','authenticated'] loop
      if has_table_privilege(browser_role,relation,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        or has_any_column_privilege(browser_role,relation,'INSERT,UPDATE,REFERENCES') then
        raise exception 'Browser agreement/audit mutation ACL retained for % on %',browser_role,relation;
      end if;
    end loop;
    if not has_table_privilege('service_role',relation,'SELECT') then
      raise exception 'Service agreement/audit read ACL missing';
    end if;
  end loop;
  if not has_table_privilege('service_role','public.contract_agreements','UPDATE')
    or not has_table_privilege('service_role','public.contract_agreement_audit','INSERT') then
    raise exception 'PDF transaction service writes unavailable';
  end if;
  if exists(select 1 from pg_catalog.pg_policy where polrelid='public.contract_agreements'::regclass
      and polname in('admin_full_access_agreements','user_can_read_own_agreements','users can read own agreements'))
    or not exists(select 1 from pg_catalog.pg_policy where polrelid='public.contract_agreements'::regclass
      and polname='gridex_web_agreements_read' and polcmd='r' and polroles=array['authenticated'::regrole::oid]) then
    raise exception 'Unsafe agreement role-name policy remains or the active owner/global-read policy is missing';
  end if;
  if exists(select 1 from pg_catalog.pg_policy where polrelid='public.contract_agreement_audit'::regclass
      and polname in('contract_agreement_audit_admin_insert','contract_agreement_audit_admin_read'))
    or not exists(select 1 from pg_catalog.pg_policy where polrelid='public.contract_agreement_audit'::regclass
      and polname='gridex_web_agreement_audit_read' and polcmd='r' and polroles=array['authenticated'::regrole::oid]) then
    raise exception 'Unsafe agreement audit policy remains or global audit-read policy is missing';
  end if;
end $$;
select 'Agreement PDF service transaction, browser mutation ACL and active-owner/global-read RLS deployed' as result;
rollback;
