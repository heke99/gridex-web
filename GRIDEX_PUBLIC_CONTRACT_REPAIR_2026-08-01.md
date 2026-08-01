# Gridex Web – Public contracts-reparation 2026-08-01

## Leveransstatus

Den produktionskritiska public-contracts-pipelinen är reparerad i den befintliga arkitekturen. Patchen separerar OpenAPI-struktur från affärssemantik, accepterar rörliga avtal med `area_prices: []`, behåller blockerande kontroll av verkliga kontraktsfel och gör additiva fält till kompatibilitetsdiagnostik i stället för en generell runtime-kill switch.

Kontraktsversionen i kod, lokala OpenAPI-snapshots, genererade typer, AJV-källa och lokalt manifest är uppdaterad till `2026-08-01.1`.

**Viktig verifieringsgräns:** körmiljön kunde inte DNS-resolva `app.gridex.se` och den interna npm-spegeln saknade ett låst paket. Därför kunde live OpenAPI-filerna inte ersättas byte-for-byte och full `npm ci`/lint/typecheck/test/build kunde inte bevisas här. `docs/openapi/verification-status.json` är avsiktligt `live_sync_verified: false`. Kör `npm run openapi:sync` i en nätverksansluten projektmiljö före deployment; sync-kommandot verifierar OPS release-manifest och SHA-256 innan det atomiskt skriver filer och genererar om artefakter.

## Rotorsak

1. `price_options[].area_prices` krävdes ovillkorligen vara icke-tom. Det blockerade giltiga `variable_monthly`, `variable_hourly` och `variable_quarterly`-alternativ.
2. Varje AJV-fel behandlades som blockerande. `additionalProperties` och aliasövergången `default` → `is_default` tömde därför kundfeeden.
3. OpenAPI/AJV och genererade typer låg kvar på `2026-07-30.3` medan OPS publicerade `2026-08-01.1`.
4. AJV använde inte uttryckligen Draft 2020-12 trots OpenAPI 3.1.
5. Cacheidentiteten saknade parser-version och lokal schema-checksumma, vilket kunde behålla ett tidigare all-blocked resultat.
6. Feedstatus prioriterade blockerade rader framför synliga rader och kunde beskriva en delvis giltig feed felaktigt.
7. Quote-routen förutsatte att ett valt prisalternativ alltid hade ett områdespris, vilket inte gäller rörliga avtal.

## Implementerad `area_prices`-policy

Canonical helper finns i `lib/website/publicContractPolicy.ts`:

```ts
requiresPublishedAreaPrices(option)
```

Den returnerar `true` endast när `price_type === "fixed"` eller `contract_type === "fixed"`.

Det innebär:

- rörliga månads-, tim- och kvartsavtal accepterar `area_prices: []`,
- portfölj/mix och andra quote-resolverade modeller kräver inte ett publicerat statiskt områdespris,
- fastpris kräver minst ett canonical områdespris och täckning för annonserade elområden,
- val av rörligt prisalternativ returnerar `area_price: null` utan att göra alternativet otillgängligt,
- quote-routen skickar `area_price_reference: null` för modeller där OPS quote-flöde ska lösa marknadspriset.

Samma helper används i parservalidering, semantisk täckningskontroll och prisalternativsval.

## Valideringspipeline

Implementerad ordning:

```text
fetch
→ säker JSON-/feedkontroll
→ kompatibilitetsnormalisering
→ strukturell OpenAPI/AJV-validering
→ semantisk affärsvalidering
→ severity-klassificering
→ kontraktsvis include/block
→ website-readiness
→ browser-safe DTO
→ render/API-svar
```

Severity-modellen är:

- `fatal`: identitet/tenant/kanal eller förbjudna interna fält,
- `blocking`: kritiska required/type/enum/format-fel, oanvändbar juridik, prislogik eller avsaknad av giltigt prisalternativ,
- `warning`: presentations- eller icke-kritiska avvikelser,
- `compatibility`: additiva optional-fält och dokumenterade aliasövergångar.

`additionalProperties` är normalt `compatibility`. Interna identifierare som `company_id`, `tenant_id`, `price_plan_id`, `price_plan_version_id` och `legal_bundle_id` förblir `fatal`.

## Kompatibilitetsnormalisering

Före semantisk affärslogik normaliseras dokumenterade alias utan att kommersiella värden hittas på:

- `is_default ?? default ?? false`,
- canonical och deprecated default-fält speglas när ett av dem finns,
- `price_type` och `contract_type` speglas under dokumenterad övergång,
- `area_prices` lämnas som publicerad canonical array; inga fasta priser skapas,
- juridiska bundle-/modul-ID:n måste komma från OPS och skapas aldrig lokalt.

## OpenAPI och AJV

- Version uppdaterad till `2026-08-01.1`.
- `ContractPriceOption` innehåller canonical `is_default`, deprecated `default`, kommersiella canonical-fält och `area_prices` utan `minItems`.
- Juridiktypen innehåller `legal_bundle_version_id` på bundle och varje modul.
- Typer genereras från exakt samma lokala OpenAPI-filer som AJV läser.
- AJV använder `ajv/dist/2020.js` för OpenAPI 3.1/JSON Schema 2020-12.
- AJV-fel bevarar `instancePath`, `keyword`, `message` och `params` för korrekt klassificering.
- `openapi:sync`, `openapi:generate` och `openapi:check` finns som deterministiska scripts.
- Live-sync hämtar release-manifest, verifierar versionsparitet, URL, content-type och SHA-256, skriver atomiskt, genererar typer och återställer tidigare filer vid fel.

Publicerade SHA-256-värden i release-manifestet:

- website: `e15a170a38b0cecadb2b815c1387c2336f02da7a69c96af418acca3999952f5f`
- customer portal: `72fe14799c971f34e172782972ae510c9817cc6e4b981fb5ec8a71326f49e628`

Lokala snapshots i denna leverans är internt konsekventa men ännu inte live-byteverifierade. `npm run openapi:sync` ska därför köras och committad diff granskas före produktionsdeploy.

## Cache, ETag och parseridentitet

Cache key innehåller nu:

- tenant/API-origin-identitet,
- website/public-contracts,
- contract version,
- `CONTRACT_PARSER_VERSION`,
- lokal OpenAPI SHA-256,
- kundtyp.

Ett all-blocked parserresultat sparas inte som den nya långlivade cachen. En tidigare giltig cache behålls om en respons med samma publiceringsrevision plötsligt parseras till noll synliga avtal. ETag, `304`, publiceringsrevision och stale-cache är kvar.

## `/api/web/contracts`

Endpointen returnerar browser-safe data och metadata för:

- state,
- contract version,
- publication revision,
- source/stale,
- parser version,
- schema checksum,
- lokalt request/correlation ID,
- upstream status och ETag,
- upstream/visible/blocked/warning/compatibility-räknare.

401, 403, saknad API-nyckel, ogiltig bas-URL, timeout, tenantspärr och kontraktsversionsfel klassificeras separat. API-nyckel, Authorization-header, intern tenantidentitet och råa AJV-paths skickas inte till kunden.

## Observability

Strukturerad loggning innehåller contract version, parser version, schemahash, publiceringsrevision, upstream status/ETag/request-ID, antal upstream/synliga/blockerade avtal samt warning-/compatibility-räknare.

Följande metrics emitteras via projektets nuvarande strukturerade loggkanal:

- `gridex_web_contracts_upstream_count`
- `gridex_web_contracts_visible_count`
- `gridex_web_contracts_blocked_count`
- `gridex_web_contracts_schema_warning_count`
- `gridex_web_contracts_compatibility_issue_count`
- `gridex_web_contracts_feed_empty_count`

## Tester

Tillagda/utökade tester täcker:

- rörlig månad/timme/kvartal med `area_prices: []`,
- portfölj/mix utan publicerat områdespris,
- fastpris med rätt SE-täckning,
- fastpris med tom eller saknad annonserad områdestäckning,
- canonical `is_default` och deprecated `default`,
- additivt `new_optional_metadata` som compatibility utan blockering,
- saknat kritiskt required-fält som blockering,
- kommersiellt number-fält med fel typ som blockering,
- juridikens bundle-ID och modul-ID,
- verklig OPS-lik fixture genom parse → normalize → semantic validation → feed → endpoint payload,
- kontraktsvis feed-isolering,
- OpenAPI-version, manifest, genererade typer och checksummefel,
- signup-adapterns juridikpropagering.

## Verifieringsresultat i denna körmiljö

| Kontroll | Resultat | Kommentar |
|---|---:|---|
| Fokuserad TypeScript-kontroll av ändrad kontraktsmotor | PASS | Körd med temporära externa modulstubs; inga fel i ändrade kärnfiler. |
| Syntaxkontroll av samtliga ändrade `.ts`-filer | PASS | Node type stripping/check. |
| Canonical `area_prices`-testmatris | PASS | Variable + fixed cases. |
| Issue/severity-policy | PASS | Additivt, required, type och interna fält. |
| Signup-adapter | PASS | Canonical pris + juridik. |
| OpenAPI sync-kontraktstest | PASS | Version, lokal hash, typer, schemafält och invalid SHA. |
| Python Draft 2020-12 fixturevalidering | PASS | Basfixture 0 fel; additivt fält ger `additionalProperties`; saknad identitet ger `required`. |
| `npm run openapi:generate` | PASS | Båda typfilerna genererade för `2026-08-01.1`. |
| `npm run api:check:local` | PASS | Lokala specs, manifest och typer är konsekventa. |
| `npm ci` | BLOCKERAD AV MILJÖ | Intern registry returnerade 404 för `zod-validation-error@4.0.2`. |
| `npm run lint` | EJ BEVISAD | `eslint` saknades eftersom installationen blockerades. |
| Full `npm run typecheck` | EJ BEVISAD | Saknade installerade Next/React/Node/Supabase-typer; fokuserad kontroll är grön. |
| Full `npm test` | DELVIS PASS | Alla tester före AJV-pipelinet passerade; därefter saknades installerat `ajv`. |
| `npm run build` | EJ BEVISAD | `next` saknades eftersom installationen blockerades. |
| `npm run openapi:sync` | BLOCKERAD AV MILJÖ | DNS `EAI_AGAIN app.gridex.se`; inga filer skrevs. |
| `npm run openapi:check` live | BLOCKERAD AV MILJÖ | Samma DNS-blockering. |
| Live/staging `/api/web/contracts` | EJ KÖRD | Ingen fungerande DNS från exekveringsmiljön och ingen staging-URL/API-nyckel tillgänglig. |

## Ändrade filer

- `app/(public)/teckna-avtal/page.tsx`
- `app/api/checkout/quote/route.ts`
- `docs/openapi/customer-portal-v1.json`
- `docs/openapi/manifest.json`
- `docs/openapi/release-manifest.json`
- `docs/openapi/verification-status.json`
- `docs/openapi/website-integration-v1.json`
- `lib/ops/client.ts`
- `lib/ops/contract.ts`
- `lib/ops/generated/customer-portal-api.d.ts`
- `lib/ops/generated/website-api.d.ts`
- `lib/ops/validators/openapi.ts`
- `lib/website/publicContractContract.ts`
- `lib/website/publicContractFeed.ts`
- `lib/website/publicContractsEndpoint.ts`
- `lib/website/publicDtos.ts`
- `lib/website/signupContractOption.ts`
- `package.json`
- `tests/gridex-runtime-hardening.test.mjs`
- `tests/public-contract-canonical-area-prices.test.mjs`
- `tests/public-contract-feed-isolation.test.mjs`
- `tests/signup-contract-option-adapter.test.mjs`

## Nya filer

- `lib/website/publicContractObservability.ts`
- `lib/website/publicContractPolicy.ts`
- `lib/website/publicContractsPayload.ts`
- `tests/fixtures/public-contracts.ops-verified-variable.json`
- `tests/openapi-sync-contract.test.mjs`
- `tests/public-contract-issue-policy.test.mjs`
- `tests/public-contract-runtime-compatibility.test.mjs`
- `GRIDEX_PUBLIC_CONTRACT_REPAIR_2026-08-01.md`

## Kvarvarande kompatibilitetsrisker

1. Kör live OpenAPI-sync för byte-exakta snapshots och commit-genererade diffar.
2. Kör full installation, lint, typecheck, tests och Next build i projektets normala registry-/nätverksmiljö.
3. Verifiera live/staging att ett publicerat `variable_monthly`-avtal returneras i `data`, att `blocked_contracts` är tom och att avtalskortet renderas.
4. Bevaka compatibility-metricen. Nya additiva fält ska inte påverka kunder men ska leda till planerad schema-sync.
5. Deployment ska ha server-side `GRIDEX_API_KEY` och `GRIDEX_OPS_API_URL=https://app.gridex.se/api/v1`; ingen nyckel får ligga i `NEXT_PUBLIC_*`.

## Applicering och slutverifiering

```bash
PATCH_ZIP="/Users/hekmath/Downloads/gridex-web-public-contract-repair-2026-08-01.zip"
PROJECT="/Users/hekmath/Desktop/Projects/gridex-web"
TMP_DIR="$(mktemp -d)"
unzip -q "$PATCH_ZIP" -d "$TMP_DIR"
rsync -av --checksum "$TMP_DIR/" "$PROJECT/"
rm -rf "$TMP_DIR"

cd "$PROJECT"
npm run openapi:sync
npm ci
npm run openapi:generate
npm run openapi:check
npm run lint
npm run typecheck
npm test
npm run build
```

Efter stagingdeploy:

```bash
curl -i -sS   "https://STAGING_GRIDEX_WEB/api/web/contracts?customer_type=private"   -H "Accept: application/json"
```

Godkänt resultat kräver minst ett giltigt rörligt avtal i `data`, `area_prices: []`, `blocked_contracts: []`, korrekt `meta.contract_version: "2026-08-01.1"` och ett renderat avtalskort på kundsidan.
