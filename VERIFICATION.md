# Gridex Web – verifiering 2026-07-27.1

## Genomfört i leveransmiljön

| Kommando/kontroll | Resultat | Bevis |
|---|---:|---|
| `node --check scripts/*.mjs` | PASS | Samtliga OpenAPI-skript passerade syntaxkontroll. |
| `npm run api:generate` | PASS | Båda deklarationsfilerna genererades som `2026-07-27.1`. |
| `npm run api:check:local` | PASS | Båda snapshots är giltiga och matchar incheckade typers SHA-256. |
| `npm test` | PASS | 9 kontrakts-/regressionsviter passerade. |
| OpenAPI-/runtime-importtester | PASS | Public contracts, quote validation, customer application, portal och UI-mappning kördes via Node strip-types. |
| Sökning efter konkurrerande checkoutmotor | PASS | Checkout importerar inte `livePrices`, `postalAreas`, `offers` eller `previewEngine`. |
| `npm ci --no-audit --no-fund` | BLOCKED | Intern npm-proxy returnerade upprepade HTTP 503 för beroenden. |
| `npm ci --offline` | BLOCKED | Minst `zod-validation-error-4.0.2.tgz` saknades i cache (`ENOTCACHED`). |
| `npm run typecheck` | BLOCKED | Kan inte köras tillförlitligt utan fullständigt `node_modules`. |
| `npm run lint` | BLOCKED | Kan inte köras tillförlitligt utan installerad ESLint/Next-konfiguration. |
| `npm run build` | BLOCKED | Kan inte köras utan komplett Next-installation. |
| `npm run api:check` mot live | BLOCKED | Container-DNS kunde inte resolvera `app.gridex.se`. |
| Staging-E2E | BLOCKED | Ingen `GRIDEX_API_KEY`/godkänd staging-fixture fanns i körmiljön. |

## Vad PASS betyder

De gröna lokala testerna verifierar ändrad runtimekod, request-/responsemappning, kontraktsspärrar, versionskonstanter och lokala snapshots. De ersätter inte en full TypeScript-/Next-build eller ett live-E2E-test.

## Obligatorisk verifiering på utvecklardatorn

```bash
rm -rf node_modules .next tsconfig.tsbuildinfo
npm ci
npm run api:sync
npm run api:check
npm run api:contract
npm run typecheck
npm run lint
npm test
npm run build
```

Deploy får inte ske förrän samtliga kommandon är gröna och stagingflödet har körts med godkända testidentiteter.
