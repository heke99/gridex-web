-- LOCAL ONLY: corrected actual production trigger, real agreement enum/schema.
-- All additional synthetic data is rolled back, preserving the PDF baseline.
begin;
do $$ declare before_row record; actual record; begin
  for before_row in select * from gridex_test.agreement_projection_catalog_before loop
    select c.relname,c.relacl,c.relrowsecurity,c.relforcerowsecurity,
      (select jsonb_agg(to_jsonb(p) order by p.polname) from pg_policy p where p.polrelid=c.oid) as policies
      into strict actual from pg_class c where c.oid=('public.'||before_row.relname)::regclass;
    if to_jsonb(actual) is distinct from to_jsonb(before_row) then
      raise exception 'Projection trigger correction changed table grants/RLS/policies: %',before_row.relname;
    end if;
  end loop;
end $$;
alter table public.contract_agreements disable trigger trg_gridex_sync_portal_from_agreement;
insert into auth.users(id,email)
select md5('projection-'||actor)::uuid,actor||'@example.test' from unnest(array[
  'email','email-verified','bankid','unsigned-activated','unsigned-timestamp',
  'source-only','canonical-id','tenant-only','portal-identity','external-id',
  'verified-claim','onboarding-claim','legacy-preserve','sink-failure','null-facility'
]) actor;
insert into public.contract_agreements(id,user_id,email,first_name,last_name,phone,facility_id,
  address,postal_code,city,apartment,move_in_date,contract_slug,sign_method,status,contract_pdf_path)
select md5('projection-agreement-'||actor)::uuid,md5('projection-'||actor)::uuid,actor||'@example.test',
  'New','Legacy','0700000000','facility-'||actor,'New address','11122','Stockholm','1201','2026-11-01',
  'new-legacy-contract',case when actor='bankid' then 'bankid'::public.sign_method_enum else 'email'::public.sign_method_enum end,
  'email_sent','legacy/initial.pdf'
from unnest(array['email','email-verified','bankid','unsigned-activated','unsigned-timestamp',
  'source-only','canonical-id','tenant-only','portal-identity','external-id','verified-claim',
  'onboarding-claim','legacy-preserve','sink-failure','null-facility']) actor;
insert into public.contract_agreements(id,user_id,email,first_name,facility_id,sign_method,status,contract_pdf_path)
values(md5('projection-agreement-null-user')::uuid,null,'null-user@example.test','Unlinked','facility-null-user','email','email_sent','legacy/initial.pdf');

-- All protection modes are exercised independently; do not mask an absent
-- portal-identity guard behind a source guard that would already reject writes.
insert into public.customer_profiles(user_id,email,first_name,last_name,full_name,phone,
  onboarding_state,email_verified_at,metadata,source,canonical_ops_id,tenant_reference,
  portal_identity_id,external_customer_id,upstream_revision,upstream_version,synced_at,last_event_id,projection_status)
select md5('projection-'||actor)::uuid,'canonical-'||actor||'@example.test','Canonical','Customer','Canonical Customer','123',
  'verified','2025-01-01T00:00:00Z',
  case actor when 'verified-claim' then '{"source":"verified_checkout_portal_claim","keep":"protected"}'::jsonb
    when 'onboarding-claim' then '{"source":"ops_application_onboarding","keep":"protected"}'::jsonb
    else '{"keep":"protected"}'::jsonb end,
  case when actor='source-only' then 'ops' else 'legacy' end,
  case when actor='canonical-id' then 'ops-customer-protected' else null::text end,
  case when actor='tenant-only' then 'canonical-tenant' else null end,
  case when actor='portal-identity' then 'canonical-portal-identity' else null end,
  case when actor='external-id' then 'canonical-customer-identity' else null end,
  17,'2026-10-02.4','2026-10-01T00:00:00Z','event-protected','canonical'
from unnest(array['source-only','canonical-id','tenant-only','portal-identity','external-id','verified-claim','onboarding-claim']) actor;
insert into public.customer_delivery_points(user_id,facility_id,address,postal_code,city,apartment,move_in_date,
  is_primary,metadata,source,canonical_ops_id,tenant_reference,upstream_revision,upstream_version,synced_at,last_event_id,projection_status)
select md5('projection-'||actor)::uuid,'facility-'||actor,'Canonical address','99999','Canonical city','9999','2027-01-01',
  false,'{"keep":"protected"}',case when actor='source-only' then 'ops' else 'legacy' end,
  case when actor='canonical-id' then 'ops-site-protected' else null::text end,
  case when actor='tenant-only' then 'canonical-tenant' else null end,
  17,'2026-10-02.4','2026-10-01T00:00:00Z','event-protected','canonical'
from unnest(array['source-only','canonical-id','tenant-only']) actor;
insert into public.customer_contract_portal_links(user_id,agreement_id,contract_slug,status,signed_at,activated_at,
  metadata,source,canonical_ops_id,tenant_reference,upstream_revision,upstream_version,synced_at,last_event_id,projection_status,
  contract_provider_key,contract_external_ref)
select md5('projection-'||actor)::uuid,md5('projection-agreement-'||actor)::uuid,'canonical-contract','canonical-state',
  '2025-01-01T00:00:00Z','2025-01-02T00:00:00Z','{"keep":"protected"}',
  case when actor='source-only' then 'ops' else 'legacy' end,
  case when actor='canonical-id' then 'ops-contract-protected' else null::text end,
  case when actor='tenant-only' then 'canonical-tenant' else null end,
  17,'2026-10-02.4','2026-10-01T00:00:00Z','event-protected','canonical','ops','canonical-external-contract'
from unnest(array['source-only','canonical-id','tenant-only']) actor;
insert into public.customer_profiles(user_id,email,full_name,onboarding_state,email_verified_at,metadata)
values(md5('projection-email-verified')::uuid,'already-verified@example.test','Previously verified customer','pending_verification','2024-05-01T00:00:00Z','{"keep":"mailbox-verification"}'),
  (md5('projection-legacy-preserve')::uuid,'legacy@example.test','Existing legacy customer','verified','2024-05-01T00:00:00Z','{"keep":"legacy-provenance"}');
insert into public.customer_contract_portal_links(user_id,agreement_id,contract_slug,status,signed_at,activated_at,metadata,contract_provider_key,contract_external_ref)
values(md5('projection-legacy-preserve')::uuid,md5('projection-agreement-legacy-preserve')::uuid,
  'legacy-old-contract','email_signed','2025-03-01T00:00:00Z','2025-03-02T00:00:00Z','{"keep":"legacy-provenance"}','legacy-provider','legacy-external-ref');

-- Protect independently by known OPS projection metadata and by the canonical
-- contract provider even where legacy source/tenant/canonical fields are empty.
insert into public.customer_delivery_points(user_id,facility_id,address,metadata)
select md5('projection-'||actor)::uuid,'facility-'||actor,'Canonical metadata site',jsonb_build_object('source',src,'keep','protected')
from (values('verified-claim','verified_checkout_portal_claim'),('onboarding-claim','ops_application_onboarding')) x(actor,src);
insert into public.customer_contract_portal_links(user_id,agreement_id,contract_slug,status,metadata,contract_provider_key)
select md5('projection-'||actor)::uuid,md5('projection-agreement-'||actor)::uuid,'canonical-metadata-contract','canonical-state',
  jsonb_build_object('source',src,'keep','protected'),case when actor='portal-identity' then 'ops' else null end
from (values('verified-claim','verified_checkout_portal_claim'),('onboarding-claim','ops_application_onboarding'),('portal-identity','provider-test')) x(actor,src);

create table gridex_test.agreement_projection_protected_before as
select 'profile'::text as kind,user_id::text as key,to_jsonb(p) as row_data from public.customer_profiles p
where user_id in(select md5('projection-'||actor)::uuid from unnest(array['source-only','canonical-id','tenant-only',
  'portal-identity','external-id','verified-claim','onboarding-claim']) actor)
union all
select 'site',user_id::text,to_jsonb(p) from public.customer_delivery_points p
union all
select 'link',user_id::text,to_jsonb(p) from public.customer_contract_portal_links p where source<>'legacy' or canonical_ops_id is not null or tenant_reference is not null
  or contract_provider_key='ops' or metadata->>'source' in('verified_checkout_portal_claim','ops_application_onboarding');

alter table public.contract_agreements enable trigger trg_gridex_sync_portal_from_agreement;

-- PDF storage references and timestamps have no customer/signature meaning.
-- Verify byte-for-byte projections and lifecycle state, not just row counts.
set local role service_role;
do $$ declare projections_before jsonb; lifecycle_before jsonb; begin
  select jsonb_build_object(
    'profiles',(select jsonb_agg(to_jsonb(p) order by user_id) from public.customer_profiles p),
    'sites',(select jsonb_agg(to_jsonb(p) order by id) from public.customer_delivery_points p),
    'links',(select jsonb_agg(to_jsonb(p) order by id) from public.customer_contract_portal_links p)) into projections_before;
  select jsonb_agg(to_jsonb(a)-'contract_pdf_path'-'updated_at' order by id)
    into lifecycle_before from public.contract_agreements a;
  update public.contract_agreements set contract_pdf_path='archive/green-projection-proof.pdf',updated_at=clock_timestamp();
  if (select jsonb_build_object(
    'profiles',(select jsonb_agg(to_jsonb(p) order by user_id) from public.customer_profiles p),
    'sites',(select jsonb_agg(to_jsonb(p) order by id) from public.customer_delivery_points p),
    'links',(select jsonb_agg(to_jsonb(p) order by id) from public.customer_contract_portal_links p))) is distinct from projections_before then
    raise exception 'PDF-only update rewrote customer projections';
  end if;
  if (select jsonb_agg(to_jsonb(a)-'contract_pdf_path'-'updated_at' order by id) from public.contract_agreements a) is distinct from lifecycle_before then
    raise exception 'PDF-only update changed signing/activation/mail lifecycle';
  end if;
end $$;

-- Legal signing statuses require a real signature timestamp. Agreement consent
-- and BankID identification must never synthesize mailbox verification.
update public.contract_agreements set status='email_signed',email_signed_at='2026-10-02T12:30:00Z'
where id in(md5('projection-agreement-email')::uuid,md5('projection-agreement-email-verified')::uuid);
update public.contract_agreements set status='bankid_signed',bankid_completed_at='2026-10-02T13:30:00Z'
where id=md5('projection-agreement-bankid')::uuid;
update public.contract_agreements set status='activated'
where id=md5('projection-agreement-unsigned-activated')::uuid;
update public.contract_agreements set email_signed_at='2026-10-02T14:30:00Z'
where id=md5('projection-agreement-unsigned-timestamp')::uuid;
do $$ declare actor text; signed_time timestamptz; begin
  foreach actor in array array['email','email-verified','bankid'] loop
    signed_time:=case when actor='bankid' then '2026-10-02T13:30:00Z'::timestamptz else '2026-10-02T12:30:00Z'::timestamptz end;
    if (select onboarding_state from public.customer_profiles where user_id=md5('projection-'||actor)::uuid)<>'verified'
      or (select signed_at from public.customer_contract_portal_links where agreement_id=md5('projection-agreement-'||actor)::uuid) is distinct from signed_time then
      raise exception 'Actual signature did not produce correct local state/time: %',actor;
    end if;
    if actor='email-verified' then
      if (select email_verified_at from public.customer_profiles where user_id=md5('projection-'||actor)::uuid) is distinct from '2024-05-01T00:00:00Z'::timestamptz then
        raise exception 'Agreement signature changed pre-existing mailbox verification';
      end if;
    elsif (select email_verified_at from public.customer_profiles where user_id=md5('projection-'||actor)::uuid) is not null then
      raise exception 'Agreement/BankID signature falsely verified mailbox: %',actor;
    end if;
    if (select activated_at from public.customer_contract_portal_links where agreement_id=md5('projection-agreement-'||actor)::uuid) is not null
      or exists(select 1 from public.contract_agreements where id=md5('projection-agreement-'||actor)::uuid
        and (activated_at is not null or welcome_email_sent_at is not null)) then
      raise exception 'Projection trigger inferred activation/mail delivery from signature: %',actor;
    end if;
  end loop;
  foreach actor in array array['unsigned-activated','unsigned-timestamp'] loop
    if (select onboarding_state from public.customer_profiles where user_id=md5('projection-'||actor)::uuid)<>'pending_verification'
      or (select email_verified_at from public.customer_profiles where user_id=md5('projection-'||actor)::uuid) is not null then
      raise exception 'Unsigned/illegal-status agreement falsely verified customer/mailbox: %',actor;
    end if;
  end loop;
  if (select signed_at from public.customer_contract_portal_links where agreement_id=md5('projection-agreement-unsigned-activated')::uuid) is not null
    or (select activated_at from public.customer_contract_portal_links where agreement_id=md5('projection-agreement-unsigned-activated')::uuid) is not null then
    raise exception 'Activated status without signature synthesized signature/activation evidence';
  end if;
end $$;

-- Meaningful contact and signature changes invoke the trigger but cannot
-- overwrite canonical rows, API identities, provenance, revisions or versions.
update public.contract_agreements set first_name='Attempted overwrite',email='attempted-overwrite@example.test',
  address='Attempted site overwrite',contract_slug='attempted-contract-overwrite',
  status='email_signed',email_signed_at='2026-10-02T15:30:00Z'
where id in(select md5('projection-agreement-'||actor)::uuid from unnest(array[
  'source-only','canonical-id','tenant-only','portal-identity','external-id','verified-claim','onboarding-claim']) actor);
reset role;
do $$ declare before_row record; actual jsonb; begin
  for before_row in select * from gridex_test.agreement_projection_protected_before loop
    if before_row.kind='profile' then select to_jsonb(p) into strict actual from public.customer_profiles p where p.user_id=before_row.key::uuid;
    elsif before_row.kind='site' then select to_jsonb(p) into strict actual from public.customer_delivery_points p where p.user_id=before_row.key::uuid;
    else select to_jsonb(p) into strict actual from public.customer_contract_portal_links p where p.user_id=before_row.key::uuid; end if;
    if actual is distinct from before_row.row_data then
      raise exception 'Canonical projection/identity/provenance was overwritten: % %',before_row.kind,before_row.key;
    end if;
  end loop;
end $$;

set local role service_role;
-- Absent contact names provide no replacement for an existing profile name.
-- concat_ws on two NULL fields returns an empty string, so the trigger must
-- preserve the existing nonempty legacy name instead of clearing it.
update public.contract_agreements set first_name=null,last_name=null
where id=md5('projection-agreement-legacy-preserve')::uuid;
do $$ begin
  if (select full_name from public.customer_profiles where user_id=md5('projection-legacy-preserve')::uuid)
    is distinct from 'Existing legacy customer' then
    raise exception 'NULL agreement names cleared an existing legacy full_name';
  end if;
end $$;

-- Production requires a facility identifier on both agreement and site rows.
-- Rejected incomplete INSERT/UPDATE requests must not accumulate unknown sites
-- or leave customer/contact/link mutations from the agreement trigger.
do $$ declare blocked boolean; agreement_before jsonb; projections_before jsonb; begin
  select to_jsonb(a) into strict agreement_before from public.contract_agreements a
    where id=md5('projection-agreement-null-facility')::uuid;
  select jsonb_build_object(
    'profiles',(select jsonb_agg(to_jsonb(p) order by user_id) from public.customer_profiles p),
    'sites',(select jsonb_agg(to_jsonb(p) order by id) from public.customer_delivery_points p),
    'links',(select jsonb_agg(to_jsonb(p) order by id) from public.customer_contract_portal_links p)) into projections_before;
  blocked:=false;
  begin
    update public.contract_agreements set facility_id=null,phone='0701111111'
    where id=md5('projection-agreement-null-facility')::uuid;
  exception when not_null_violation then blocked:=true; end;
  if not blocked then raise exception 'NULL facility agreement UPDATE accepted'; end if;
  blocked:=false;
  begin
    insert into public.contract_agreements(id,user_id,email,first_name,facility_id,sign_method,status)
    values(md5('projection-new-null-facility')::uuid,md5('projection-null-facility')::uuid,
      'null-facility@example.test','Incomplete site',null,'email','email_sent');
  exception when not_null_violation then blocked:=true; end;
  if not blocked then raise exception 'NULL facility agreement INSERT accepted'; end if;
  if exists(select 1 from public.customer_delivery_points where user_id=md5('projection-null-facility')::uuid)
    or exists(select 1 from public.contract_agreements where id=md5('projection-new-null-facility')::uuid)
    or (select to_jsonb(a) from public.contract_agreements a where id=md5('projection-agreement-null-facility')::uuid) is distinct from agreement_before
    or (select jsonb_build_object(
    'profiles',(select jsonb_agg(to_jsonb(p) order by user_id) from public.customer_profiles p),
    'sites',(select jsonb_agg(to_jsonb(p) order by id) from public.customer_delivery_points p),
    'links',(select jsonb_agg(to_jsonb(p) order by id) from public.customer_contract_portal_links p))) is distinct from projections_before then
    raise exception 'Rejected NULL facility request left agreement or projection changes';
  end if;
end $$;

-- Local pre-existing evidence is retained while legitimate contact data updates.
update public.contract_agreements set phone='0711111111',address='Updated local address'
where id=md5('projection-agreement-legacy-preserve')::uuid;
do $$ begin
  if (select onboarding_state from public.customer_profiles where user_id=md5('projection-legacy-preserve')::uuid)<>'verified'
    or (select email_verified_at from public.customer_profiles where user_id=md5('projection-legacy-preserve')::uuid) is distinct from '2024-05-01T00:00:00Z'::timestamptz
    or (select metadata->>'keep' from public.customer_profiles where user_id=md5('projection-legacy-preserve')::uuid)<>'legacy-provenance' then
    raise exception 'Legacy projection lost existing verification/provenance';
  end if;
  if not exists(select 1 from public.customer_contract_portal_links where agreement_id=md5('projection-agreement-legacy-preserve')::uuid
    and signed_at='2025-03-01T00:00:00Z' and activated_at='2025-03-02T00:00:00Z'
    and contract_provider_key='legacy-provider' and contract_external_ref='legacy-external-ref'
    and metadata->>'keep'='legacy-provenance') then
    raise exception 'Legacy link lost previous signature/activation/provider/provenance';
  end if;
end $$;

-- Orphaned legacy agreements safely stay unlinked; no NULL identity projection
-- is attempted. INSERT and relevant UPDATE both execute the real trigger.
update public.contract_agreements set first_name='Updated unlinked legacy contact',status='email_signed',email_signed_at='2026-10-02T16:30:00Z'
where id=md5('projection-agreement-null-user')::uuid;
insert into public.contract_agreements(id,user_id,email,first_name,facility_id,sign_method,status)
values(md5('projection-new-null-user')::uuid,null,'new-unlinked@example.test','Unlinked','new-unlinked-facility','email','email_sent');
do $$ begin
  if exists(select 1 from public.customer_profiles where user_id is null)
    or exists(select 1 from public.customer_delivery_points where user_id is null)
    or exists(select 1 from public.customer_contract_portal_links where user_id is null) then
    raise exception 'Unlinked legacy agreement produced a NULL identity projection';
  end if;
end $$;

-- A second PDF-only write on an already signed agreement must not activate it
-- or mark a welcome email delivered. Verify complete agreement lifecycle fields.
do $$ declare baseline jsonb; begin
  select to_jsonb(a)-'contract_pdf_path'-'updated_at' into strict baseline from public.contract_agreements a
  where id=md5('projection-agreement-bankid')::uuid;
  update public.contract_agreements set contract_pdf_path='archive/signed-stable.pdf',updated_at=clock_timestamp()
  where id=md5('projection-agreement-bankid')::uuid;
  if (select to_jsonb(a)-'contract_pdf_path'-'updated_at' from public.contract_agreements a
    where id=md5('projection-agreement-bankid')::uuid) is distinct from baseline then
    raise exception 'Same signed status/PDF mutation changed activation/mail lifecycle';
  end if;
end $$;
reset role;

-- Failure after the first projection write must roll back both the initiating
-- agreement mutation and all local profile/site/link work in the transaction.
create function gridex_test.fail_agreement_projection_sink() returns trigger language plpgsql as $$ begin
  if new.user_id=md5('projection-sink-failure')::uuid then
    raise exception using errcode='23514',message='PROJECTION_TEST_SINK_UNAVAILABLE';
  end if;
  return new;
end $$;
create trigger projection_test_sink_failure before insert or update on public.customer_delivery_points
for each row execute function gridex_test.fail_agreement_projection_sink();
set local role service_role;
do $$ declare blocked boolean:=false; agreement_before jsonb; projections_before jsonb; begin
  select to_jsonb(a) into strict agreement_before from public.contract_agreements a where id=md5('projection-agreement-sink-failure')::uuid;
  select jsonb_build_object(
    'profiles',(select jsonb_agg(to_jsonb(p) order by user_id) from public.customer_profiles p),
    'sites',(select jsonb_agg(to_jsonb(p) order by id) from public.customer_delivery_points p),
    'links',(select jsonb_agg(to_jsonb(p) order by id) from public.customer_contract_portal_links p)) into projections_before;
  begin
    update public.contract_agreements set status='email_signed',email_signed_at='2026-10-02T17:30:00Z',first_name='Must roll back'
    where id=md5('projection-agreement-sink-failure')::uuid;
  exception when check_violation then blocked:=true; end;
  if not blocked then raise exception 'Projection sink failure did not abort agreement update'; end if;
  if (select to_jsonb(a) from public.contract_agreements a where id=md5('projection-agreement-sink-failure')::uuid) is distinct from agreement_before
    or (select jsonb_build_object(
    'profiles',(select jsonb_agg(to_jsonb(p) order by user_id) from public.customer_profiles p),
    'sites',(select jsonb_agg(to_jsonb(p) order by id) from public.customer_delivery_points p),
    'links',(select jsonb_agg(to_jsonb(p) order by id) from public.customer_contract_portal_links p))) is distinct from projections_before then
    raise exception 'Failed projection left partial agreement/profile/site/link changes';
  end if;
end $$;
reset role;
select 'Actual agreement trigger: PDF-only skip, email/BankID signatures, mailbox verification, canonical guards, lifecycle preservation, NULL user and atomic sink failure verified' as result;
rollback;
