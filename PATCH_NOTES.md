# Gridex Web POA legal version ID fix

This patch fixes the website signup payload so `powerOfAttorney.textVersionId` is the OPS `legal_text_versions.id` UUID from `public-contracts.legal.power_of_attorney_version_id`, not the display/version label such as `2026-06-12-v1`.

## Fixed

- Normalizes legal version UUID fields from `/api/v1/website/public-contracts`:
  - `terms_version_id`
  - `privacy_policy_version_id`
  - `withdrawal_version_id`
  - `power_of_attorney_version_id`
  - `price_terms_version_id`
- Carries the legal version UUID fields through signup contract options and the signup client display model.
- Sends `powerOfAttorney.textVersionId = offer.power_of_attorney_version_id` in `app/(public)/teckna-avtal/page.tsx`.
- Blocks signup with a customer-safe message if a POA-required offer does not expose a valid legal UUID.
- Keeps the readable `power_of_attorney_version` only as display/version label, never as `textVersionId`.
- Broadens the safe idempotency retry to include `idempotent_application_missing_poa`.
- Updates tests and docs so the mistake does not come back.

## Why

OPS expects `powerOfAttorney.textVersionId` to be a UUID. Sending a label like `2026-06-12-v1` causes OPS to fail with `22P02 invalid input syntax for type uuid` in the `power_of_attorney` stage.

## Verification run in sandbox

```txt
node --experimental-strip-types tests/public-contract-contract.test.mjs ✅
node tests/launch-readiness.test.mjs ✅
node tests/signup-pricing-regression.test.mjs ✅
```

`npm run build` was not run in the sandbox because the uploaded zip does not contain `node_modules`.
