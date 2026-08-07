# Database schema review

Repository migrations were treated as the expected schema source of truth. The audited tree contains the customer portal, checkout quote sessions, tenant-domain checkout, security hardening, public-contract, and API-hardening migration series through `20260710090000_customer_portal_api_hardening.sql`.

## Confirmed consistency check
`lib/security/rateLimit.ts` calls `consume_distributed_rate_limit`. Migration `20260710090000_customer_portal_api_hardening.sql` defines the backing rate-limit bucket state/RPC, enables RLS, revokes anon/auth access, grants execution to service role, and includes a reset-time index/cleanup path. Therefore no remediation migration was justified for this finding.

## Index policy
No index was added without a demonstrated query pattern. The rate-limit cleanup/query path already has the relevant reset-time index. Blind indexes on tenant/status/date columns were intentionally avoided without query evidence or `EXPLAIN` from production-like data.

## Migrations
New migrations in this remediation: **0**.

Production database state, actual table cardinalities, `EXPLAIN ANALYZE`, advisor output and deployed migration parity are `UNVERIFIED` because this GitHub-only run has no authenticated production database session.
