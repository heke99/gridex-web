# Changes

## API
- Restored website/customer OpenAPI snapshots, generated types, manifest/release metadata and contract fixtures from the verified `2026-08-05.1` lineage after discovering an unpublished/local `.2` sync on baseline.
- Runtime `GRIDEX_API_CONTRACT_VERSION` is aligned to `2026-08-05.1`.
- `shouldObserveOpsContractVersion()` now covers all website/customer/OpenAPI response families.

## Database
- No migration added. Existing distributed rate-limit migration/RPC/index/security controls were sufficient for the verified path.

## Performance / cache / rate limiting
- Preserved bounded OPS timeout, safe GET/HEAD retries, `no-store` transactional default and ETag/304 public-contract reuse.
- No unsafe global cache or duplicate limiter added.

## Testing
- Added `tests/ops-contract-version-observation.test.mjs`.

## CI
- Added `scripts/check-file-size.mjs`.
- Added `.github/workflows/remediation-quality.yml` covering install, contract/schema checks, regression, lint, typecheck, full tests and build.

## Documentation
- Added the complete evidence package under this directory.
