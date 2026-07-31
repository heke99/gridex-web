-- 1. Run this dry-run first and save the returned run_id and counts.
select *
from public.run_non_expiring_quote_backfill(
  p_dry_run => true,
  p_run_id => gen_random_uuid()
);

-- 2. Review rows_eligible and rows_skipped. Then execute the real backfill with
--    a new run_id. Remove the leading comment marker only after review.
-- select *
-- from public.run_non_expiring_quote_backfill(
--   p_dry_run => false,
--   p_run_id => gen_random_uuid()
-- );

-- 3. Audit all runs.
select
  run_id,
  started_at,
  completed_at,
  rows_scanned,
  rows_eligible,
  rows_changed,
  rows_skipped,
  errors,
  dry_run
from public.website_quote_backfill_runs
order by started_at desc;
