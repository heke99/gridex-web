create function public.gridex_enqueue_website_reconciliation_v1(
  p_submission_attempt_id uuid,
  p_payload jsonb,
  p_reason text
) returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.website_submission_reconciliation_jobs as job (
    submission_attempt_id, status, payload, last_error, next_attempt_at, updated_at
  )
  values (p_submission_attempt_id, 'pending', p_payload, left(p_reason, 2000), now(), now())
  on conflict (submission_attempt_id) do update
  set status = 'pending',
      payload = excluded.payload,
      last_error = excluded.last_error,
      next_attempt_at = excluded.next_attempt_at,
      locked_at = null,
      updated_at = excluded.updated_at
  where job.status not in ('processing', 'completed')
    and (job.payload->>'status' is distinct from 'accepted' or excluded.payload->>'status' = 'accepted');
$$;

revoke all on function public.gridex_enqueue_website_reconciliation_v1(uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.gridex_enqueue_website_reconciliation_v1(uuid, jsonb, text) to service_role;
