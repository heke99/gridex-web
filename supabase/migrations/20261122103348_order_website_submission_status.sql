begin;

alter table public.website_application_submissions
  add column ops_status_snapshot jsonb,
  add column ops_status_source_updated_at timestamptz;

create function public.gridex_is_website_status_snapshot(snapshot jsonb, application_number text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    snapshot->>'application_number' = application_number
    and jsonb_typeof(snapshot->'stage') = 'string'
    and jsonb_typeof(snapshot->'automation') = 'object'
    and jsonb_typeof(snapshot->'missing_customer_action') = 'boolean'
    and not (snapshot ? 'grid_owner_verification_issues'),
    false
  );
$$;

revoke execute on function public.gridex_is_website_status_snapshot(jsonb, text) from public, anon, authenticated;
grant execute on function public.gridex_is_website_status_snapshot(jsonb, text) to service_role;

-- Move recognizable historical status responses. The original submission
-- response is unavailable where the legacy status update already replaced it.
update public.website_application_submissions
set ops_status_snapshot = ops_result_snapshot,
    ops_result_snapshot = null,
    ops_status_source_updated_at = case
      when ops_result_snapshot->>'status' = ops_status
        and (ops_result_snapshot->>'updated_at') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$'
        and pg_input_is_valid(ops_result_snapshot->>'updated_at', 'timestamp with time zone')
      then (ops_result_snapshot->>'updated_at')::timestamptz
    end
where public.gridex_is_website_status_snapshot(ops_result_snapshot, ops_application_number);

create function public.gridex_keep_versioned_submission_status()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  legacy_status_write boolean := false;
  legacy_source_time text;
begin
  -- During rollout, older Web instances still put status responses in the
  -- submission column. Route those responses to the new slot as well.
  if new.ops_result_snapshot is distinct from old.ops_result_snapshot
    and public.gridex_is_website_status_snapshot(new.ops_result_snapshot, new.ops_application_number)
  then
    legacy_status_write := true;
    legacy_source_time := new.ops_result_snapshot->>'updated_at';
    if legacy_source_time ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$'
      and pg_input_is_valid(legacy_source_time, 'timestamp with time zone')
    then
      new.ops_status_source_updated_at := legacy_source_time::timestamptz;
      new.ops_status_snapshot := new.ops_result_snapshot;
    else
      new.ops_status_source_updated_at := null;
    end if;
    new.ops_result_snapshot := old.ops_result_snapshot;
  end if;

  -- Initial receipt and reconciliation writes may still fill other columns.
  if (legacy_status_write and new.ops_status_source_updated_at is null)
    or (old.ops_status_source_updated_at is not null and (
      new.ops_status_source_updated_at is null or new.ops_status_source_updated_at <= old.ops_status_source_updated_at
    ))
  then
    new.ops_status_source_updated_at := old.ops_status_source_updated_at;
    new.ops_status := old.ops_status;
    new.ops_workflow_state := old.ops_workflow_state;
    new.ops_customer_number := old.ops_customer_number;
    new.contract_status := old.contract_status;
    new.ops_supplier_switch_status := old.ops_supplier_switch_status;
    new.last_status_synced_at := old.last_status_synced_at;
    new.ops_status_snapshot := old.ops_status_snapshot;
  end if;
  return new;
end;
$$;

revoke execute on function public.gridex_keep_versioned_submission_status() from public, anon, authenticated;

create trigger gridex_keep_versioned_submission_status
  before update on public.website_application_submissions
  for each row execute function public.gridex_keep_versioned_submission_status();

create function public.gridex_sync_website_submission_status(
  p_application_number text,
  p_source_updated_at timestamptz,
  p_status text,
  p_workflow_state text,
  p_customer_number text,
  p_contract_status text,
  p_switch_status text,
  p_snapshot jsonb
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_source_updated_at is null or not isfinite(p_source_updated_at) then
    raise exception 'Finite OPS source timestamp required' using errcode = '22023';
  end if;

  update public.website_application_submissions as submission
  set ops_status = p_status,
      ops_workflow_state = coalesce(p_workflow_state, p_status),
      ops_customer_number = coalesce(p_customer_number, submission.ops_customer_number),
      contract_status = coalesce(p_contract_status, submission.contract_status),
      ops_supplier_switch_status = coalesce(p_switch_status, submission.ops_supplier_switch_status),
      ops_status_source_updated_at = p_source_updated_at,
      last_status_synced_at = statement_timestamp(),
      ops_status_snapshot = p_snapshot,
      updated_at = statement_timestamp()
  where submission.submission_attempt_id = (
    select candidate.submission_attempt_id
    from public.website_application_submissions as candidate
    where candidate.ops_application_number = p_application_number
  )
  and (submission.ops_status_source_updated_at is null or submission.ops_status_source_updated_at < p_source_updated_at);

  if found then
    return true;
  end if;
  if not exists (
    select from public.website_application_submissions where ops_application_number = p_application_number
  ) then
    raise exception 'Website application submission not found' using errcode = 'P0002';
  end if;
  return false;
end;
$$;

revoke execute on function public.gridex_sync_website_submission_status(text, timestamptz, text, text, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.gridex_sync_website_submission_status(text, timestamptz, text, text, text, text, text, jsonb)
  to service_role;

commit;
