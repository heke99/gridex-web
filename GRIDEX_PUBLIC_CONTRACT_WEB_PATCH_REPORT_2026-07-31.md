# GRIDEX public-contract web patch — leveransrapport

Datum: 2026-07-31  
Kontraktsversion: `2026-07-30.3`  
Leveransens scope: uppladdat `gridex-web`-repo

## Grundorsak

Webbens normalisering av `price_options[].area_prices[]` var byggd för den äldre
presentationsformen `price_area_code` + `fixed_price_ore_per_kwh`. Det aktuella
maskinkontraktet kräver i stället `area_price_reference`, `price_area`,
`energy_price_ore_per_kwh`, `unit`, `valid_from` och `valid_to`. Canonicala
områdesrader underkändes därför och ett kast från `mapPublicContract()` kunde
slå ut hela feeden.

Den tidigare primärfixturen använde dessutom en äldre juridikform i stället för
OpenAPI:s `required_modules` + `module_versions`.

## Implementerat i webbprojektet

- Canonical intern DTO för områdespris med bevarad extern referens och giltighet.
- Canonicala fält prioriteras; legacyalias är endast explicit kompatibilitet.
- Validering av referensformat, elområde, positivt ändligt pris, exakt enhet,
  kalenderdatum, dubbletter och överlappande perioder.
- Prisalternativ och områdesrad väljs mot kundens startdatum.
- Vald `area_price_reference` följer med ur selektionen och måste matcha OPS
  quote-svar.
- `channel=website` krävs i website-feeden.
- Per-rad OpenAPI- och semantikvalidering med maskinella koder och exakta paths.
- Trasiga avtalsrader isoleras; envelope- och tenantfel förblir hårda fel.
- Canonical `legal.module_versions` normaliseras till dynamiska juridikkrav och
  dokumentmetadata utan lokalt hårdkodad dokumentlista.
- Primärfixtur uppdaterad till incheckad OpenAPI-form.
- Regressionstester tillagda för canonicala områdespriser och feedisolering.

## Verifierat i denna miljö

Godkänt:

- `node --experimental-strip-types --experimental-loader ./tests/typescript-alias-loader.mjs tests/public-contract-canonical-area-prices.test.mjs`
- `node --experimental-strip-types --experimental-loader ./tests/typescript-alias-loader.mjs tests/public-contract-contract.test.mjs`
- `node --experimental-strip-types --experimental-loader ./tests/typescript-alias-loader.mjs tests/price-option-selection.test.mjs`
- `npm run verify:delivery`
- `node --experimental-strip-types tests/gridex-runtime-hardening.test.mjs`
- `node --experimental-strip-types --experimental-loader ./tests/typescript-alias-loader.mjs tests/website-signup-hardening.test.mjs`
- `node --experimental-strip-types --experimental-loader ./tests/typescript-alias-loader.mjs tests/customer-facing-pricing-visibility.test.mjs`
- `node --experimental-strip-types --experimental-loader ./tests/typescript-alias-loader.mjs tests/signup-pricing-regression.test.mjs`
- `node scripts/check-openapi-drift.mjs --local-only`
- `node scripts/check-api-compatibility.mjs`
- `node scripts/check-migration-manifest.mjs`
- Primärfixturen validerad mot `PublicContract` i incheckad OpenAPI med en
  oberoende JSON Schema-validator.
- Syntaxtranspilering utan fel för samtliga ändrade TypeScript-filer.
- `git diff --check` utan whitespacefel.

Ej körbart i denna sandbox:

- `npm ci` stoppades av package-registry: intern spegel returnerade 404 för
  `zod-validation-error@4.0.2`; direkt npmjs-försök stoppades av DNS/EAI_AGAIN.
- Därför kunde full `typecheck`, `lint`, komplett testsuite och Next-build inte
  köras här.
- Testet `public-contract-feed-isolation.test.mjs` kräver AJV-paketet och kunde
  inte exekveras efter den blockerade installationen. Testfilen och parsern är
  inkluderade i patchen.

## OPS, SQL och bakåtfill

OPS-repot, databasanslutning och målmiljön ingick inte i uppladdningen. Följande
har därför **inte** skapats, gissats eller markerats som körda:

- OPS-serialisering och diagnostics
- SQL-migrationer
- dry-run/apply av bakåtfill
- kloning av låsta kommersiella versioner
- publication revision, ETag, outbox och cacheinvalidering i OPS
- stagingverifiering med riktig API-nyckel

Det vore osäkert att skriva SQL utan de faktiska tabellerna, funktionerna,
triggers, vyerna och immutability-reglerna från OPS-repot. Webbleveransen är
således en färdig webpatch, inte en full två-repo-/databasleverans.

## Apply och rollback

Patch-ZIP:en innehåller endast ändrade och tillagda webbfiler med relativa
sökvägar. Rollback görs säkrast med Git genom att först skapa en separat branch
eller commit före synkningen och sedan återställa den committen.
