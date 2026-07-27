# GRIDEX WEB – leveransrapport 2026-07-27

## 1. Slutstatus

```text
INTE KLAR
```

De verifierbara kontrakts- och runtimefelen i den bifogade arbetskopian har korrigerats och de lokala kontrakts-/regressionstesterna är gröna. Definition of Done är ändå inte uppfylld eftersom denna körmiljö inte kunde installera den låsta dependencyträdet, nå `app.gridex.se` för en live-driftkontroll eller köra stagingtesterna med en giltig testnyckel. Därför är full typecheck, lint, Next-produktionsbuild och riktig API-verifiering inte bekräftade.

## 2. Bekräftad API-version

| Kontroll | Version |
|---|---:|
| Produktionsdokumentation | `2026-07-27.1` |
| Website Integration OpenAPI | `2026-07-27.1` |
| Customer Portal OpenAPI | `2026-07-27.1` |
| Version som klienten skickar | `2026-07-27.1` |
| Version som lokala kontraktstester verifierar | `2026-07-27.1` |

Klienten använder de dokumenterade versionsheadrarna via `lib/ops/contract.ts`. Lokala snapshots och genererade deklarationer är internt hash- och versionssynkroniserade. En avslutande byte-för-byte-jämförelse mot live-OpenAPI kunde inte utföras eftersom körmiljön fick `getaddrinfo EAI_AGAIN app.gridex.se`.

## 3. Hittade fel

| Grad | Fil/område | Orsak | Konsekvens | Genomförd korrigering |
|---|---|---|---|---|
| P0 | `lib/ops/contract.ts`, OpenAPI-snapshots, genererade typer och tester | Projektet var bundet till `2026-07-25.1` medan produktion publicerar `2026-07-27.1`. | Versionsdrift och tester som kunde godkänna ett gammalt kontrakt. | Synkroniserat version, snapshots, typer, headers, testnamn, dokumentation och driftkontroller till `2026-07-27.1`. |
| P0 | `lib/website/publicContractContract.ts`, `lib/website/publicDtos.ts`, `lib/website/publicApi.ts` | `energy_direction` och `production_pricing` bevarades inte strikt genom hela modellen. | Produktionsavtal kunde behandlas som konsumtionsavtal eller visas utan bindande produktionsvillkor. | Infört strikt riktning/prissättningsmodell, end-to-end-propagation och blockering av ofullständiga produktionsavtal. |
| P0 | `lib/ops/client.ts` – quote validation | Saknade svarsfält kunde fyllas från requestens referenser. | En ofullständig eller felbunden offertvalidering kunde godkännas. | Kräver `valid === true`, närvarande `quote_reference` och `offer_reference`, samt exakt matchning utan fallback. |
| P0 | `lib/ops/client.ts` – customer application response | Mappern läste äldre interna/top-level-fält i stället för aktuell publik och nästlad responsemodell. | Fel status, onboarding, fullmakt och leverantörsbyte i UI. | Mappern använder aktuell publik modell, nästlat `supplier_switch`, publik fullmaktsstatus, strukturerade communications och `energy_direction`. |
| P1 | `lib/ops/client.ts`, tack-/signup-UI | Fullmakt kunde härledas från förekomst av internt ID. | Ett existerande ID kunde felaktigt tolkas som signerad fullmakt. | Status bestäms av publik `power_of_attorney.status`; interna ID:n styr inte signeringsstatus. |
| P1 | `lib/ops/client.ts`, `lib/website/applicationResultStore.ts` | Kommunikationsobjekt konverterades till strängar. | Data kunde bli `[object Object]` och status/tid/felkod förstöras. | Infört strukturerad kommunikationsmodell och säker lagring/presentation. |
| P1 | `lib/ops/client.ts`, `lib/ops/portalReadiness.ts` | GET användes som primär portal-bundle-metod trots att dokumentationen anger POST som huvudflöde. | Felaktigt eller föråldrat portalflöde. | POST med JSON-body är primärt; legacy GET är endast uttryckligt miljöaktiverad kompatibilitet. |
| P1 | `lib/ops/readiness.ts`, `lib/ops/portalReadiness.ts` | Readiness blandade obligatoriska och valfria scopes/capabilities och validerade integrationskontexten för löst. | Valfri marknadsprisfunktion kunde blockera checkout, eller fel tenantkontext accepteras. | Separata capabilities och strikt kontroll av API-key identity, auth-header/scheme, version, paths, scopes och server-side-only. |
| P1 | `lib/ops/client.ts`, `lib/ops/generated/*` | Genererade typer användes inte konsekvent av nätverkskontraktet. | OpenAPI-ändringar behövde inte bryta runtimekompilering/tester. | Request/response/enums binds till genererade OpenAPI-komponenter med explicita UI-domänmappningar. |
| P1 | Kundansökan – dokumentation kontra OpenAPI | Dokumentationsprosa nämner auth-identitetsfält som den strikta OpenAPI-requesten inte tillåter. | Risk för request som avvisas av `additionalProperties: false`. | Runtime följer maskinläsbar OpenAPI och skickar inte förbjudna auth-ID:n; motsägelsen dokumenteras och regressionsskyddas. |
| P1 | `lib/ops/client.ts` – retry/felhantering | Retry var huvudsakligen begränsad till 429 och gav otillräckligt skydd för transienta nätfel. | Onödiga kundfel eller risk för felaktig dubbel skrivning. | Begränsad retry för 429/502/503/504/nätverk/timeout, backoff+jitter, `Retry-After`, och skrivretry endast med idempotency key. |
| P2 | `.github/workflows/openapi-drift.yml`, scripts | CI-kommandot kunde mutera snapshots och versionsbundna filnamn skapade framtida drift. | Drift kunde döljas och nästa API-version krävde manuella filbyten. | CI kör read-only `api:check`; stabila test-/dokumentnamn och reproducerbara `api:sync`/`api:check` har införts. |
| P2 | `lib/website/publicContractDisplay.ts`, signup-UI | Kvartspris och produktionsvillkor saknade explicit kundpresentation; fakturaavgift kunde exponeras separat. | Felaktiga eller interna kundtexter. | Kundvänliga svenska etiketter, produktionsspecifika texter, exakt nätavgiftstext och dold inräknad fakturaavgift. |

## 4. Ändrade filer

Det exakta manifestet finns i `CHANGED_FILES.txt` och innehåller status `A`, `M` eller `D` för varje fil. Sammanfattning:

- OpenAPI/CI: `.github/workflows/openapi-drift.yml`, `docs/openapi/*`, `scripts/openapi-common.mjs`, sync/check/generator-scripts.
- Runtime: `lib/ops/client.ts`, kontrakt, readiness, portal-readiness och genererade typer.
- Webbdomän/UI: public-contract-, quote-, application-result- och signup/tack-filer.
- Tester/fixtures: aktuella kontrakts-, runtime-, checkout-, portal- och regressionstester.
- Dokumentation/config: `README.md`, `PATCH_NOTES.md`, `COMMANDS.md`, `IMPLEMENTATION.md`, `VERIFICATION.md`, `docs/website-integration.md`, `env.example`, `package.json`.
- Borttagna versionsbundna filer redovisas som `D` i manifestet.
- Databasmigrationer: **inga**.

## 5. Implementerade korrigeringar

- Reproducerbar `npm run api:sync` och read-only `npm run api:check`/`api:check:local`.
- Dynamisk kontraktsversion och lokal hashkontroll för båda OpenAPI-specifikationerna och genererade typer.
- Genererade OpenAPI-typer används av runtime för relevanta request/responsemodeller.
- Strikt versionsheaderkontroll och säkra fel med request/correlation/reference-ID där de finns.
- Public contracts med `consumption`/`production`, explicit `production_pricing`, kvartspris och områdesberoende presentation.
- OPS-only energy-area/quote-flöde utan ny lokal bindande prismotor.
- Strikt quote validation omedelbart före ansökan.
- Aktuell top-level customer-application-payload, stabil payloadbunden idempotency och publik responsemappning.
- Nästlat supplier switch, statusbaserad fullmakt och strukturerade communications.
- POST som huvudmetod för portal bundle och strikt portal/integration readiness.
- Separat optional market-price capability; marknadspris ersätter aldrig bindande quote.
- Säker retry, cache- och logghantering utan hemligheter eller fullständiga känsliga identiteter.
- Produktion behöver endast `GRIDEX_API_KEY`; `GRIDEX_API_BASE_URL` är valfri override eftersom den kanoniska basen finns som default.

## 6. Testresultat

| Kommando | Resultat |
|---|---|
| `npm ci --no-audit --no-fund` | **BLOCKED** – onlineinstallationen fastnade/registrerades med registry-5xx i körmiljön och kunde inte slutföras inom tillåten körning. |
| `npm ci --offline --no-audit --no-fund` | **BLOCKED** – `ENOTCACHED`, bland annat saknades `zod-validation-error-4.0.2.tgz` i lokal cache. |
| `npm run api:generate` | **PASS** – båda deklarationsfilerna genererades för `2026-07-27.1`. |
| `npm run api:check:local` | **PASS** – båda snapshots och genererade typer är lokalt versions-/hashkonsistenta. |
| `npm run api:contract` | **PASS** – Website API contract och runtime contract passerade. |
| `npm test` | **PASS** – 9 testsviter passerade: pricing visibility, portal hardening, elprisetjustnu, launch readiness, public DTO, quote binding, API contract, runtime contract och signup hardening. |
| `node --check scripts/*.mjs tests/*.mjs` | **PASS**. |
| `node --experimental-strip-types --check` på ändrade TypeScript-filer | **PASS**. |
| `npm run api:check` | **BLOCKED** – `getaddrinfo EAI_AGAIN app.gridex.se`. |
| `npm run typecheck` | **INTE VERIFIERAD/FAIL** – dependencyinstallationen saknas; global `tsc` rapporterade därför omfattande saknade Next/React/Supabase/Node-moduler och kan inte användas som giltig projekt-typecheck. En tidigare lokal `RequestInit.next`-typing i ändrad klient korrigerades separat. |
| `npm run lint` | **BLOCKED** – `eslint: not found` eftersom `npm ci` inte kunde slutföras. |
| `npm run build` | **BLOCKED** – `next: not found` eftersom `npm ci` inte kunde slutföras. |
| `npm run test:staging:ops` | **BLOCKED** – ingen `GRIDEX_API_KEY`/godkänd stagingfixture fanns i miljön. |

Inga fel har ignorerats med `|| true` i verifieringen som ligger till grund för PASS-statusarna.

## 7. Kvarvarande blockerare

1. **Dependency registry/installation**
   - Bevis: online `npm ci` kunde inte slutföras; offline gav `ENOTCACHED` för `zod-validation-error-4.0.2.tgz`.
   - Påverkan: full TypeScript-, ESLint- och Next-produktionsbuild är inte verifierad.

2. **DNS från körmiljön till produktion**
   - Bevis: `npm run api:check` gav `getaddrinfo EAI_AGAIN app.gridex.se`.
   - Påverkan: den avslutande live-jämförelsen av snapshots kan inte bekräftas byte-för-byte här.

3. **Staginguppgifter saknas**
   - Bevis: inga `GRIDEX_*`-credentials fanns i miljön.
   - Påverkan: riktiga säkra integrationstester för context, contracts, area, quote, validate, application, legal, portal, POA och supplier switch är inte körda.

4. **Dokumentations-/OpenAPI-motsägelse för portalidentiteter i kundansökan**
   - OpenAPI är strikt och tillåter inte de auth-ID:n som nämns i dokumentationsprosan.
   - Runtime följer OpenAPI och regressionsskyddar att extra fält inte skickas. Backendägaren bör korrigera dokumentationsprosan eller OpenAPI om den avsedda modellen är en annan.

## 8. Lokala synkkommandon

Antagen lokal projektmapp:

```text
/Users/hekmath/Desktop/Projects/gridex-web
```

### Packa upp

```bash
rm -rf /tmp/gridex-web-20260727
mkdir -p /tmp/gridex-web-20260727
unzip -q ~/Downloads/gridex-web-customer-portal-api-2026-07-27.1.zip \
  -d /tmp/gridex-web-20260727
```

### Dry-run utan radering

```bash
rsync -avhn --checksum --itemize-changes \
  --exclude='.env*' --exclude='.git/' --exclude='node_modules/' --exclude='.next/' \
  /tmp/gridex-web-20260727/gridex-web-main/ \
  /Users/hekmath/Desktop/Projects/gridex-web/
```

### Synkronisera

```bash
rsync -avh --checksum --itemize-changes \
  --exclude='.env*' --exclude='.git/' --exclude='node_modules/' --exclude='.next/' \
  /tmp/gridex-web-20260727/gridex-web-main/ \
  /Users/hekmath/Desktop/Projects/gridex-web/
```

Ingen `--delete` används. Radera därefter endast de uttryckligen ersatta versionsbundna filerna:

```bash
cd /Users/hekmath/Desktop/Projects/gridex-web
rm -f COMMANDS_2026-07-25.1.md \
      IMPLEMENTATION_2026-07-25.1.md \
      VERIFICATION_2026-07-25.1.md \
      docs/website-integration-2026-07-25.1.md \
      tests/website-api-2026-07-25-1.contract.test.mjs
```

### Installera och verifiera lokalt

```bash
cd /Users/hekmath/Desktop/Projects/gridex-web
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

### Stagingtest

```bash
mkdir -p .local
cp tests/fixtures/staging-ops-flow.example.json .local/gridex-staging-e2e.json
# Fyll endast med godkända testidentiteter.

GRIDEX_API_KEY='gridex_test_xxxxxxxxx' \
GRIDEX_API_BASE_URL='https://godkand-staging.example/api/v1' \
GRIDEX_STAGING_E2E_FIXTURE="$PWD/.local/gridex-staging-e2e.json" \
npm run test:staging:ops
```

Ingen migration ingår i leveransen.
