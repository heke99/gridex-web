-- LOCAL ONLY: actual permission functions, real RLS/grants and transactional RPC.
begin;
do $$ declare baseline record; actual record; browser_role text; relation text; begin
  for baseline in select * from gridex_test.agreement_catalog_before loop
    select c.relname,c.relrowsecurity,c.relforcerowsecurity,
      (select jsonb_agg(to_jsonb(a) order by a.grantee,a.grantor,a.is_grantable)
        from pg_catalog.aclexplode(c.relacl) a where a.privilege_type='SELECT') as select_acl,
      (select jsonb_agg(to_jsonb(a) order by a.grantee,a.grantor,a.privilege_type,a.is_grantable)
        from pg_catalog.aclexplode(c.relacl) a where a.grantee='service_role'::regrole) as service_acl
      into actual from pg_catalog.pg_class c where c.oid=format('public.%I',baseline.relname)::regclass;
    if to_jsonb(actual) is distinct from to_jsonb(baseline) then
      raise exception 'Agreement/audit SELECT grants, service grants or RLS settings changed';
    end if;
  end loop;
  foreach browser_role in array array['anon','authenticated'] loop
    foreach relation in array array['public.contract_agreements','public.contract_agreement_audit'] loop
      if has_table_privilege(browser_role,relation,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        or has_any_column_privilege(browser_role,relation,'INSERT,UPDATE,REFERENCES') then
        raise exception 'Agreement/audit browser mutation grant remained for % on %',browser_role,relation;
      end if;
    end loop;
  end loop;
  if (select prosecdef from pg_proc where oid='public.gridex_web_record_agreement_pdf(uuid,uuid,text)'::regprocedure)
    or has_function_privilege('anon','public.gridex_web_record_agreement_pdf(uuid,uuid,text)','EXECUTE')
    or has_function_privilege('authenticated','public.gridex_web_record_agreement_pdf(uuid,uuid,text)','EXECUTE')
    or not has_function_privilege('service_role','public.gridex_web_record_agreement_pdf(uuid,uuid,text)','EXECUTE') then
    raise exception 'PDF RPC must be security invoker and service-only';
  end if;
end $$;

-- Customers keep only their own history; global grants permit the directory.
-- A console grant, company administrator, revoked role or disabled account do not.
do $$ declare actor text; expected integer; expected_audit integer; actual integer; begin
  foreach actor in array array['owner','outsider','reader','writer','exporter','company-admin','disabled','revoked','support'] loop
    perform set_config('request.jwt.claim.sub',md5('pdf-'||actor)::uuid::text,true);
    execute 'set local role authenticated';
    select count(*) into actual from public.contract_agreements;
    expected:=case when actor in('reader','writer','exporter') then 2 when actor in('owner','outsider') then 1 else 0 end;
    if actual<>expected then raise exception 'Agreement visibility for %: expected %, got %',actor,expected,actual; end if;
    select count(*) into actual from public.contract_agreement_audit;
    expected_audit:=case when actor in('reader','writer') then 1 else 0 end;
    if actual<>expected_audit then raise exception 'Internal audit visibility for %: expected %, got %',actor,expected_audit,actual; end if;
    execute 'reset role';
  end loop;
end $$;
insert into public.user_profiles(id,user_id,user_status) values(md5('pdf-owner')::uuid,md5('pdf-owner')::uuid,'disabled');
select set_config('request.jwt.claim.sub',md5('pdf-owner')::uuid::text,true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.contract_agreements) then raise exception 'Disabled owner retained history through an old JWT'; end if;
end $$;
reset role;
delete from public.user_profiles where user_id=md5('pdf-owner')::uuid;

-- Actual former company-admin ALL policy cannot reopen browser mutations.
select set_config('request.jwt.claim.sub',md5('pdf-company-admin')::uuid::text,true);
set local role authenticated;
do $$ declare statement text; blocked boolean; begin
  foreach statement in array array[
    $q$insert into public.contract_agreements(sign_method) values('email')$q$,
    $q$update public.contract_agreements set status='activated'$q$,
    $q$delete from public.contract_agreements$q$,
    $q$truncate public.contract_agreements$q$,
    $q$insert into public.contract_agreement_audit(action,performed_by) values('forged',auth.uid())$q$,
    $q$update public.contract_agreement_audit set metadata='{}'$q$,
    $q$delete from public.contract_agreement_audit$q$,
    $q$truncate public.contract_agreement_audit$q$
  ] loop
    blocked:=false;
    begin execute statement; exception when insufficient_privilege then blocked:=true; end;
    if not blocked then raise exception 'Browser mutation accepted: %',statement; end if;
  end loop;
  blocked:=false;
  begin perform public.gridex_web_record_agreement_pdf(md5('pdf-writer')::uuid,md5('pdf-agreement')::uuid,md5('pdf-agreement')::uuid::text||'.pdf');
    exception when insufficient_privilege then blocked:=true;
  end;
  if not blocked then raise exception 'Browser invoked the service-only RPC'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$ begin
  if exists(select 1 from public.contract_agreements) or exists(select 1 from public.contract_agreement_audit) then
    raise exception 'Anonymous caller sees agreement or internal audit PII';
  end if;
end $$;
reset role;

-- The actual service function must recheck the global actor, never a company grant.
set local role service_role;
do $$ declare actor text; blocked boolean; result jsonb; begin
  foreach actor in array array['owner','reader','exporter','company-admin','disabled','revoked','support'] loop
    blocked:=false;
    begin perform public.gridex_web_record_agreement_pdf(md5('pdf-'||actor)::uuid,md5('pdf-agreement')::uuid,md5('pdf-agreement')::uuid::text||'.pdf');
      exception when insufficient_privilege then blocked:=true;
    end;
    if not blocked then raise exception 'Unprivileged actor % generated an agreement PDF',actor; end if;
  end loop;
  result:=public.gridex_web_record_agreement_pdf(md5('pdf-writer')::uuid,md5('pdf-agreement')::uuid,md5('pdf-agreement')::uuid::text||'.pdf');
  if result->>'pdf_path'<>md5('pdf-agreement')::uuid::text||'.pdf' then raise exception 'Wrong PDF result'; end if;
  if not exists(select 1 from public.contract_agreements where id=md5('pdf-agreement')::uuid
    and contract_pdf_path=md5('pdf-agreement')::uuid::text||'.pdf' and status='email_sent'
    and email_signed_at is null and bankid_completed_at is null and activated_at is null and welcome_email_sent_at is null) then
    raise exception 'PDF generation changed legal, activation or delivery state';
  end if;
  if not exists(select 1 from public.contract_agreement_audit where agreement_id=md5('pdf-agreement')::uuid
    and action='pdf_generated' and performed_by=md5('pdf-writer')::uuid
    and metadata->>'pdf_path'=md5('pdf-agreement')::uuid::text||'.pdf') then
    raise exception 'PDF metadata saved without the actual actor audit';
  end if;
  perform public.gridex_web_record_agreement_pdf(md5('pdf-writer')::uuid,md5('pdf-signed')::uuid,'archive/historical.pdf');
  if not exists(select 1 from public.contract_agreements where id=md5('pdf-signed')::uuid
    and status='bankid_signed' and bankid_completed_at='2026-10-01T12:00:00Z'
    and welcome_email_sent_at='2026-10-01T13:00:00Z' and activated_at is null) then
    raise exception 'Historical PDF reuse altered signature/email state';
  end if;
end $$;
reset role;

-- Prove real rollback when audit insertion fails after the agreement UPDATE.
create function gridex_test.fail_pdf_audit() returns trigger language plpgsql as $$
begin if new.action='pdf_generated' then raise exception 'synthetic PDF audit failure'; end if; return new; end;
$$;
create trigger test_fail_pdf_audit before insert on public.contract_agreement_audit
for each row execute function gridex_test.fail_pdf_audit();
set local role service_role;
do $$ declare blocked boolean:=false; previous_count integer; begin
  select count(*) into previous_count from public.contract_agreement_audit;
  begin perform public.gridex_web_record_agreement_pdf(md5('pdf-writer')::uuid,md5('pdf-signed')::uuid,md5('pdf-signed')::uuid::text||'.pdf');
    exception when raise_exception then
      if sqlerrm<>'synthetic PDF audit failure' then raise; end if;
      blocked:=true;
  end;
  if not blocked then raise exception 'Forced audit failure did not reject PDF operation'; end if;
  if (select contract_pdf_path from public.contract_agreements where id=md5('pdf-signed')::uuid)<>'archive/historical.pdf'
    or (select count(*) from public.contract_agreement_audit)<>previous_count then
    raise exception 'Audit failure left a partial agreement metadata write';
  end if;
end $$;
reset role;
drop trigger test_fail_pdf_audit on public.contract_agreement_audit;

set local role service_role;
do $$ declare path text; blocked boolean; begin
  foreach path in array array['different.pdf','../escape.pdf','archive/../escape.pdf','/absolute.pdf','archive//empty.pdf','https://example.test/leak.pdf',''] loop
    blocked:=false;
    begin perform public.gridex_web_record_agreement_pdf(md5('pdf-writer')::uuid,md5('pdf-agreement')::uuid,path);
      exception when invalid_parameter_value then blocked:=true;
    end;
    if not blocked then raise exception 'Arbitrary PDF storage key accepted: %',path; end if;
  end loop;
  blocked:=false;
  begin perform public.gridex_web_record_agreement_pdf(md5('pdf-writer')::uuid,md5('pdf-missing')::uuid,'missing.pdf');
    exception when invalid_parameter_value then blocked:=true;
  end;
  if not blocked then raise exception 'Missing agreement reported a successful PDF'; end if;
end $$;
reset role;
select 'Agreement history RLS, service-only global PDF authority, preserved lifecycle/mail state and forced audit rollback passed' as result;
rollback;
