begin;

alter table public.website_application_submissions
  add column if not exists ops_request_id text,
  add column if not exists ops_trace_id text,
  add column if not exists ops_contract_schema_version text,
  add column if not exists api_contract_version_used text;

comment on column public.website_application_submissions.ops_request_id is
  'Canonical request_id returned by OPS for the website customer application.';
comment on column public.website_application_submissions.ops_trace_id is
  'Optional upstream trace identifier returned by OPS.';
comment on column public.website_application_submissions.ops_contract_schema_version is
  'Contract schema version returned by OPS when the response exposes it.';
comment on column public.website_application_submissions.api_contract_version_used is
  'Website API contract version used to validate and submit the request.';

create index if not exists website_application_submissions_ops_request_idx
  on public.website_application_submissions(ops_request_id)
  where ops_request_id is not null;

commit;
