# API contract matrix

Canonical public contract reviewed against current OPS website OpenAPI/developer docs: `2026-08-05.1`.

| Surface | Method | Caller | Auth | Cache/retry | Status |
|---|---|---|---|---|---|
| `/api/v1/website/public-contracts` | GET | public-contract feed | Bearer API key, tenant-scoped upstream | ETag/304; GET retry allowed | PASS (repo/public contract) |
| `/api/v1/website/energy-area/resolve` | POST | checkout energy-area route | Bearer API key upstream where used | transactional/no-store; no POST auto-retry | PASS (transport policy) |
| `/api/v1/website/quote` | POST | checkout quote | Bearer API key | no-store; no POST auto-retry; runtime version observed | PASS (repo/public contract) |
| website customer application surface | POST | checkout/application layer | Bearer API key | no-store; idempotency expected by existing flow; no POST auto-retry | PASS for local contract alignment; authenticated live execution UNVERIFIED |
| `/api/v1/customer/*` | mixed | customer portal | server-side auth boundary | dynamic/sensitive; runtime version observed | schema alignment PASS; live tenant execution UNVERIFIED |
| `/api/v1/openapi/*` | GET | drift tooling | public | immutable/current spec checks | PASS after `.1` realignment |

## Confirmed defect remediated
Baseline commit lineage had synced local snapshots/generated types/runtime constant to `2026-08-05.2`, while current authoritative public OPS sources advertise `2026-08-05.1`. All `.2` sync artifacts were surgically returned to `.1` while preserving the later independent skill-install commit.

## Runtime version observation
Previously limited to three exact paths. Now all website, customer and OpenAPI path families are included, with regression coverage.
