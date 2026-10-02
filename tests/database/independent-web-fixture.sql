-- LOCAL ONLY: minimal production-shaped schema fixture, not a baseline migration.
do $$ begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema auth;
create table auth.users(id uuid primary key,email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to public;
grant execute on function auth.uid() to public;
create table public.companies(id uuid primary key,name text not null,status text not null default 'active',is_active boolean not null default true);
create table public.admin_users(user_id uuid primary key,role text,is_active boolean default true);
create table public.customer_profiles(user_id uuid primary key,customer_number text,external_customer_id text,portal_identity_id text,tenant_reference text);
create table public.customer_contract_portal_links(id uuid primary key);
create type public.gridex_ticket_priority as enum('low','normal','high','urgent');
create type public.gridex_ticket_status as enum('open','waiting_on_customer','waiting_on_internal','resolved','closed');
create type public.gridex_message_sender_type as enum('customer','agent','system','integration');
create table public.roles (
  id uuid default gen_random_uuid() not null,
  name text not null,
  description text,
  created_at timestamp with time zone default now(),
  key text,
  scope text default 'company'::text,
  is_system boolean default false not null,
  is_system_role boolean default false not null,
  is_active boolean default true not null
);
create table public.permissions (
  id uuid default gen_random_uuid() not null,
  name text not null,
  description text,
  created_at timestamp with time zone default now(),
  key text
);
create table public.role_permissions (
  role_id uuid not null,
  permission_id uuid not null,
  role_key text,
  permission_key text
);
create table public.user_roles (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  role text not null,
  is_active boolean default true,
  created_at timestamp with time zone default now(),
  role_id uuid,
  company_id uuid,
  status text default 'active'::text,
  updated_at timestamp with time zone default now(),
  disabled_at timestamp with time zone,
  disabled_by uuid,
  status_reason text
);
create table public.user_permissions (
  user_id uuid not null,
  permission_id uuid not null,
  assigned_at timestamp with time zone default now(),
  permission_key text,
  company_id uuid,
  effect text default 'allow'::text,
  status text default 'active'::text,
  is_active boolean default true
);
create table public.user_permission_overrides (
  id uuid default gen_random_uuid() not null,
  company_id uuid,
  user_id uuid not null,
  permission_key text not null,
  effect text default 'allow'::text not null,
  reason text,
  valid_from timestamp with time zone,
  valid_to timestamp with time zone,
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  created_by uuid,
  updated_by uuid
);
create table public.company_memberships (
  id uuid default gen_random_uuid() not null,
  company_id uuid not null,
  user_id uuid not null,
  role text,
  role_id uuid,
  status text default 'active'::text not null,
  is_active boolean default true not null,
  invited_email text,
  invited_by uuid,
  joined_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  created_by uuid,
  updated_by uuid,
  membership_role text default 'member'::text,
  role_key text,
  invited_at timestamp with time zone,
  accepted_at timestamp with time zone,
  disabled_at timestamp with time zone,
  disabled_by uuid,
  removed_at timestamp with time zone,
  removed_by uuid,
  status_reason text,
  metadata jsonb default '{}'::jsonb
);
create table public.user_profiles (
  id uuid not null,
  full_name text,
  personal_number text,
  phone text,
  bankid_verified boolean default false,
  created_at timestamp with time zone default now(),
  email text,
  user_id uuid,
  updated_at timestamp with time zone default now(),
  active_company_id uuid,
  user_status text default 'active'::text,
  must_change_password boolean default false not null,
  last_auth_email_action text,
  last_auth_email_action_at timestamp with time zone,
  temporary_password_set_at timestamp with time zone,
  temporary_password_expires_at timestamp with time zone,
  temporary_password_set_by uuid,
  temporary_password_company_id uuid,
  temporary_password_company_name text
);
create table public.customer_support_tickets (
  id uuid default gen_random_uuid() not null,
  user_id uuid,
  portal_contract_id uuid,
  subject text not null,
  category text default 'general'::text not null,
  priority public.gridex_ticket_priority default 'normal'::gridex_ticket_priority not null,
  status public.gridex_ticket_status default 'open'::gridex_ticket_status not null,
  description text not null,
  assigned_user_id uuid,
  provider_case_ref text,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  closed_at timestamp with time zone,
  client_request_id text
);
create table public.customer_support_messages (
  id uuid default gen_random_uuid() not null,
  ticket_id uuid not null,
  sender_user_id uuid,
  sender_type public.gridex_message_sender_type not null,
  body text not null,
  attachments jsonb default '[]'::jsonb not null,
  is_internal_note boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  client_request_id text
);
alter table public.roles add primary key(id),add unique(name);
alter table public.permissions add primary key(id),add unique(name);
alter table public.role_permissions add primary key(role_id,permission_id);
alter table public.user_permissions add primary key(user_id,permission_id);
alter table public.user_profiles add primary key(id);
alter table public.customer_support_tickets add primary key(id);
alter table public.customer_support_messages add primary key(id);
alter table public.user_permission_overrides add primary key(id),add unique(company_id,user_id,permission_key);
create unique index idx_customer_support_tickets_client_request_id_unique on public.customer_support_tickets(client_request_id) where client_request_id is not null;
create unique index idx_customer_support_messages_client_request_id_unique on public.customer_support_messages(client_request_id) where client_request_id is not null;
alter table public.customer_support_tickets enable row level security;
alter table public.customer_support_messages enable row level security;
alter table public.user_profiles enable row level security;
alter table public.customer_profiles enable row level security;
create policy customer_profiles_owner_select on public.customer_profiles for select using(auth.uid()=user_id);
create policy customer_profiles_owner_insert on public.customer_profiles for insert with check(auth.uid()=user_id);
create policy customer_profiles_owner_update on public.customer_profiles for update using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy user_profiles_owner_select on public.user_profiles for select using(auth.uid()=user_id);
create policy user_profiles_owner_insert on public.user_profiles for insert with check(auth.uid()=user_id);
create policy user_profiles_owner_update on public.user_profiles for update using(auth.uid()=user_id) with check(auth.uid()=user_id);
grant all on all tables in schema public to authenticated,anon,service_role;
insert into public.roles(name,key) values('super_admin','super_admin'),('admin','admin'),('customer_service_agent','customer_service_agent'),('customer_service_manager','customer_service_manager'),('pricing_manager','pricing_manager'),('pricing_approver','pricing_approver'),('compliance_manager','compliance_manager');
insert into public.permissions(name,key) values('admin.access','admin.access'),('pricing.publish_prod','pricing.publish_prod');
insert into public.role_permissions(role_id,permission_id,role_key,permission_key) select r.id,p.id,r.key,p.key from public.roles r cross join public.permissions p where r.key='super_admin' or(r.key='customer_service_agent' and p.key='admin.access');
