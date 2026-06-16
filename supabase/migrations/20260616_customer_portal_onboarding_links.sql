-- Customer portal onboarding after OPS website applications.
-- Keeps the website Supabase user linked to the OPS customer/application/contract.

alter table if exists public.customer_profiles
  add column if not exists customer_number text,
  add column if not exists external_customer_id text,
  add column if not exists portal_identity_id text,
  add column if not exists customer_type text,
  add column if not exists company_name text;

create index if not exists idx_customer_profiles_customer_number
  on public.customer_profiles (customer_number)
  where customer_number is not null;

create index if not exists idx_customer_profiles_external_customer_id
  on public.customer_profiles (external_customer_id)
  where external_customer_id is not null;

create index if not exists idx_customer_profiles_portal_identity_id
  on public.customer_profiles (portal_identity_id)
  where portal_identity_id is not null;

create index if not exists idx_customer_profiles_email_lower
  on public.customer_profiles (lower(email))
  where email is not null;
