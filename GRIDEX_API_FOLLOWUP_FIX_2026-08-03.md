# Gridex API follow-up correction — 2026-08-03

## Root causes

1. The live `2026-08-02.1` Website Integration OpenAPI uses `application_number` as the public identity for application status. Internal `application_id` is neither accepted nor returned by the status endpoint.
2. `WebsiteQuoteRequest` has `additionalProperties: false` and does not contain top-level `requested_start_mode`. Start mode remains part of the customer application contract payload.
3. `npm run api:check:live` only checks drift. It does not write `live_sync_verified=true`. Only a successful `npm run api:sync` writes that verification evidence after downloading exact bytes, checking SHA-256, regenerating types/manifests and passing local compatibility checks.

## Corrections

- Status lookup and identity verification now use `application_number` end-to-end.
- Receipt status polling uses the public application number.
- Durable submission status updates match `ops_application_number`, not the obsolete internal UUID column.
- Quote validation uses optional `application_number`, matching the live schema.
- Runtime/application mappings no longer depend on `application_id`.
- The contract test now asserts that quote requests exclude top-level `requested_start_mode` and that start mode remains nested in the application contract.
- A focused regression test prevents `application_id` from being reintroduced into the public flow.

## Apply

```bash
rm -rf /tmp/gridex-api-followup
mkdir -p /tmp/gridex-api-followup

unzip -q \
  "/Users/hekmath/Downloads/gridex-api-followup-fix-2026-08-03.zip" \
  -d /tmp/gridex-api-followup

rsync -av \
  /tmp/gridex-api-followup/ \
  "/Users/hekmath/Desktop/Projects/gridex-web/"

cd "/Users/hekmath/Desktop/Projects/gridex-web"
```

## Set `live_sync_verified` to true correctly

Do not edit `docs/openapi/verification-status.json` manually.

```bash
npm run api:sync
cat docs/openapi/verification-status.json
```

A successful sync ends with:

```text
Live OpenAPI sync verified (2026-08-02.1).
```

The JSON must then contain:

```json
{
  "live_sync_verified": true,
  "verified_at": "<timestamp>",
  "contract_version": "2026-08-02.1"
}
```

## Required verification order

```bash
npm run api:sync
npm run api:check:live
npm run typecheck
npm run api:contract
npm run test:launch
npm run api:compatibility
npm run build
npm run api:preflight
```

No new database migration is included or required for this correction.
