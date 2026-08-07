# File size review

A CI guard was added at `scripts/check-file-size.mjs`.

Policy:
- limit: 2,000 lines;
- scanned production roots: `app`, `components`, `lib`, `scripts`, `supabase`;
- scanned extensions: `.ts`, `.tsx`, `.js`, `.jsx`, `.sql`;
- build/dependency outputs excluded;
- explicit generated exception: `lib/ops/generated/` because those files are deterministic OpenAPI output.

The large checkout page `app/(public)/teckna-avtal/page.tsx` was inspected around the threshold and did not require artificial fragmentation.

Final PASS/FAIL is sourced from the GitHub Actions quality gate rather than a guessed local result.
