# Gridex final fixture alignment — 2026-08-03

## Root cause

The production build and TypeScript checks are green. The remaining failures were test fixtures that no longer matched the canonical `2026-08-02.1` contract.

- `website-api-runtime.contract.test.mjs` used an incomplete monthly price option for a quarterly production contract. The fixture now includes all canonical price-option fields and uses a dedicated quarterly production option.
- `public-contract-feed-isolation.test.mjs` omitted `pricing.calculation_contract` and `legal.power_of_attorney_version_id`, both required by the current public-contract contract.

## Files

- `tests/website-api-runtime.contract.test.mjs`
- `tests/public-contract-feed-isolation.test.mjs`

No runtime code, database migrations, API versions or generated OpenAPI files are changed.
