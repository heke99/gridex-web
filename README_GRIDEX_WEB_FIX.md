# Gridex Web quote-integrity synchronization fix — 2026-08-05

This package contains changes only for `gridex-web`.

## Apply

```bash
rsync -av --itemize-changes \
  "/path/to/unpacked/gridex-web-quote-integrity-fix-20260805/" \
  "/Users/hekmath/Projects/gridex-web/"
```

Deploy the OPS fix first. Then run:

```bash
cd "/Users/hekmath/Projects/gridex-web"
npm run api:sync
npm run api:check:live
npm run api:contract
npm run api:compatibility
node tests/quote-validation-canonical-tuple.test.mjs
node tests/signup-quote-integrity-sync.test.mjs
node tests/api-compatibility-hardening.test.mjs
node --experimental-strip-types --experimental-loader ./tests/typescript-alias-loader.mjs tests/ops-transport-not-modified.test.mjs
node --experimental-strip-types --experimental-loader ./tests/typescript-alias-loader.mjs tests/website-signup-hardening.test.mjs
npm run typecheck
npm run build
```
