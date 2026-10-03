# Public contract release compatibility hotfix — 2026-10-03

## Trigger and resulting behavior

Production main `9ae37362d05e4338701f1571df3b7b5f3762329a` pins OPS release
`2026-08-22.2`; current OPS serves immutable release `2026-10-02.4`.
The production-readiness audit observed anonymous `/api/web/contracts`
returning HTTP 502 with `canonical_response_schema_invalid` and `feed_failed`.

A frozen synthetic `.4` integration-context response reproduces the failure
against the original production schema: AJV rejects
`/data/contract_version`, expecting `2026-08-22.2`. This happens on the real
public-feed producer before offer parsing. The original validation error is
not classified as compatible additive drift because it refers to the nested
context contract version. Integration-context parsing and public-feed parsing
also require an exact match to the pinned contract version.

This hotfix replaces the complete website and customer-portal OpenAPI snapshots,
release/verification manifests, generated types and runtime constants with the
immutable `.4` artifacts already committed in
`be6e645481c33888bff97af509548af28d69008c`. No schemas are relaxed or manually
patched. The regression exercises the real `fetchOpsPublicContractsSnapshot`
producer, confirms a live display-ready offer, and preserves rejection of
cross-organization data, mixed header/payload releases and invalid commercial
types. Existing tests now accept a published minimum tenant integration floor
that is older than a compatible release (`.3` floor for `.4`).

## Frozen source and live verification

- Website schema SHA-256:
  `10fb2f3051f112990fe4ef63ffa18b24ee5d9b5203b1f4429a2a3d88675c43be`.
- Customer-portal schema SHA-256:
  `442ee521e2286a3364de082cce50b68be3085db7855caf151a8999005b790503`.
- `npm run api:check:live`: both immutable schemas match live `.4`; no drift.
- Baseline RED: the added `.4` runtime regression exits 1 on original main
  snapshots/constants with `canonical_response_schema_invalid` at
  `/data/contract_version`.
- Hotfix GREEN: the same regression completes with one accepted display-ready
  offer and zero blocked offers.

## Completed local validation

- `npm run test:launch`: all 40 test entrypoints pass, including public feed,
  checkout, quote integrity, schema compatibility, portal and new `.4` regression.
- `npm run typecheck`: pass.
- `npm run lint`: zero errors; two pre-existing unused-parameter warnings in
  `lib/website/pricingQuote.ts` (`now`, `options`).
- `npm run build`: optimized production build passes.
- `npm run verify:delivery`: local snapshots/types, existing 38-migration
  integrity, compatibility and API hardening checks pass.
- `npm run api:check:live`: no live website or customer-portal schema drift.

## Deployment boundary

There are no application, SQL/RPC, database, authentication or environment
changes. No dependencies are upgraded. The existing public-feed parser,
verified organization binding, persisted snapshot safeguards and fail-closed
checks remain in force. The complete tenant/support/RBAC work stays in PR #43;
this package does not establish authenticated support, staff RBAC or a completed
production tenant cutover.

After deployment, verify anonymous `/api/web/contracts` returns HTTP 200,
`meta.source: live`, `meta.contract_version: 2026-10-02.4`, expected tenant
publication offers, zero blocked offers and `stale: false`. Production
activation and this live after-deployment check are outside the local evidence
above.
