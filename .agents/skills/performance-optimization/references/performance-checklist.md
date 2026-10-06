# Gridex performance measurements

This reference completes the upstream skill's missing checklist. Read it with
the Supabase and Vercel React skills; retain their correctness and security rules.

## Establish comparable evidence

- Use Node 22 and `npm run build` followed by `npm start`. Development compilation
  is not a production performance measurement.
- Finish the baseline run before rebuilding. Restart the server after each build.
- Run `npm run perf:web` against the same paths, viewport and observation window.
  Set `GRIDEX_PERF_OUTPUT` to save JSON. The default is three fresh browser contexts
  per path, a 1365×900 viewport and three seconds after DOMContentLoaded.
- The probe performs GET/HEAD only, blocks third-party requests, stores paths
  without query strings and never submits a form or accepts advertising cookies.
- Compare request counts and decoded bytes as well as timings. Decoded JavaScript
  bytes measure parsing cost; they are not compressed network transfer bytes.
- Record baseline SHA, integration availability, cold/warm cache, sample count,
  medians and spread. Failed/unconfigured feed timings are not live checkout SLAs.
- LCP and CLS here are synthetic observations. INP and production p75 Core Web
  Vitals require real interaction/field data and cannot be inferred from this probe.

## React / Next.js

- Inspect prefetches before adding lazy loading. Large menus should not render
  authenticated or OPS-backed pages merely because links enter the viewport.
- Keep Next's Link navigation and cache invalidation; use the project's IntentLink
  in menus. Test idle, hover, keyboard focus, changed href and actual navigation.
- Use request-scoped React.cache for authenticated server reads. Never put users,
  sessions, permissions or customer profiles into module maps or shared TTL caches.
- Start independent operations together. Reuse an already verified identity instead
  of reading the same profile separately for each resource.
- Bound lists and upstream concurrency. Preserve optional support failure isolation.
- Check bundles before/after, stale responses, form usability and API contract tests.

## Supabase / Postgres

- Use the intended project: gridex web / gridex-prod (`ayiuxjlfazkjmmtlvhsl`).
- Collect `pg_stat_statements` calls/mean/max/total, stats reset time, table size,
  dead tuples, index usage, connections, locks and advisors. Do not reset live stats.
- Export aggregates/normalized query identifiers, not customer rows, cookies or SQL
  containing personal values. Historical means are not current p95/p99.
- Use read-only bounded EXPLAIN ANALYZE for SELECT. Never EXPLAIN ANALYZE a live
  write. A sequential scan over five rows is not evidence of a missing index.
- Check query filters/order and leading index columns; inspect RLS execution with
  representative roles and scale locally before proposing another index.
- Advisor warnings require triage: unused indexes may protect constraints or rare
  operations. Never drop them solely because idx_scan=0.
- Existing audited duplicate-index and duplicate-policy migrations are pending
  production activation. Do not create duplicate fixes or replay historical schemas.
- Prefer fewer round trips and fewer unchanged writes. Preserve claim tokens,
  compare-and-swap identity checks, atomicity and idempotency under contention.
- Treat index/policy changes as part of a tested, coordinated release. Set lock and
  statement timeouts; retain constraint indexes and use RESTRICT, never CASCADE.

## Delivery

- Keep an attempt ledger including rejected ideas and reasons.
- Run relevant runtime/browser regressions, lint, typecheck and production build.
- Record separately: implemented code, merge state, unapplied SQL, deployment state
  and field verification. A local speedup does not prove production is faster.
