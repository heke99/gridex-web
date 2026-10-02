-- LOCAL ONLY: inspected agreement enums, relevant columns, grants and policies.
-- Load independent-web-fixture.sql, existing functions and independent RBAC first.
create type public.agreement_status as enum('pending_signature','email_sent','email_signed','bankid_started','bankid_signed','activated','cancelled');
create type public.sign_method_enum as enum('email','bankid');
create table public.contract_agreements(
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  email text,first_name text,last_name text,phone text,facility_id text,
  address text,postal_code text,city text,apartment text,move_in_date date,contract_slug text,
  sign_method public.sign_method_enum not null,
  status public.agreement_status not null default 'pending_signature',
  email_sign_token text,email_signed_at timestamptz,bankid_completed_at timestamptz,
  contract_pdf_path text,welcome_email_sent_at timestamptz,activated_at timestamptz,
  idempotency_key text,created_at timestamptz default now(),updated_at timestamptz default now()
);
create unique index contract_agreements_idempotency_key_key on public.contract_agreements(idempotency_key) where idempotency_key is not null;
create table public.contract_agreement_audit(
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid references public.contract_agreements(id) on delete cascade,
  action text not null,performed_by uuid,metadata jsonb,created_at timestamptz default now()
);
create or replace function auth.role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),
    nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role');
$$;
create or replace function public.gridex_can(p_permission text) returns boolean
language sql stable security definer set search_path='' as $$
  select p_permission=any(public.gridex_get_user_permissions(auth.uid(),null::uuid));
$$;
revoke all on function public.gridex_can(text) from public,anon,authenticated;
grant execute on function public.gridex_can(text) to service_role;
alter table public.contract_agreements enable row level security;
alter table public.contract_agreement_audit enable row level security;
grant all on public.contract_agreements,public.contract_agreement_audit to anon,authenticated,service_role;
create policy admin_full_access_agreements on public.contract_agreements for all to public
using(exists(select 1 from public.user_roles where user_id=auth.uid() and role='admin'));
create policy "service role full access" on public.contract_agreements for all to public
using(auth.role()='service_role');
create policy user_can_read_own_agreements on public.contract_agreements for select to public using(auth.uid()=user_id);
create policy "users can read own agreements" on public.contract_agreements for select to public using(auth.uid()=user_id);
create policy contract_agreement_audit_admin_insert on public.contract_agreement_audit for insert to authenticated
with check(public.gridex_can('admin.access') or(auth.uid() is not null and auth.uid()=performed_by));
create policy contract_agreement_audit_admin_read on public.contract_agreement_audit for select to authenticated
using(public.gridex_can('admin.access'));
-- Explicit column writes exercise the complete grant boundary as defense in depth.
grant insert(id,user_id),update(contract_pdf_path),references(id) on public.contract_agreements to public,anon,authenticated;
grant insert(agreement_id,action),update(metadata),references(agreement_id) on public.contract_agreement_audit to public,anon,authenticated;
insert into auth.users(id,email)
select md5('pdf-'||actor)::uuid,actor||'@example.test' from unnest(array[
  'owner','outsider','writer','reader','exporter','company-admin','disabled','revoked','support'
]) actor;
insert into public.user_roles(user_id,role,role_id,is_active,status)
select md5('pdf-'||actor)::uuid,'super_admin',r.id,actor<>'revoked','active'
from public.roles r cross join unnest(array['writer','disabled','revoked']) actor where r.key='super_admin';
insert into public.user_roles(user_id,role,role_id,is_active,status)
select md5('pdf-'||actor)::uuid,'admin',r.id,false,'active'
from public.roles r cross join unnest(array['disabled','revoked']) actor where r.key='admin';
insert into public.user_profiles(id,user_id,user_status)
values(md5('pdf-disabled')::uuid,md5('pdf-disabled')::uuid,'locked');
insert into public.companies(id,name) values(md5('pdf-company')::uuid,'Synthetic PDF company');
insert into public.company_memberships(company_id,user_id,membership_role,role_key,role_id)
select md5('pdf-company')::uuid,md5('pdf-company-admin')::uuid,'admin','admin',id from public.roles where key='admin';
insert into public.user_roles(user_id,role,role_id,company_id)
select md5('pdf-company-admin')::uuid,'admin',id,md5('pdf-company')::uuid from public.roles where key='admin';
insert into public.user_permissions(user_id,permission_id,permission_key)
select md5('pdf-'||actor)::uuid,p.id,p.key from (values('reader','agreements.read'),('exporter','agreements.export'),('support','admin.access')) v(actor,permission_key)
join public.permissions p on p.key=v.permission_key;
insert into public.contract_agreements(id,user_id,email,first_name,facility_id,contract_slug,sign_method,status,email_signed_at,bankid_completed_at,welcome_email_sent_at,activated_at,contract_pdf_path)
values
  (md5('pdf-agreement')::uuid,md5('pdf-owner')::uuid,'owner@example.test','Synthetic customer','999999999999999999','synthetic-contract','email','email_sent',null,null,null,null,null),
  (md5('pdf-signed')::uuid,md5('pdf-outsider')::uuid,'outsider@example.test','Signed fixture','999999999999999998','synthetic-contract','bankid','bankid_signed',null,'2026-10-01T12:00:00Z','2026-10-01T13:00:00Z',null,'archive/historical.pdf');
insert into public.contract_agreement_audit(agreement_id,action,metadata)
values(md5('pdf-agreement')::uuid,'internal_note','{"note":"Synthetic internal metadata"}');
create schema if not exists gridex_test;
create table gridex_test.agreement_catalog_before as
select c.relname,c.relrowsecurity,c.relforcerowsecurity,
  (select jsonb_agg(to_jsonb(a) order by a.grantee,a.grantor,a.is_grantable)
    from pg_catalog.aclexplode(c.relacl) a where a.privilege_type='SELECT') as select_acl,
  (select jsonb_agg(to_jsonb(a) order by a.grantee,a.grantor,a.privilege_type,a.is_grantable)
    from pg_catalog.aclexplode(c.relacl) a where a.grantee='service_role'::regrole) as service_acl
from pg_catalog.pg_class c where c.oid in('public.contract_agreements'::regclass,'public.contract_agreement_audit'::regclass);
