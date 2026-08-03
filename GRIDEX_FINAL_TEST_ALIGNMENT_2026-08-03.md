# Gridex API final test alignment — 2026-08-03

## Scope

This patch updates two stale regression-test assumptions after the verified OpenAPI sync to contract `2026-08-02.1`. Runtime code, database migrations and generated OpenAPI files are not changed.

## Fixes

1. `tests/website-api.contract.test.mjs`
   - `WebsiteQuoteRequest.price_option_reference` remains a published, pattern-validated property.
   - It is optional during quote creation in the live contract.
   - It remains required in `QuoteValidationRequest` and `CustomerApplicationRequest`.
   - The test now verifies this exact lifecycle instead of requiring the field at every stage.

2. `tests/api-contract-runtime-regressions-20260801.test.mjs`
   - Valid webhook fixtures now use `event_<32 lowercase hex>` and `delivery_<32 lowercase hex>`.
   - A negative regression check confirms the old `evt_publication_301` / `delivery_publication_301` format is rejected.

## Expected result

After applying the patch, run:

```bash
npm run api:contract
npm run test:launch
npm run api:preflight
```

The existing successful `npm run build`, TypeScript, compatibility and migration results do not need corrective runtime changes.
