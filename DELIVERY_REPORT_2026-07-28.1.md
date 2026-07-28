# Gridex Web canonical API correction

## Release decision

`NO-GO`

The project is synchronized with both live `2026-07-28.1` OpenAPI documents,
installs cleanly and passes typecheck, lint, tests, contract preflight and the
production build. It is not approved for production because all acceptance
criteria in the assignment are not yet satisfied.

## Completed

- Replaced the stale `2026-07-27.1` snapshots and generated types with the
  verified `2026-07-28.1` contracts.
- Added an explicit hash manifest, semantic drift output, deploy preflight and
  a scheduled drift check.
- Removed the undocumented request version header and limited response-version
  header checks to operations where the OpenAPI contract declares the header.
- Moved custom website routes out of `/api/v1` and updated their callers.
- Added Ajv-based OpenAPI runtime validation for the implemented checkout,
  public contract, legal, application and webhook boundaries.
- Added production OPS-origin allowlisting and redirect blocking.
- Added a dedicated, rotatable state-signing keyring with `kid`.
- Bound quote, offer, legal bundle, immutable legal evidence and application
  state; added strict Europe/Stockholm business dates.
- Added all supported supplier, billing and metering fields and removed the
  unsupported `current_supplier_id`.
- Preserved business conflicts and only recovers a documented duplicate replay.
- Replaced granular portal overfetching and invoice heuristics with exact
  canonical resource operations and opaque invoice IDs.
- Made local portal fallback explicitly non-authoritative and read-only, and
  require browser-created stable operation IDs for writes.
- Added the canonical webhook path, exact headers, raw-body HMAC, tenant checks,
  numeric monotonic revisions, event/delivery dedupe, payload conflicts,
  non-website acknowledgements and generic storage for signed unknown types.
- Added database migrations for canonical publication state, immutable legal
  evidence and tenant-aware portal projection metadata.
- Removed stale delivery notes and duplicate/legacy API routes.

## Remaining production blockers

1. `lib/ops/client.ts` remains an active 4,029-line mixed client. Transport,
   services, mappers and validators have begun to be extracted, but the whole
   endpoint surface has not been migrated to those layers.
2. Several customer-portal schemas in the upstream OpenAPI remain structurally
   weak and the local portal types still contain permissive
   `Record<string, unknown>` surfaces. Therefore the statement “every OPS
   request and response is exact-runtime-validated” cannot yet be made.
3. The central BFF boundary is used by the canonical checkout and selected web
   routes, but method/content-type/body-size/origin/rate-limit/error handling is
   not yet uniformly enforced by every BFF route.
4. The migration adds tenant and projection metadata, but a full query-by-query
   PII retention, encryption, erasure and tenant-isolation audit is not complete.
5. The migrations have been statically reviewed but were not executed against
   the user's Supabase project in this environment.

## Upstream OPS contract blockers

### Dynamic legal requirements

- Endpoint: legal bundle and customer application.
- Guide: legal requirements may be dynamic.
- OpenAPI `2026-07-28.1`: the application accepts only five fixed booleans and
  has `additionalProperties: false`.
- Runtime consequence: an offer with another required legal module is blocked
  fail-closed.
- Required OPS change: add a versioned `legal_acceptances[]` request model with
  requirement code, document ID/version/hash, bundle version and acceptance
  timestamp, or constrain legal-bundle to the five request fields.
- No local workaround is valid because it would send undocumented legal data.

### Legal scope

- Endpoint: `GET /api/v1/website/legal-bundle`.
- Guide: accepts `website_legal.read` or `website_contracts.read`.
- OpenAPI `2026-07-28.1`: requires `website_legal.read`.
- Runtime consequence: readiness and runtime follow the machine-readable scope.
- Required OPS change: correct the guide, or version-bump OpenAPI with an
  explicit alternative security rule.

### Atomic portal identity

- Endpoint: customer application.
- Guide: refers to `customer_portal_user_id`/`auth_user_id`.
- OpenAPI `2026-07-28.1`: neither field exists in
  `CustomerApplicationRequest`.
- Runtime consequence: the web cannot create the portal relation atomically;
  an idempotent post-success reconciliation is retained only as repair.
- Required OPS change: define a nullable portal identity in the request and its
  transactional and idempotency semantics.

## Verification

| Command | Result |
|---|---|
| `npm ci --cache /tmp/gridex-final-npm-cache` | PASS — 398 packages |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm test` | PASS — all launch/regression checks |
| `npm run api:check` | PASS — both live contracts are `2026-07-28.1`, no drift |
| `npm run api:contract` | PASS — static and runtime contract checks |
| `npm run api:preflight` | PASS |
| `npm run build` | PASS — Next.js production build, 150 pages generated |
| Supabase migration execution | NOT RUN — no target database was connected |
| `npm run test:staging:ops` | NOT RUN — requires staging credentials |

The later final verification was performed after a fresh `npm ci`.

## Complete changed-file inventory

### Modified files

- `.github/workflows/openapi-drift.yml` — adds scheduled and deploy-preflight
  contract drift verification.
- `README.md` — documents `2026-07-28.1`, canonical routes, tenant versus
  infrastructure configuration, migrations and release checks.
- `app/(public)/teckna-avtal/page.tsx` — binds fresh offer/quote/legal evidence,
  sends the complete supported canonical application and fails closed.
- `app/admin/monthly-spot/page.tsx` — revalidates the new market-price BFF path.
- `app/admin/pricing/[slug]/page.tsx` — uses the shared Stockholm business date.
- `app/api/ops/webhooks/route.ts` — retires the legacy webhook with `410 Gone`
  and identifies the canonical successor.
- `app/dashboard/error.tsx` — calls the new portal-reconciliation BFF.
- `app/dashboard/profile/actions.ts` — performs authoritative OPS writes with a
  supplied stable operation ID before updating the local projection.
- `app/dashboard/profile/page.tsx` — creates the profile operation ID before
  submission and reflects authoritative write status.
- `components/ElectricityCalculator.tsx` — calls the new checkout-context BFF.
- `components/customer/CustomerPortalSelfService.tsx` — uses canonical web
  routes, stable operation IDs and Stockholm dates.
- `components/customer/EventLink.tsx` — creates and reuses a browser operation
  ID and calls the consolidated event route.
- `components/signup/ApplicationStatusCard.tsx` — calls the new checkout status
  route.
- `components/signup/CustomerApplicationForm.tsx` — dynamically renders the
  offer-specific legal bundle and adds billing, supplier-unknown and metering
  inputs.
- `components/signup/SwitchStatusCard.tsx` — calls the new checkout status BFF.
- `docs/openapi/customer-portal-v1.json` — updates the official snapshot to
  `2026-07-28.1`.
- `docs/openapi/website-integration-v1.json` — updates the official snapshot to
  `2026-07-28.1`.
- `docs/website-integration.md` — documents the actual canonical flow, webhook
  and exact upstream contradictions.
- `env.example` — adds dedicated key rotation, canonical webhook and origin
  allowlist configuration; removes legacy fallbacks.
- `lib/customerPortal/apiErrors.ts` — emits the shared BFF error envelope.
- `lib/customerPortal/service.ts` — adds exact resource reads, authoritative
  metadata and read-only fallback semantics.
- `lib/customerPortal/types.ts` — exposes authoritative/read-only freshness.
- `lib/ops/client.ts` — updates transport policy, validation, serializers,
  exact portal reads, legal/application handling and idempotency.
- `lib/ops/contract.ts` — becomes the single imported `2026-07-28.1` version
  source and corrects scope/header requirements.
- `lib/ops/generated/customer-portal-api.d.ts` — regenerates portal types from
  the live contract.
- `lib/ops/generated/website-api.d.ts` — regenerates website types from the live
  contract.
- `lib/ops/readiness.ts` — makes diagnostics optional and validates
  offer-specific legal readiness.
- `lib/website/energyAreaToken.ts` — adds versioned `kid`-based key rotation.
- `lib/website/pricingQuote.ts` — preserves the canonical commercial snapshot
  and adds versioned `kid`-based signing.
- `lib/website/publicApi.ts` — changes callers to `/api/checkout/*`.
- `lib/website/publicContractsEndpoint.ts` — serializes the numeric publication
  revision correctly.
- `lib/website/publicDtos.ts` — adds fail-closed legal bundle/version/hash
  evidence to the BFF DTO.
- `lib/website/serverTokenSecret.ts` — requires only the dedicated website
  signing keyring and removes secret reuse.
- `lib/website/signupValidation.ts` — uses strict Stockholm calendar dates.
- `lib/website/submissionStore.ts` — persists and hashes immutable legal
  evidence with the application attempt.
- `package-lock.json` — locks Ajv runtime-validation dependencies.
- `package.json` — adds Ajv packages and API preflight/manifest scripts.
- `scripts/check-openapi-drift.mjs` — checks approved hashes and reports
  versions plus changed paths/schemas without auto-accepting drift.
- `scripts/sync-openapi.mjs` — explicitly refreshes snapshots and manifest.
- `tests/customer-facing-pricing-visibility.test.mjs` — verifies the new signed
  canonical snapshot without exposing hidden fees.
- `tests/customer-portal-api-hardening.test.mjs` — verifies exact resource
  routes, opaque IDs and authoritative write policy.
- `tests/launch-readiness.test.mjs` — verifies the current readiness and secret
  rules.
- `tests/signup-pricing-regression.test.mjs` — verifies state binding and quote
  invalidation under the new token version.
- `tests/staging-canonical-ops-flow.mjs` — expects `2026-07-28.1`.
- `tests/typescript-alias-loader.mjs` — supports generated JSON schema imports
  in the Node contract runner.
- `tests/website-api-runtime.contract.test.mjs` — checks current runtime
  validators and header policy.
- `tests/website-api.contract.test.mjs` — checks current snapshots, version,
  routes and canonical serializers.
- `tests/website-signup-hardening.test.mjs` — verifies the new checkout/legal
  boundary and conflict behavior.

### Added files

- `app/api/checkout/applications/[applicationId]/route.ts` — canonical
  application-status BFF.
- `app/api/checkout/context/route.ts` — checkout state BFF.
- `app/api/checkout/energy-area/resolve/route.ts` — energy-area BFF.
- `app/api/checkout/legal-bundle/route.ts` — offer-specific legal BFF.
- `app/api/checkout/quote/route.ts` — quote BFF.
- `app/api/checkout/quote/validate/route.ts` — quote-validation BFF.
- `app/api/checkout/switch-status/route.ts` — checkout switch-status BFF.
- `app/api/web/contracts/route.ts` — public contract presentation BFF.
- `app/api/web/customer-portal/sync/route.ts` — portal reconciliation BFF.
- `app/api/web/customer/contracts/route.ts` — exact customer contracts BFF.
- `app/api/web/customer/documents/route.ts` — exact documents BFF.
- `app/api/web/customer/events/route.ts` — exact event read/write BFF.
- `app/api/web/customer/invoices/[id]/route.ts` — exact opaque-ID invoice BFF.
- `app/api/web/customer/invoices/route.ts` — exact invoice-list BFF.
- `app/api/web/customer/legal-acceptances/route.ts` — exact acceptance BFF.
- `app/api/web/customer/me/route.ts` — exact customer-profile BFF.
- `app/api/web/customer/metering-values/route.ts` — exact metering BFF.
- `app/api/web/customer/move-out/route.ts` — authoritative move-out BFF.
- `app/api/web/customer/notifications/read/route.ts` — authoritative
  notification-write BFF.
- `app/api/web/customer/notifications/route.ts` — exact notifications BFF.
- `app/api/web/customer/portal-bundle/route.ts` — one bundle for a complete
  portal page with explicit freshness.
- `app/api/web/customer/powers-of-attorney/route.ts` — exact powers BFF.
- `app/api/web/customer/profile-update/route.ts` — authoritative profile BFF.
- `app/api/web/customer/sites/route.ts` — exact sites BFF.
- `app/api/web/customer/switch-status/route.ts` — exact switch-status BFF.
- `app/api/web/customer/sync/route.ts` — customer reconciliation BFF.
- `app/api/web/market-price/current/route.ts` — market-price presentation BFF.
- `app/api/web/portfolio-prices/route.ts` — portfolio-prices presentation BFF.
- `app/webhooks/contracts.publication.changed/route.ts` — exact canonical
  webhook endpoint.
- `docs/openapi/manifest.json` — explicitly approved schema hashes.
- `lib/api/webBoundary.ts` — central request IDs, no-store, body limits,
  content type, origin checks and shared errors.
- `lib/customerPortal/resourceRoute.ts` — shared exact-resource route handler.
- `lib/ops/errors.ts` — shared OPS error types and safe normalization.
- `lib/ops/transport.ts` — allowlisted origin, redirect, retry and endpoint
  version policy.
- `lib/ops/validators/openapi.ts` — Ajv OpenAPI request/response validation.
- `lib/webhooks/publicationChanged.ts` — canonical signed webhook handler.
- `lib/website/businessDate.ts` — strict Europe/Stockholm business dates.
- `next-env.d.ts` — standard Next.js generated type declarations.
- `scripts/write-openapi-manifest.mjs` — explicit approved-manifest writer.
- `supabase/migrations/20260728130000_canonical_publication_webhook_20260728_1.sql`
  — numeric publication state, revision token, transactional dedupe/ordering
  and generic unknown-event storage.
- `supabase/migrations/20260728131000_immutable_legal_evidence.sql` — immutable
  legal evidence and protected audit semantics.
- `supabase/migrations/20260728132000_portal_projection_metadata.sql` —
  canonical OPS identity, tenant, revision, sync and projection metadata.
- `DELIVERY_REPORT_2026-07-28.1.md` — this release record.

### Deleted files

The following stale report files were removed because they described a
different and incomplete delivery:

- `CHANGED_FILES.txt`
- `COMMANDS.md`
- `COMMANDS_2026-07-25.1.md`
- `DELIVERY_REPORT.md`
- `IMPLEMENTATION.md`
- `IMPLEMENTATION_2026-07-25.1.md`
- `PATCH_NOTES.md`
- `VERIFICATION.md`
- `VERIFICATION_2026-07-25.1.md`
- `docs/website-integration-2026-07-25.1.md`
- `tests/website-api-2026-07-25-1.contract.test.mjs`

The following duplicate or locally invented API routes were removed. Their
supported callers now use `/api/checkout/*` or `/api/web/*`:

- `app/api/customer/events/route.ts`
- `app/api/offers/calculate/route.ts`
- `app/api/price/route.ts`
- `app/api/pricing/resolve-price-area/route.ts`
- `app/api/v1/customer-portal/sync/route.ts`
- `app/api/v1/customer/contracts/route.ts`
- `app/api/v1/customer/documents/route.ts`
- `app/api/v1/customer/events/route.ts`
- `app/api/v1/customer/invoices/[id]/route.ts`
- `app/api/v1/customer/invoices/route.ts`
- `app/api/v1/customer/legal-acceptances/route.ts`
- `app/api/v1/customer/me/route.ts`
- `app/api/v1/customer/metering-values/route.ts`
- `app/api/v1/customer/move-out/route.ts`
- `app/api/v1/customer/notifications/read/route.ts`
- `app/api/v1/customer/notifications/route.ts`
- `app/api/v1/customer/portal-bundle/route.ts`
- `app/api/v1/customer/powers-of-attorney/route.ts`
- `app/api/v1/customer/profile-update/route.ts`
- `app/api/v1/customer/sites/route.ts`
- `app/api/v1/customer/switch-status/route.ts`
- `app/api/v1/customer/sync/route.ts`
- `app/api/v1/events/route.ts`
- `app/api/v1/website/checkout-context/route.ts`
- `app/api/v1/website/contracts/route.ts`
- `app/api/v1/website/customer-applications/[applicationId]/route.ts`
- `app/api/v1/website/energy/resolve/route.ts`
- `app/api/v1/website/legal-bundle/route.ts`
- `app/api/v1/website/legal-texts/current/route.ts`
- `app/api/v1/website/market-price/current/route.ts`
- `app/api/v1/website/portfolio-prices/route.ts`
- `app/api/v1/website/pricing/preview/route.ts`
- `app/api/v1/website/pricing/quote/validate/route.ts`
- `app/api/v1/website/pricing/verify/route.ts`
- `app/api/v1/website/public-contracts/route.ts`
- `app/api/v1/website/quote/route.ts`
- `app/api/v1/website/switch-status/route.ts`
- `app/api/website/public-contracts/route.ts`

## Local/staging synchronization

Do not deploy this `NO-GO` package to production. To inspect it on a branch:

```bash
export GRIDEX_TARGET=/absolute/path/to/gridex-web
export GRIDEX_DELIVERY=/absolute/path/to/unpacked/gridex-web-main

test -d "$GRIDEX_TARGET/.git"
test -f "$GRIDEX_DELIVERY/package.json"
git -C "$GRIDEX_TARGET" status --short
git -C "$GRIDEX_TARGET" switch -c codex/canonical-api-2026-07-28-1

rsync -anv --delete \
  --exclude='.git/' \
  --exclude='.env*' \
  --exclude='node_modules/' \
  --exclude='.next/' \
  "$GRIDEX_DELIVERY/" "$GRIDEX_TARGET/"

rsync -av --delete \
  --exclude='.git/' \
  --exclude='.env*' \
  --exclude='node_modules/' \
  --exclude='.next/' \
  "$GRIDEX_DELIVERY/" "$GRIDEX_TARGET/"

cd "$GRIDEX_TARGET"
npm ci
npx supabase db push
npm run typecheck
npm run lint
npm test
npm run api:preflight
npm run build
npm run dev
```

Staging verification requires the staging environment variables documented in
`env.example`:

```bash
npm run test:staging:ops
```

Review the `rsync -anv --delete` dry run before executing the second `rsync`
because the real command removes legacy files that are absent from the
delivery. Preserve environment files and unrelated local work before syncing.
