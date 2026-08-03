# Gridex Web – API-compliance delivery 2026-08-02

## Canonical source

- Documentation: `https://app.gridex.se/developers/customer-portal-api`
- Release: `2026-08-02.1`
- Released: `2026-08-02T20:16:00.000Z`
- Build commit: `7ddd50a5419b5527039fdbc1197cf39b50875e6b`
- Classification: `additive-with-cache-correctness-fix`
- Website OpenAPI SHA-256: `971f0f4e00330971c92a37046f54fa7d27416a5b64932c7d37d7892b79691e7a`
- Customer Portal OpenAPI SHA-256: `921daeb0c1bdfe4f4dc50cbbc3990defce8556bfe7cff0a88a0f4d96f4d6b779`

## Corrected deviations

1. Upgraded contract, generated types, documentation and release metadata to `2026-08-02.1`.
2. Added strict `feed_state` and `empty_feed_authorization` validation. An empty array alone can never remove visible contracts.
3. Protected the durable last-known-good contract snapshot from partial, invalid, all-blocked and transiently empty candidates.
4. Required canonical empty-feed proof to be stored atomically before an empty feed may become customer-visible.
5. Added required immutable legal field `power_of_attorney_version_id` and UUID validation.
6. Enforced agreement between response header and payload contract versions.
7. Kept tenant selection exclusively API-key-bound; no `company_id` selector is introduced.
8. Kept customer number separate from stable `external_customer_id` and bound both required portal identity headers/body IDs to the verified auth UUID.
9. Restored canonical quote expiry: `valid_until` is required, signed, checked locally and compared exactly with OPS quote-validation.
10. Invalidated old non-expiring browser quote tokens by moving to token version `v7`; customers must obtain a new quote.
11. Added a forward migration that enforces expiry on new pricing snapshots and removes the executable that could reactivate expired quotes.
12. Hardened `api:sync` so future releases atomically update version, both official SHA constants, raw specs, generated types, manifests and verification evidence.
13. API readiness now keeps website sales, market prices, diagnostics and customer portal capabilities blocked until exact live OpenAPI sync is verified.

## Important delivery state

The delivery sandbox verified the official release metadata and current contract semantics, but could not persist the exact live OpenAPI raw bytes because outbound package/network access was unavailable. The checked-in specs are therefore marked as compatibility snapshots and:

```json
"live_sync_verified": false
```

Do not deploy before `npm run api:sync` succeeds and changes that flag to `true` with the official checksums.

## Apply the changed-files zip

```bash
rm -rf /tmp/gridex-api-patch
mkdir -p /tmp/gridex-api-patch
unzip -q "/Users/hekmath/Downloads/gridex-api-compliance-2026-08-02-changed-files.zip" -d /tmp/gridex-api-patch
rsync -av /tmp/gridex-api-patch/ "/Users/hekmath/Projects/gridex-web/"
cd "/Users/hekmath/Projects/gridex-web"
```

## Required verification and deployment order

```bash
npm ci

# Mandatory: replace compatibility snapshots with exact official raw bytes,
# regenerate types/validators and verify official SHA-256 values.
npm run api:sync
npm run api:check:live

# Confirm all 29 migrations and apply to linked staging first.
npm run db:migrations:check
npx supabase db push

npm run typecheck
npm run lint
npm run test:launch
npm run api:compatibility
npm run build
npm run api:preflight
```

After staging passes, apply the same migrations and build artifact to production. Do not manually run older edited migrations; only the two new timestamped migrations in this delivery should be newly pending.

## Tests completed in the delivery sandbox

Passed:

- OpenAPI local snapshot/type/manifest consistency
- OpenAPI release and sync-contract regression checks
- 2026-08-02 API regression checks
- public-contract last-known-good durability
- public-contract failure visibility and fail-closed isolation
- public-contract parser and issue-policy checks
- canonical quote expiry and customer-facing pricing visibility
- Gridex runtime hardening
- API compatibility hardening static checks
- migration integrity: 29 files, no version collisions

Environment blocker confirmed:

- `live_openapi_sync_not_verified`

Not fully executable in the sandbox:

- full TypeScript typecheck, full launch suite and Next.js production build, because npm dependencies such as `ajv`, `@supabase/ssr` and related packages could not be installed from the unavailable registry/network.
