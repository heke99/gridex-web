-- LOCAL ONLY. Load exact independent-Web base/functions/migration and
-- agreement-pdf-fixture.sql first. This expands only relevant projection fields
-- from the inspected production schema. The two PDF agreement fixtures were inserted before
-- loading agreement-projection-trigger-existing.sql, which captures the real
-- broken function + trigger. Never apply this fixture to production.
alter table public.contract_agreements
  add column if not exists email text,add column if not exists first_name text,
  add column if not exists last_name text,add column if not exists phone text,
  add column if not exists facility_id text,add column if not exists address text,
  add column if not exists postal_code text,add column if not exists city text,
  add column if not exists apartment text,add column if not exists move_in_date date,
  add column if not exists contract_slug text,add column if not exists user_id uuid,
  add column if not exists email_signed_at timestamptz,add column if not exists bankid_completed_at timestamptz;
-- The production agreement and delivery-point facility identifiers are NOT NULL.
alter table public.contract_agreements alter column facility_id set not null;
alter table public.customer_profiles
  add column if not exists email text,add column if not exists first_name text,
  add column if not exists last_name text,add column if not exists full_name text,
  add column if not exists phone text,add column if not exists onboarding_state text not null default 'pending_verification',
  add column if not exists email_verified_at timestamptz,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists canonical_ops_id text,
  add column if not exists source text not null default 'legacy',
  add column if not exists upstream_revision bigint,
  add column if not exists upstream_version text,
  add column if not exists synced_at timestamptz,
  add column if not exists last_event_id text,
  add column if not exists projection_status text not null default 'legacy_unverified';
create table public.customer_delivery_points(
  id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),
  facility_id text not null,address text,postal_code text,city text,apartment text,
  move_in_date date,is_primary boolean not null default false,metadata jsonb not null default '{}'::jsonb,
  canonical_ops_id text,source text not null default 'legacy',tenant_reference text,
  upstream_revision bigint,upstream_version text,synced_at timestamptz,last_event_id text,
  projection_status text not null default 'legacy_unverified',unique(user_id,facility_id)
);
alter table public.customer_contract_portal_links
  alter column id set default gen_random_uuid(),
  add column if not exists user_id uuid not null references auth.users(id),
  add column if not exists agreement_id uuid unique,
  add column if not exists contract_slug text,
  add column if not exists status text not null default 'pending_signature',
  add column if not exists signed_at timestamptz,
  add column if not exists activated_at timestamptz,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists contract_provider_key text,
  add column if not exists contract_external_ref text,
  add column if not exists canonical_ops_id text,
  add column if not exists source text not null default 'legacy',
  add column if not exists tenant_reference text,
  add column if not exists upstream_revision bigint,
  add column if not exists upstream_version text,
  add column if not exists synced_at timestamptz,
  add column if not exists last_event_id text,
  add column if not exists projection_status text not null default 'legacy_unverified';
alter table public.customer_delivery_points enable row level security;
alter table public.customer_contract_portal_links enable row level security;
grant all on public.customer_delivery_points,public.customer_contract_portal_links to service_role;
create policy customer_delivery_points_owner_all on public.customer_delivery_points for all
using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy customer_contract_links_owner_select on public.customer_contract_portal_links for select using(auth.uid()=user_id);

-- GREEN regression seeds additional synthetic rows inside its own rollback
-- transaction, so agreement-pdf.sql retains its exact two-row baseline.
create table gridex_test.agreement_projection_catalog_before as
select c.relname,c.relacl,c.relrowsecurity,c.relforcerowsecurity,
  (select jsonb_agg(to_jsonb(p) order by p.polname) from pg_policy p where p.polrelid=c.oid) as policies
from pg_class c where c.oid in('public.customer_profiles'::regclass,'public.customer_delivery_points'::regclass,
  'public.customer_contract_portal_links'::regclass);
