# Gridex Web – canonical runtime hardening

Datum: 2026-07-30

## Leveransomfattning

Den bifogade leveransen innehöll endast `gridex-web`. Därför har faktiska kodändringar genomförts i Gridex Web. Inga Gridex OPS-filer eller databasmigrationer har skapats utan ett bifogat `gridex-ops-platform`-repo.

Den lokalt incheckade OpenAPI-generationen är `2026-07-30.1`. Det verifierade live-manifestet är `2026-07-30.2`. Snapshotfilerna har inte skrivits om manuellt eller försetts med påhittade checksummor. De ska synkroniseras med `npm run api:sync` i en nätverksansluten release-miljö.

## Genomförda mål

- En central, typad Gridex-konfiguration har skapats.
- `GRIDEX_API_KEY` är canonical website-nyckel.
- `GRIDEX_WEBSITE_API_KEY` stöds endast som tydligt markerad deprecated fallback.
- `GRIDEX_OPS_API_KEY` används inte som website-nyckel.
- Alla direkta läsningar av Gridex API-/state-hemligheter har flyttats till den centrala konfigurationsmodulen.
- Produktionsorigin är låst till canonical OPS-origin.
- Preview/development kan använda en uttryckligen allowlistad staging-origin.
- Transporten retryar endast idempotenta `GET`/`HEAD`-anrop.
- Exakt OpenAPI-/versionsmatchning är inte längre en generell runtime-kill switch.
- OpenAPI-avvikelser loggas som kontraktsdrift; endpointens defensiva parser avgör om nödvändig semantik finns.
- `public-contracts` parsas per avtal. En felaktig post blockerar inte övriga poster.
- Startsida, avtalssida, teckningsflöde och browser-API använder samma canonical readiness-feed.
- Browser-API:t skiljer tom feed, partiell feed och feedfel.
- Browser-API:t returnerar blockerarkoder per avtal.
- `tenant_reference` har tagits bort från publik browserrespons.
- Browser-DTO är allowlistad och inkluderar endast externa `price_option_reference` och valbara `component_reference` när OPS faktiskt publicerar dem.
- Datum utan klockslag använder inkluderande kalenderdagssemantik i `Europe/Stockholm`.
- Ogiltiga date-only-värden, exempelvis `2026-02-30`, normaliseras inte längre tyst.
- En lyckad men tom feed ersätter inte en tidigare fungerande feed om OPS inte skickar en ny publication revision.
- Cache key innehåller tenantbunden serverkontext, endpoint, kundtyp och lokal kontraktsgeneration.
- En skyddad admin-healthcheck har lagts till med `force_refresh`.
- Säker build-/deploymentmetadata kan visas utan att exponera nycklar eller hemligheter.
- Lokala OpenAPI-snapshots är markerade som inte längre live-verifierade.
- Nya invarianttester har lagts till för runtime-hardening.

## Grundorsaksrapport

### Gridex Web-fel

#### 1. Exakt kontraktsversion stoppade fungerande runtime

- Filer: `lib/ops/transport.ts`, `lib/ops/client.ts`
- Grundorsak: versionsheader och OpenAPI-response validator användes som hård runtime-spärr.
- Konsekvens: live `2026-07-30.2` kunde avvisas av en klient med lokalt `2026-07-30.1`, även vid kompatibla additiva ändringar.
- Lösning: versionsdrift loggas; endpoint-specifik defensiv parsing avgör om obligatorisk semantik finns. CI-synk förblir strikt.

#### 2. Ett felaktigt avtal kunde slå ut hela feeden

- Fil: `lib/ops/client.ts`
- Funktion: public-contracts parsing.
- Grundorsak: hela operationsresponsen validerades som en odelbar enhet före normalisering.
- Konsekvens: en enskild ofullständig post kunde göra alla avtal otillgängliga.
- Lösning: response envelope måste fortfarande ha `data[]`, men varje post parsas isolerat och placeras i `blocked_contracts` med stabila reason codes om den inte kan användas.

#### 3. Browser-API och webbsidor använde olika filter

- Filer: `lib/website/publicContractFeed.ts`, `lib/website/publicContractsEndpoint.ts`
- Grundorsak: webbsidor använde readiness-filter medan `/api/web/contracts` returnerade rå snapshot.
- Konsekvens: samma avtal kunde synas i ett gränssnitt och saknas i ett annat.
- Lösning: browser-API:t använder nu samma `loadWebsitePublicContractFeed` som publika sidor.

#### 4. Publik respons läckte tenantmetadata

- Fil: `lib/website/publicContractsEndpoint.ts`
- Grundorsak: `tenant_reference` returnerades i publik metadata trots att tenant verifieras server-side.
- Konsekvens: onödig intern integrationsmetadata exponerades.
- Lösning: fältet är borttaget. Tenantbindning verifieras fortfarande server-side.

#### 5. Date-only behandlades som ett godtyckligt JavaScript-timestamp

- Filer: `lib/website/businessDate.ts`, `lib/website/publicContractDisplay.ts`
- Grundorsak: rå `Date.parse()` användes på `valid_from` och `valid_to`.
- Konsekvens: avtal kunde döljas för tidigt och ogiltiga kalenderdatum kunde normaliseras.
- Lösning: date-only jämförs som Stockholms kalenderdag; `valid_to` är inkluderande hela dagen.

#### 6. Miljökonfiguration var utspridd

- Filer: `lib/ops/config.ts`, `lib/ops/transport.ts`, `lib/website/serverTokenSecret.ts`, `app/admin/integrations/page.tsx`
- Grundorsak: API- och signeringsvariabler lästes på flera platser.
- Konsekvens: olika runtime-delar kunde tolka samma deployment olika.
- Lösning: central konfigurationsmodul med säker status, canonical key, deprecated fallback, originvalidering och signing-keyring.

#### 7. POST-anrop kunde retryas bara för att de hade idempotency key

- Fil: `lib/ops/transport.ts`
- Grundorsak: retrybarhet inkluderade alla metoder med `Idempotency-Key`.
- Konsekvens: fler write-försök än transportpolicyn tillät.
- Lösning: automatisk transportretry görs endast för `GET` och `HEAD`.

#### 8. Tom feed kunde skriva över en fungerande cache utan ny publiceringsrevision

- Fil: `lib/ops/client.ts`
- Grundorsak: en tom `200`-respons ersatte alltid tidigare snapshot.
- Konsekvens: tillfälligt felaktig tom feed kunde ta bort alla avtal för kunder.
- Lösning: tidigare fungerande snapshot används som markerad stale cache när en tom feed saknar en ny publication revision.

#### 9. Felstatusar kollapsade till ett generiskt 502-fel

- Fil: `lib/website/publicContractsEndpoint.ts`
- Grundorsak: alla undantag mappades till samma status och text.
- Konsekvens: konfigurationsfel, authfel, tenantstatus och timeout gick inte att skilja.
- Lösning: säker publik felmodell med state, kod, kundtext och supportreferens.

#### 10. Skyddad integrationshealthcheck saknades

- Fil: `app/api/internal/integrations/gridex/health/route.ts`
- Grundorsak: ingen samlad server-side kontroll av konfiguration, context, scopes, feed, blockers, cache och deployment fanns.
- Konsekvens: gammal deployment och faktisk blockerare var svår att skilja åt.
- Lösning: autentiserad healthcheck med `force_refresh=true`, utan secretvärden, stack traces eller authheaders.

### API-kontraktsfel som ligger kvar i OPS

1. Live release är `2026-07-30.2`, medan repots lokala snapshot är `2026-07-30.1`.
2. Current live Website OpenAPI deklarerar quote-fälten `price_option_reference` och `selected_component_references`, men `PublicContract` publicerar fortfarande inte ett komplett canonical schema för `price_options` och valbara komponenter.
3. Gridex Web kan nu ta emot och bevara dessa optional runtimefält defensivt, men kan inte skapa eller gissa dem.
4. Full API-kompatibilitet är därför fortsatt blockerad tills Gridex OPS databas, runtime, diagnostics och OpenAPI publicerar samma externa referenser.

### Databasfel

Inga databasmigrationer har skapats. Databasen och OPS-publiceringsgrafen kunde inte inspekteras eftersom `gridex-ops-platform` inte bifogades.

### Deployment-/env-fel som inte kan verifieras från repot

Följande kräver faktisk Vercel-/Git-/OPS-åtkomst:

- vilket Vercel-projekt som äger `gridex.se`
- production branch och root directory
- aktuell commit och deployment ID
- om production faktiskt läser `GRIDEX_API_KEY`
- API-nyckelns tenant, status och scopes
- verkliga public-contracts och diagnostics
- full resolution → quote → legal → validate → application smoke test

## Ändrade och tillagda filer

### Tillagda

- `lib/ops/config.ts`
- `lib/ops/contractCompatibility.ts`
- `app/api/internal/integrations/gridex/health/route.ts`
- `tests/gridex-runtime-hardening.test.mjs`
- `GRIDEX_WEB_CANONICAL_RUNTIME_HARDENING_2026-07-30.md`

### Ändrade

- `app/admin/integrations/page.tsx`
- `docs/openapi/verification-status.json`
- `env.example`
- `lib/ops/client.ts`
- `lib/ops/transport.ts`
- `lib/website/businessDate.ts`
- `lib/website/publicContractDisplay.ts`
- `lib/website/publicContractFeed.ts`
- `lib/website/publicContractsEndpoint.ts`
- `lib/website/publicDtos.ts`
- `lib/website/serverTokenSecret.ts`
- `package.json`
- `tests/website-api.contract.test.mjs`

### Borttagna legacy-filer

Inga filer har raderats i denna patch.

## Databasmigrationer

Inga nya migrationer ingår i Gridex Web-patchen.

Det befintliga migrationsmanifestet verifierades lokalt: 22 migrationsfiler, integritetskontroll godkänd.

## Environment matrix

### Gridex Web – local

Obligatoriskt för hela checkoutflödet:

- `GRIDEX_API_KEY` – server-side tenantbunden website API key.
- `GRIDEX_WEBSITE_STATE_SIGNING_SECRET` – minst 32 slumpmässiga byte.

Rekommenderat/valfritt:

- `GRIDEX_API_BASE_URL` – utelämna för canonical production URL.
- `GRIDEX_OPS_STAGING_ALLOWED_ORIGINS` – krävs om local använder annan godkänd origin.
- `GRIDEX_WEBSITE_STATE_SIGNING_KID` – aktivt key ID.
- `GRIDEX_OPS_TIMEOUT_MS` – request timeout.

### Gridex Web – preview

Obligatoriskt:

- `GRIDEX_API_KEY`
- `GRIDEX_WEBSITE_STATE_SIGNING_SECRET`

Vid staging-OPS:

- `GRIDEX_API_BASE_URL`
- `GRIDEX_OPS_STAGING_ALLOWED_ORIGINS`

Nyckelrotation:

- `GRIDEX_WEBSITE_STATE_SIGNING_KID`
- `GRIDEX_WEBSITE_STATE_SIGNING_PREVIOUS_SECRET`
- `GRIDEX_WEBSITE_STATE_SIGNING_PREVIOUS_KID`

### Gridex Web – production

Obligatoriskt:

- `GRIDEX_API_KEY`
- `GRIDEX_WEBSITE_STATE_SIGNING_SECRET`

Canonical/rekommenderat:

- `GRIDEX_API_BASE_URL=https://app.gridex.se/api/v1`
- `GRIDEX_WEBSITE_STATE_SIGNING_KID`
- `GRIDEX_BUILD_TIMESTAMP`

Production accepterar endast canonical OPS-origin.

### Deprecated övergång

- `GRIDEX_WEBSITE_API_KEY` kan användas temporärt endast om `GRIDEX_API_KEY` saknas.
- Konfigurera inte båda långsiktigt.
- `GRIDEX_OPS_API_KEY` ska inte användas av Gridex Web.
- Inga `GRIDEX_EXPECTED_TENANT_REFERENCE`, `GRIDEX_COMPANY_ID` eller `GRIDEX_TENANT_ID` krävs.

### Gridex OPS – local/production

Kan inte fastställas från den bifogade leveransen. OPS-repot måste analyseras separat innan en korrekt env-matrix eller migrationlista kan levereras.

## Verifieringsresultat

### Godkänt och faktiskt kört

- `npm run api:check:local` – godkänd. Båda lokala OpenAPI-snapshots och genererade typer är internt konsistenta på `2026-07-30.1`.
- `npm run db:migrations:check` – godkänd. 22 migrationsfiler.
- `npm run api:compatibility:known-gaps` – godkänd med redovisad OPS-lucka `public_contract_price_options_not_published`.
- `npm run test:api-hardening` – godkänd.
- `npm run test:gridex-runtime-hardening` – godkänd.
- TypeScript `transpileModule` syntaxkontroll för samtliga ändrade TS/TSX-filer – godkänd.

### Förväntat blockerad

- `npm run api:compatibility` – blockerad av `public_contract_price_options_not_published`. Detta är korrekt fail-closed CI-beteende.

### Kunde inte verifieras i denna körmiljö

- `npm ci` – den tillgängliga interna npm-spegeln returnerade 404 för `zod-validation-error@4.0.2`.
- `npm run typecheck` – kan inte ge ett giltigt projektresultat utan installerade Next/React/Node-typer. Det globala `tsc`-försöket rapporterade därför saknade moduler/typer.
- `npm run lint` – dependencies saknas.
- `npm test` – full suite kräver dependencies.
- `npm run build` – Next dependency saknas.
- `npm run api:sync` – DNS/network från sandbox kunde inte nå `app.gridex.se`.
- `supabase db lint` – ingen länkad Supabase-miljö/CLI-session.
- production smoke test – ingen server-side API key eller deploymentåtkomst användes.

## Kommandon efter applicerad patch

```bash
cd /Users/hekmath/Desktop/Projects/gridex-web

npm ci
npm run api:sync
npm run api:check:local
npm run api:compatibility
npm run db:migrations:check
npm run typecheck
npm run lint
npm test
rm -rf .next
npm run build
```

`npm run api:compatibility` ska inte ignoreras. Om det fortfarande rapporterar `public_contract_price_options_not_published` måste OPS-repot repareras och publiceras först.

## Skyddad healthcheck

Som behörig admin:

```text
GET /api/internal/integrations/gridex/health
GET /api/internal/integrations/gridex/health?force_refresh=true
```

Endpointen returnerar inte API-nyckel, nyckelprefix, authheader, signeringshemlighet eller stack trace.

## Definition of done – återstående steg

1. Bifoga och reparera `gridex-ops-platform`.
2. Publicera canonical `price_options` och selectable components i OPS databas/runtime/OpenAPI/diagnostics.
3. Kör `npm run api:sync` så Gridex Web uppdateras till live release.
4. Säkerställ att strict compatibility går igenom.
5. Kör komplett install, typecheck, lint, tests och production build.
6. Verifiera Vercel project/branch/root/domain/commit/env.
7. Kör integration context, public-contracts och diagnostics med riktig website key.
8. Kör full staging smoke: contracts → resolution → option/components → quote → legal → validate → application.
9. Skapa inte en verklig produktionsteckning utan avsedd testtenant/testkund.
