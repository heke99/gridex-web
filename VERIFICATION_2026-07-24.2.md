# Gridex Web – verifieringsrapport 2026-07-24.2

## Resultat

| Kontroll | Resultat | Kommentar |
|---|---:|---|
| `npm run api:contract` | PASS | 2026-07-24.2, keymodell, top-level-payload, market/status och migration kontrollerade. |
| `npm run test:canonical-market-flow` | PASS | Canonical market/quote/application-kontrakt passerade. |
| `npm run test:customer-application` | PASS | Kundansökans kontrakt passerade. |
| `npm run test:idempotency` | PASS | Signup/idempotens-hardening passerade. |
| `npm run test:portal` | PASS | Kundportalens API-hardening passerade. |
| `npm run test:launch` | PASS | Hela launch-sviten passerade. |
| `npm test` | PASS | Alias för hela launch-sviten passerade. |
| OpenAPI JSON-parse | PASS | Båda incheckade JSON-filerna är syntaktiskt giltiga. |
| Genererade `.d.ts` syntaxkontroll | PASS | Deklarationsfilerna kan parsas med Node TypeScript strip-types-kontroll. |
| `npm ci` | BLOCKED | Paketregistret svarade HTTP 503 för `zod-validation-error-4.0.2.tgz`. |
| `npm run typecheck` | BLOCKED | Dependency-installationen saknas; fel är främst saknade Next/React/Node/Supabase-moduler och typer. |
| `npm run build` | BLOCKED | `next` saknas efter avbruten `npm ci`. |
| `npm run api:drift` | BLOCKED | Containern kunde inte DNS-resolvera `app.gridex.se`, och npm-registret var inte tillgängligt för live-generering. |
| Supabase migration | NOT RUN | Ingen Supabase CLI-projektkoppling eller databasnyckel i miljön. |
| Live OPS staging E2E | NOT RUN | Ingen test-API-nyckel eller stagingidentitet i miljön. |

## Exakta blockerare

`npm ci`:

```text
npm error code E503
npm error 503 Service Temporarily Unavailable - GET .../zod-validation-error-4.0.2.tgz
```

`npm run build` efter den avbrutna installationen:

```text
> next build
sh: 1: next: not found
```

## Kontroller efter synk på utvecklardatorn

```bash
cd /Users/hekmath/Desktop/Projects/gridex-web
rm -rf node_modules .next tsconfig.tsbuildinfo
npm ci
npm run api:generate
npm run api:contract
npm run api:drift
npm run typecheck
npm test
npm run build
npx supabase db push --include-all
```

Därefter körs stagingkedjan med en riktig `GRIDEX_API_KEY` och en unik testkund. Verifiera att en dubbel submit med samma payload och idempotensnyckel ger samma application/customer/contract-resultat.

```bash
# Kräver GRIDEX_API_KEY och GRIDEX_STAGING_E2E_FIXTURE
npm run test:staging:ops
```
