# System architecture

Critical data path: browser → Next.js App Router route/server layer → `lib/ops` transport/client → Gridex OPS API. Supabase is used for local persistence/security primitives including distributed rate-limit state and customer-portal data.

Trust boundaries:
- browser input is untrusted;
- tenant/API credentials remain server-side;
- OPS responses are external contract data and must be validated/observed;
- shared caches must never key only on user-controlled tenant identity.

Existing architecture already centralizes OPS base URL, auth, timeout/retry, error shaping and cache defaults in `lib/ops/transport.ts`. Remediation preserves that single transport boundary rather than adding a second HTTP layer.

Public-contract reads have conditional ETag/304 support; transactional quote/application paths remain uncached and non-retried unless idempotency is explicitly guaranteed.
