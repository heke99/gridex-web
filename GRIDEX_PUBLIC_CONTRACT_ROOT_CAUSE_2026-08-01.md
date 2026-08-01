# Gridex Web – public contracts root-cause correction

Date: 2026-08-01

## Confirmed findings

### 1. The previous website patch contained a real fail-open bug

When OPS returned rows but every row was rejected by canonical parsing, and no earlier durable snapshot existed, `fetchOpsPublicContractsSnapshot()` logged the condition but still returned an empty snapshot. The customer-facing page could therefore present an upstream contract failure as “no agreements”.

The corrected implementation now:

- never returns an all-blocked response as a valid empty feed;
- restores the latest durable snapshot when available;
- throws a structured `OpsError` when no safe fallback exists;
- rejects an unverified empty feed when the durable publication guard is unavailable;
- rejects a feed where OPS rows exist but every row fails website rendering readiness.

### 2. The home page hid integration failures

The home page converted every OPS exception into `contracts = []`, and the calculator then displayed the same text used for a legitimate empty publication. The corrected home page passes a distinct loading error to the calculator.

### 3. The checked-in OpenAPI artifacts are not the current live artifacts

The uploaded project contains release version `2026-08-01.1`, but the local SHA-256 values are:

- website: `e15a170a38b0cecadb2b815c1387c2336f02da7a69c96af418acca3999952f5f`
- customer portal: `72fe14799c971f34e172782972ae510c9817cc6e4b981fb5ec8a71326f49e628`

The live release manifest on 2026-08-01 reports the same release version but different SHA-256 values:

- website: `3a6227270d3b2cca77791334c7f29103afa75dbc9952c8c5dcf8fa75894a0821`
- customer portal: `ae6ef4b09137cd2cc8f22b21aed4a1b7730b45f12007e8516ab0a9ec1bebb2a3`

The uploaded local OpenAPI files are also internally inconsistent: `info.version` is `2026-08-01.1`, while `IntegrationContext.contract_version.const` is still `2026-07-30.3`. The current live OpenAPI advertises `2026-08-01.1` for that field.

This means the OpenAPI files and generated types must be synchronized before build/deployment. Do not manually replace only the hash or one generated type; run the canonical sync command so both specifications, generated types, manifest, diff and verification status are updated together.

## What remains environment/API-specific

The current public `/elavtal` page displays a load failure, which means the server call is throwing rather than merely returning zero renderable agreements. The exact production cause cannot be determined from source code without the production API key and response request ID.

Run the included diagnostic script with Vercel Production variables. It checks:

1. `GET /integration/context`
2. tenant operational state and capabilities
3. presence of `website_contracts.read`
4. `GET /website/public-contracts?customer_type=private`
5. HTTP status, API error code, request ID, trace ID and version headers
6. publication diagnostics
7. local-versus-live OpenAPI SHA-256 drift
8. whether the durable Supabase snapshot table exists and is readable

## Required local sequence

```bash
cd "/Users/hekmath/Desktop/Projects/gridex-web"

npm ci
npm run api:sync
npm run db:migrations:check
supabase migration list --linked
supabase db push

vercel env pull .env.production.local --environment=production
node --env-file=.env.production.local scripts/diagnose-public-contracts.mjs

npm run typecheck
npm run lint
npm run test:launch
npm run build
```

Only deploy after the diagnostic shows at least one private contract and all build checks are green.

## Interpreting the diagnostic

- `401`: wrong, revoked or malformed `GRIDEX_API_KEY`.
- `403` or missing `website_contracts.read`: API client provisioning/scope error in OPS.
- `410`: tenant closed.
- `423`: tenant paused.
- `409` with publication blocker: OPS publication graph, price option or legal snapshot is invalid.
- `503` version/checksum/schema code: OPS runtime/OpenAPI/database release is not coherent.
- `200` and `actual_count: 0`: OPS has no website-published private agreement that passes publication, validity, price-version and legal requirements.
- `200` and `actual_count > 0`, but website endpoint fails: inspect the website parser blockers and the durable snapshot migration.
- Supabase snapshot query `404`, `PGRST` relation error or RPC error: migration `20260801133000_public_contract_last_known_good.sql` has not been applied to the production web database.

## Public smoke check

After deployment:

```bash
curl -sS -i "https://gridex.se/api/web/contracts?customer_type=private"
```

A healthy response is HTTP 200 with a non-zero visible count. A failure response contains a safe error code and a support reference that can be matched to Vercel/OPS logs.
