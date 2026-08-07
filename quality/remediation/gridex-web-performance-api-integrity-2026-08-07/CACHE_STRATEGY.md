# Cache strategy

| Data class | Strategy | Rationale |
|---|---|---|
| Public contract feed | Conditional ETag/304 and verified snapshot reuse | Upstream explicitly supports conditional reads; avoids full refetch while preserving publication semantics |
| OpenAPI artifacts | Immutable/local snapshot + drift verification | Contract tooling needs deterministic artifacts |
| Quote/pricing transactions | `no-store` by default | Avoid stale business-critical price/quote state |
| Customer applications / writes | no shared response cache | Transactional/sensitive |
| Customer portal personal data | private/dynamic | Must not cross users/tenants |
| Postal code → energy area reference | local deterministic reference logic | Avoid repeated external lookup |

## Tenant isolation
No new cross-tenant cache was introduced. OPS API key/tenant scoping remains server-side and dynamic/sensitive payloads remain outside shared public caching.

## Invalidation
The existing public-contract conditional path is preferable to arbitrary short TTLs because publication changes produce new upstream entity state/ETag. Contract artifacts are refreshed by explicit OpenAPI sync/drift workflow.

Production CDN/Vercel cache behavior is `UNVERIFIED` without deployed response-header telemetry.
