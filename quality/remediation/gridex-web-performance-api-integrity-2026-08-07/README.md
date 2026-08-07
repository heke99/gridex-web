# Gridex Web remediation — 2026-08-07

Branch: `remediation/gridex-web-performance-integrity-api-2026-08-07`
Baseline: `04058b7a22daeb6f43fa598869faf46eed868c7c`
Draft PR: #3

## Scope
Evidence-based remediation of OPS contract integrity, runtime contract observation, CI quality gates, database/migration consistency, cache/rate-limit architecture and production file-size governance.

## Confirmed remediation
1. **P0 OPS contract drift fixed.** Baseline had local/generated `2026-08-05.2` artifacts while the current public OPS website OpenAPI and developer documentation publish `2026-08-05.1`. The branch is realigned to the public canonical release, including generated types and contract fixtures.
2. **Runtime drift visibility widened.** Contract-version response headers are now observed for all `/api/v1/website/*`, `/api/v1/customer/*` and `/api/v1/openapi/*` surfaces instead of only three exact paths.
3. **Regression coverage added** for the version-observation boundary.
4. **Production file-size CI guard added** for TS/TSX/JS/JSX/SQL, with only deterministic generated OpenAPI types explicitly exempted.
5. **Full PR quality gate added**: install, OpenAPI local drift, migration manifest, API compatibility, file-size, regression, lint, typecheck, full tests and build.

## Important verified existing controls
- OPS transport has bounded timeout and GET/HEAD-only retry with retryable status filtering/backoff.
- POST operations are not automatically retried.
- OPS transport defaults to `no-store`.
- Distributed rate limiting uses a Supabase RPC with a corresponding migration, RLS and service-role-only execution.
- Swedish energy-area resolution is local/reference logic rather than an external request per lookup.

## Unverified boundaries
Authenticated live tenant operations, production Supabase state, Vercel runtime configuration and local working-tree state are `UNVERIFIED` from the GitHub-only execution environment. They are not reported as PASS.
