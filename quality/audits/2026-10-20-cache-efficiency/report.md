# Public API cache efficiency

Scope: Gridex Web public-read request efficiency and publication-cache invalidation.
Parent production commit: `b2d8c4fd043e7c819921a465f8fbbfe1391aa716`.
Exact delivered source/deployment and gate results are recorded in PR53 and
`/workspace/gridex-proof-output/cache-efficiency-20261020/checkpoint.json`.

## Findings and changes

- Reproduced 20 concurrent integration-context reads making 20 upstream calls
  on a cold process. They now share one request per API-key/base-URL identity.
  Existing 60-second expiry and explicit fresh-read bypass remain in force.
- Delayed older context results cannot overwrite a newer verification.
  Failed/invalid responses are not retained as pending or successful entries.
- Attached the existing public-contract invalidation tag to the Next data-cache
  entry. The signed webhook already invalidates that tag after durable apply.
  Cache duration, publication guards, canonical-empty proof, tenant isolation
  and checkout validation are unchanged.
- Inspected actual deployed OPS source: it already contains a database-backed
  postcode-centroid cache and a tenant-bound 15-minute website-resolution cache.
  No second postcode-to-contract authority was added to Web.

## Verification

`npm run test:ops-context-cache` measures the cold burst, expiry refresh,
API-key isolation, normalized URL identity, error/invalid-payload recovery,
forced network verification and delayed-response ordering using the real OPS
client, transport and OpenAPI validator with synthetic HTTP responses.

The before-fix failure records `20 !== 1`; the after-fix result records
`simultaneous_readers:20, upstream_requests:1`.

The full repository test suite includes this regression and the existing
public-contract durability, error handling and tenant-boundary checks. Delivery
checks, lint, TypeScript and a production build are recorded separately.
Production smoke checks use the already authorized temporary Vercel access;
application authentication and Vercel protection remain enabled.

## Limits

Pending-request sharing is per server instance, not a distributed lock. OPS
geographic-cache hit rate and monetary savings were not measured. No OPS source,
database schema, customer account, agreement, permission or signing evidence was
changed. No original signing request or email was replayed. Earlier incomplete
registration-link verification and exact OPS test-link retirement remain separate
outstanding tasks; this scoped report does not qualify the whole system.

See [cache architecture and next measurements](../../../docs/architecture/public-api-caching.md).
