# Rate limit review

## Architecture
`lib/security/rateLimit.ts` uses a distributed Supabase RPC (`consume_distributed_rate_limit`) in deployed environments and only permits local in-memory fallback for development/test behavior. Production behavior is designed to fail closed rather than silently downgrade to a per-instance serverless limiter.

Migration `20260710090000_customer_portal_api_hardening.sql` provides the backing bucket/RPC security model and cleanup/index path.

## Route evidence
- Checkout quote route applies per-client/IP limiting and returns HTTP 429 with `Retry-After`.
- Energy-area resolve route applies a bounded request limit and 429 handling.
- OPS transport propagates retry semantics for retryable GET/HEAD upstream calls without replaying POSTs.

## Decision
No second global limiter was added. Duplicating rate limits at transport level would risk tenant interference and double-throttling. Rate limiting belongs at exposed route/business boundaries with distributed storage.

Exhaustive deployed-route abuse testing and production threshold tuning are `UNVERIFIED` without traffic telemetry.
