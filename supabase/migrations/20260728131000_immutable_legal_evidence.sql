begin;

alter table if exists public.website_application_submissions
  add column if not exists legal_evidence_snapshot jsonb,
  add column if not exists legal_evidence_sha256 text;

comment on column public.website_application_submissions.legal_evidence_snapshot is
  'Immutable offer-specific legal bundle, document versions/hashes and acceptance booleans; accepted_at is stored on the same row.';

commit;
