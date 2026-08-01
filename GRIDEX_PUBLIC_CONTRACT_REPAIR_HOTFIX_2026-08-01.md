# Gridex Web public-contract repair hotfix — 2026-08-01

Denna hotfix appliceras ovanpå `gridex-web-public-contract-repair-2026-08-01.zip`.

## Korrigeringar

1. Byter lokala variabelnamnet `module` till `legalModule` på två ställen så att Next.js-regeln `@next/next/no-assign-module-variable` passerar.
2. Tar bort `requested_start_mode` från `WebsiteQuoteRequest`. Den publicerade OpenAPI 2026-08-01.1 tillåter inte fältet på quote-endpointens top-level.
3. Bevarar det mottagna `contract_schema_version` som `string` för current-market-price. OPS OpenAPI har fortfarande endpointens värde `2026-07-30.3` trots att huvudreleasen är `2026-08-01.1`; drift loggas redan av `logContractVersionDrift`.
4. Prisalternativsväljaren använder `is_default ?? default ?? false`, så det dokumenterade deprecated-aliaset fungerar även före full normalisering.
5. Regressionstestet skiljer nu korrekt på rörliga avtal och fastpris: ett rörligt avtal kräver inte matchande statiskt områdespris, medan fastpris fortfarande gör det.

## Verifierat här

- `tests/price-option-selection.test.mjs`: godkänd.
- `tests/signup-pricing-regression.test.mjs`: godkänd.
- `tests/signup-contract-option-adapter.test.mjs`: godkänd.
- `tests/website-signup-hardening.test.mjs`: godkänd.
- Fokuserad TypeScript-kontroll mot den publicerade quote-typen utan `requested_start_mode` och market-price-versionen `2026-07-30.3`: godkänd.
- Exakta lintträffar med variabelnamnet `module`: borttagna.

Kör full verifiering i projektet efter synkning:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```
