begin;

alter table public.website_application_submissions
  add column if not exists ops_customer_number text,
  add column if not exists ops_site_id text,
  add column if not exists ops_metering_point_id text,
  add column if not exists ops_workflow_id text,
  add column if not exists ops_continuation_job_id text,
  add column if not exists ops_workflow_state text,
  add column if not exists ops_status text,
  add column if not exists ops_supplier_switch_status text,
  add column if not exists ops_correlation_id text,
  add column if not exists last_status_synced_at timestamptz,
  add column if not exists submission_idempotency_key text,
  add column if not exists submission_payload_hash text;

update public.website_application_submissions
set submission_idempotency_key = idempotency_key,
    submission_payload_hash = coalesce(normalized_ops_payload_sha256, ops_payload_hash, payload_hash)
where submission_idempotency_key is null
   or submission_payload_hash is null;

create unique index if not exists website_application_submissions_ops_application_uidx
  on public.website_application_submissions(ops_application_id)
  where ops_application_id is not null;
create index if not exists website_application_submissions_workflow_idx
  on public.website_application_submissions(ops_workflow_id, updated_at desc)
  where ops_workflow_id is not null;
create index if not exists website_application_submissions_status_sync_idx
  on public.website_application_submissions(ops_status, last_status_synced_at)
  where ops_application_id is not null;
create unique index if not exists website_application_submissions_idempotency_payload_uidx
  on public.website_application_submissions(submission_idempotency_key, submission_payload_hash)
  where submission_idempotency_key is not null and submission_payload_hash is not null;

comment on column public.website_application_submissions.ops_status is
  'Last mirrored OPS application status for audit/display only. OPS remains canonical.';
comment on column public.website_application_submissions.last_status_synced_at is
  'Timestamp of the latest status read from OPS; not a local workflow clock.';

commit;
