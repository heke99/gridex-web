# API_CONTRACT_MATRIX

Verifierad kontraktsrelease: `2026-08-05.2`

| Surface | Kontraktskälla | Runtime-skydd | Status |
|---|---|---|---|
| Website public contracts | live website-integration OpenAPI | operation/schema validation, ETag/snapshot, tenant binding | PASS |
| Website energy-area resolve | website-integration OpenAPI | request/response validation + capabilities/blockers | PASS |
| Website quote create | website-integration OpenAPI | request/response validation + canonical selection | PASS |
| Website quote validate | website-integration OpenAPI | immutable canonical quote tuple + mismatch guards | PASS |
| Website customer application | website-integration OpenAPI | identity + idempotency + accepted invariants | PASS |
| Website application/switch status | website-integration OpenAPI | schema-bound mapping | PASS |
| Website market/portfolio pricing | website-integration OpenAPI | schema validation + freshness/settlement rules | PASS |
| Customer portal reads/writes | customer-portal OpenAPI | operation validation + scopes/idempotency | PASS |
| OpenAPI release surfaces | release manifest + snapshots + SHA-256 | local + live drift gates | PASS |

## Aktuella hashes

- Website: `e8ddc6b8a35d14f561caf4e3ef13917affb1b1af58ae759cb1a8a0332f59a701`
- Customer portal: `2a998b7b8be3780fc9793ab1de742912915a9d4925bfb3246d84b2f1c3d9f65e`

## Same-version drift

Under remediationen ändrades live website-specen inom samma `2026-08-05.2` från hash `d0bdc356…` till `e8ddc6b8…`, med semantic diff i `/api/v1/website/public-contracts`. `main` är nu synkad mot den senare live-hashen och live-gaten blockerar både versions- och hashdrift.

## Canonical quote-regel

En redan skapad canonical quote återvalideras med sin immutabla tuple. Optional `price_area`, `grid_area_code` och `postal_code` återintroduceras inte som konkurrerande source of truth vid revalidation.

## Evidens

- Live `api:preflight`: run `31190726958` PASS.
- Full quality gate: run `31190727274` PASS.
- 33 migrations: PASS.
- `upstream_contract_gaps`: inga verifierade lokala kontraktsgap efter live-sync.

Authenticated tenant-E2E är fortsatt en separat miljöverifiering och markeras inte PASS från statisk CI.
