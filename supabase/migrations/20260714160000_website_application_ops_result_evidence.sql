begin;

alter table public.website_application_submissions
  add column if not exists ops_result_snapshot jsonb,
  add column if not exists contract_status text,
  add column if not exists signed_at timestamptz,
  add column if not exists withdrawal_deadline_at timestamptz,
  add column if not exists signature_snapshot_sha256 text,
  add column if not exists can_send_agreement_confirmation boolean,
  add column if not exists can_start_switch boolean,
  add column if not exists communication_snapshot jsonb;

create index if not exists idx_website_application_submissions_contract_status
  on public.website_application_submissions(contract_status, created_at desc);

create index if not exists idx_website_application_submissions_signed_at
  on public.website_application_submissions(signed_at desc)
  where signed_at is not null;

commit;
