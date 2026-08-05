# Gridex Web – quote/API-granskning 2026-08-05

## Resultat

Gridex Webs lokala Website Integration- och Customer Portal-kontrakt är synkroniserade med API-version `2026-08-04.3`.

Verifierat lokalt:

- Website OpenAPI SHA-256: `cb646455421d1c56bd94ce11c970ad73560d88b72a9c9940c405ac754c0a6595`
- Customer Portal OpenAPI SHA-256: `16187883ad4df64ac8e67b9352753d2492369978961c3c84cef0eadb8739d922`
- `upstream_contract_gaps`: inga
- `environment_blockers`: inga i den statiska kompatibilitetskontrollen
- Lokala OpenAPI-snapshots och genererade typer: konsekventa
- Migrationsmanifest: 33 filer, godkänt

## Rotorsak som hittades

`lib/ops/client.ts` försökte korrekt tillåta kompatibla additiva svarsfält, men klassificeringen krävde att samtliga AJV-fel hade keyword `additionalProperties`.

För scheman som använder `oneOf`, exempelvis `selected_area_price: FixedAreaPrice | null`, skapar AJV även följdfelen:

- `type` för null-grenen
- `oneOf` för unionsschemat

Det innebär att ett nytt ofarligt fält från OPS kunde klassas som `canonical_response_schema_invalid`, trots att den faktiska avvikelsen endast var ett kompatibelt tilläggsfält.

Det tidigare felmeddelandet tappade dessutom upstream `request_id`, `correlation_id`, JSON-path och säkra nyckeluppgifter. Därför visades `upstream_request_id: null` även när identifieraren kunde finnas i svaret.

## Genomförd fix

1. Ny central klassificerare för kompatibla additiva schemaavvikelser.
2. AJV:s sekundära `oneOf`/`anyOf` och `type:null` tolereras endast när de kan knytas till ett verkligt `additionalProperties`-fel på samma objektgren.
3. Följande fortsätter att blockeras:
   - saknade required-fält
   - fel datatyp
   - fel enum/const
   - fel kontraktsversion
   - verkliga icke-additiva schemafel
4. `OpsSchemaError` bevarar nu:
   - instance path
   - schema path
   - AJV params
   - upstream request/correlation ID
   - kontraktsversion
   - endast säkra top-level/data-nyckelnamn
5. Quote-loggen visar nu exakt `schema_issues` utan att logga API-nyckel eller kundpayload.
6. Ett regressionstest har lagts till i ordinarie `test:launch`.

## Ändrade/tillagda filer

- `app/api/checkout/quote/route.ts`
- `lib/ops/client.ts`
- `lib/ops/errors.ts`
- `lib/ops/validators/openapi.ts`
- `lib/ops/schemaCompatibility.ts` (ny)
- `tests/schema-additive-compatibility.test.mjs` (ny)
- `package.json`
- `GRIDEX_QUOTE_API_AUDIT_2026-08-05.md` (ny)
- `GRIDEX_QUOTE_API_AUDIT_CHANGED_FILES.txt` (ny)

## Kontroller som passerade

```bash
node --experimental-strip-types --experimental-loader ./tests/typescript-alias-loader.mjs tests/schema-additive-compatibility.test.mjs
node tests/api-compatibility-hardening.test.mjs
node --experimental-strip-types --experimental-loader ./tests/typescript-alias-loader.mjs tests/api-contract-regressions-20260804-3.test.mjs
node tests/openapi-sync-contract.test.mjs
node scripts/check-api-compatibility.mjs
npm run api:check:local
npm run db:migrations:check
```

## Begränsning i granskningsmiljön

Full `npm ci`, Next.js-build och hela testsviten kunde inte köras eftersom den tillgängliga interna npm-spegeln returnerade 404 för paketarkiv, bland annat `zod-validation-error-4.0.2.tgz` och `ws-8.21.0.tgz`. Detta är inte ett konstaterat kodfel i projektet.

## Kör efter synkning

```bash
cd /Users/hekmath/Projects/gridex-web
npm ci
npm run api:check
npm run typecheck
npm run lint
npm run test:launch
npm run build
```

Deploya därefter Gridex Web och gör en ny prisberäkning. Om OPS-svaret endast innehåller kompatibla tilläggsfält ska quote nu accepteras. Om ett verkligt kontraktsfel återstår kommer loggen att ange exakt JSON-path, schemafel och upstream request-ID så att OPS-felet kan korrigeras direkt.
