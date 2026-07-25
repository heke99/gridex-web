# Gridex Web – verifieringsrapport 2026-07-25.1

## Körda kontroller

| Kontroll | Resultat | Kommentar |
|---|---:|---|
| JavaScript-syntax för OpenAPI-skript | PASS | `node --check` passerade för sync, generate och drift. |
| OpenAPI JSON-parse | PASS | Båda lokala dokumenten är giltig JSON och versionerade `2026-07-25.1`. |
| `npm run api:generate` | PASS | Båda deklarationsfilerna regenererades med version och SHA-256. |
| `npm run api:contract` | PASS | Capabilitymodell, canonical quote, application, fullmakt och portal-kontrakt passerade. |
| `npm test` | PASS | Samtliga åtta lokala regressions-/kontraktsviter passerade. |
| Sökning efter `automation_allowed` i produktionskod | PASS | Inga träffar. |
| Sökning efter gamla API-key-alias i produktionskod | PASS | Inga träffar för `GRIDEX_WEBSITE_API_KEY` eller `GRIDEX_OPS_API_KEY`. |
| `npm run typecheck` | BLOCKED | `node_modules` saknas. Diagnoserna är saknade Next/React/Node/Supabase-moduler och JSX-typer; inga fristående kontraktsdiagnoser identifierades i de ändrade serverfilerna. |
| `npm run lint` | BLOCKED | `eslint` saknas utan installerade dependencies. |
| `npm run build` | BLOCKED | `next` saknas utan installerade dependencies. |
| `npm run api:sync` / `api:check` mot live | BLOCKED | Leveransmiljön kan inte DNS-resolvera `app.gridex.se`. |
| Live OPS staging-E2E | NOT RUN | Kräver nätverk, giltig test-`GRIDEX_API_KEY` och godkänd staging-fixture. |

## Miljöblockerare

Den isolerade leveransmiljön kunde inte DNS-resolvera npm-registret eller Gridex-domänen. Därför kunde dependencies inte installeras och live-specifikationerna inte sparas byte-för-byte i arbetskopian. Reproducerbara sync-/driftkommandon ingår och ska köras på utvecklardatorn innan deploy.

Inget buildresultat, typecheckresultat eller live-E2E påstås vara godkänt när det inte kunde köras.

## Obligatorisk verifiering efter synk

```bash
rm -rf node_modules .next tsconfig.tsbuildinfo
npm ci
npm run api:refresh
npm run api:contract
npm run typecheck
npm run lint
npm test
npm run build
```

Staging:

```bash
GRIDEX_API_KEY='gridex_test_xxxxxxxxx' \
GRIDEX_STAGING_E2E_FIXTURE="$PWD/.local/gridex-staging-e2e.json" \
npm run test:staging:ops
```
