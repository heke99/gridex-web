begin;

-- Commercial quote validity is verified canonically by OPS. The timestamp is
-- retained only as deprecated legacy metadata for old rows and old responses.
alter table if exists public.website_pricing_snapshots
  alter column valid_until drop not null;

comment on column public.website_pricing_snapshots.valid_until is
  'Deprecated legacy metadata. Never use as a commercial quote-validity rule.';
comment on column public.website_pricing_snapshots.ops_quote_valid_until is
  'Deprecated OPS compatibility metadata. Canonical OPS verification determines validity.';
comment on column public.website_pricing_snapshots.status is
  'issued, used and revoked are active states. expired is retained only for historical backfill/audit compatibility.';

create table if not exists public.website_quote_backfill_runs (
  run_id uuid primary key,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  rows_scanned bigint not null default 0,
  rows_eligible bigint not null default 0,
  rows_changed bigint not null default 0,
  rows_skipped bigint not null default 0,
  errors jsonb not null default '[]'::jsonb,
  dry_run boolean not null,
  created_at timestamptz not null default now()
);

alter table public.website_quote_backfill_runs enable row level security;
revoke all on public.website_quote_backfill_runs from public, anon, authenticated;

create or replace function public.run_non_expiring_quote_backfill(
  p_dry_run boolean default true,
  p_run_id uuid default gen_random_uuid()
)
returns table (
  run_id uuid,
  started_at timestamptz,
  completed_at timestamptz,
  rows_scanned bigint,
  rows_eligible bigint,
  rows_changed bigint,
  rows_skipped bigint,
  errors jsonb,
  dry_run boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_started_at timestamptz := clock_timestamp();
  v_completed_at timestamptz;
  v_rows_scanned bigint := 0;
  v_rows_eligible bigint := 0;
  v_rows_changed bigint := 0;
  v_rows_skipped bigint := 0;
  v_errors jsonb := '[]'::jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('website_quote_non_expiring_backfill', 0));

  insert into public.website_quote_backfill_runs (run_id, started_at, dry_run)
  values (p_run_id, v_started_at, p_dry_run)
  on conflict (run_id) do nothing;

  if not found then
    return query
    select r.run_id, r.started_at, r.completed_at, r.rows_scanned,
           r.rows_eligible, r.rows_changed, r.rows_skipped, r.errors, r.dry_run
      from public.website_quote_backfill_runs r
     where r.run_id = p_run_id;
    return;
  end if;

  select count(*)
    into v_rows_scanned
    from public.website_pricing_snapshots
   where status = 'expired';

  select count(*)
    into v_rows_eligible
    from public.website_pricing_snapshots
   where status = 'expired'
     and ops_application_id is null
     and ops_contract_id is null
     and coalesce(lower(ops_quote_validation_status), 'issued') not in (
       'revoked',
       'invalid',
       'consumed',
       'used',
       'quote_revoked',
       'quote_already_consumed'
     );

  v_rows_skipped := v_rows_scanned - v_rows_eligible;

  if not p_dry_run then
    update public.website_pricing_snapshots
       set status = 'issued'
     where status = 'expired'
       and ops_application_id is null
       and ops_contract_id is null
       and coalesce(lower(ops_quote_validation_status), 'issued') not in (
         'revoked',
         'invalid',
         'consumed',
         'used',
         'quote_revoked',
         'quote_already_consumed'
       );
    get diagnostics v_rows_changed = row_count;
  end if;

  v_completed_at := clock_timestamp();
  update public.website_quote_backfill_runs
     set completed_at = v_completed_at,
         rows_scanned = v_rows_scanned,
         rows_eligible = v_rows_eligible,
         rows_changed = v_rows_changed,
         rows_skipped = v_rows_skipped,
         errors = v_errors
   where website_quote_backfill_runs.run_id = p_run_id;

  return query
  select p_run_id, v_started_at, v_completed_at, v_rows_scanned,
         v_rows_eligible, v_rows_changed, v_rows_skipped, v_errors, p_dry_run;
exception
  when others then
    v_completed_at := clock_timestamp();
    v_errors := jsonb_build_array(jsonb_build_object(
      'sqlstate', sqlstate,
      'message', sqlerrm,
      'occurred_at', v_completed_at
    ));
    insert into public.website_quote_backfill_runs (
      run_id, started_at, completed_at, rows_scanned, rows_eligible,
      rows_changed, rows_skipped, errors, dry_run
    ) values (
      p_run_id, v_started_at, v_completed_at, v_rows_scanned, v_rows_eligible,
      v_rows_changed, v_rows_skipped, v_errors, p_dry_run
    )
    on conflict (run_id) do update
      set completed_at = excluded.completed_at,
          rows_scanned = excluded.rows_scanned,
          rows_eligible = excluded.rows_eligible,
          rows_changed = excluded.rows_changed,
          rows_skipped = excluded.rows_skipped,
          errors = excluded.errors;

    return query
    select p_run_id, v_started_at, v_completed_at, v_rows_scanned,
           v_rows_eligible, v_rows_changed, v_rows_skipped, v_errors, p_dry_run;
end;
$$;

revoke all on function public.run_non_expiring_quote_backfill(boolean, uuid)
  from public, anon, authenticated;
grant execute on function public.run_non_expiring_quote_backfill(boolean, uuid)
  to service_role;

commit;
