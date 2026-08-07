# API_CONTRACT_MATRIX

Verifierad kontraktsrelease: `2026-08-05.1`

| Surface | Kontraktskälla | Runtime-skydd | Status |
|---|---|---|---|
| Website public contracts | website-integration OpenAPI | operation/schema validation, ETag/snapshot, tenant binding | PASS |
| Website energy-area resolve | website-integration OpenAPI | request/response validation + capability/blocker checks | PASS |
| Website quote create | website-integration OpenAPI | request/response validation + canonical selection | PASS |
| Website quote validate | website-integration OpenAPI | immutable canonical quote tuple + selection mismatch guards | PASS |
| Website customer application | website-integration OpenAPI | required portal/auth identity + idempotency + accepted invariants | PASS |
| Website application status | website-integration OpenAPI | schema validation/status normalization | PASS |
| Website switch status | website-integration OpenAPI | schema-bound endpoint mapping | PASS |
| Website market price | website-integration OpenAPI | strict request/response validation + stale fail-closed | PASS |
| Website portfolio prices | website-integration OpenAPI | locked-settlement rules + schema validation | PASS |
| Customer portal bundle | customer-portal OpenAPI | operation validation + required scopes | PASS |
| Customer portal notifications read | customer-portal OpenAPI | operation validation | PASS |
| Customer profile update | customer-portal OpenAPI | operation validation + required write scopes | PASS |
| Customer portal sync | customer-portal OpenAPI | operation validation/idempotency | PASS |
| OpenAPI endpoints | release manifest + immutable snapshots | hash/version drift checks | PASS |

## Versionhantering

`lib/ops/transport.ts` observerar kontraktsheader på `/api/v1/website/*`, `/api/v1/customer/*` och `/api/v1/openapi/*`. Saknad/avvikande header loggas som drift och defensiv parsing används enligt kompatibilitetspolicyn.

## Canonical quote-regel

En redan skapad canonical quote återvalideras med dess immutabla tuple. Optional contextfält (`price_area`, `grid_area_code`, `postal_code`) används inte som en andra source of truth vid revalidation.

## CI-evidens

- OpenAPI local drift: PASS.
- API compatibility: PASS.
- `upstream_contract_gaps`: `[]`.
- `environment_blockers`: `[]` i statisk/local compatibility-körning.
- Contract-version observation regression: PASS.
- Full contract/regression test suite: PASS.

Live autentiserad tenant-E2E är separat och markeras UNVERIFIED tills den körts med produktions-/stagingcredentials.
