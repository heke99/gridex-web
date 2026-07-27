# Gridex Web ↔ Customer Portal API

Senast verifierad kontraktsversion: `2026-07-27.1`.

## Ansvar och konfiguration

OPS är source of truth för tenantidentitet, publicerade avtal, elområdesresolution, aktuellt marknadspris, quote, prisrader, avgifter, moms, juridik, kundansökan och fortsatt leverantörsbytesflöde. Webbprojektet samlar in kunddata, gör server-side API-anrop och presenterar OPS svar utan en konkurrerande prismotor.

Den enda obligatoriska tenantspecifika hemligheten i produktion är:

```env
GRIDEX_API_KEY=
```

Följande är valfri och används bara för en godkänd stagingmiljö eller explicit bas-URL-konfiguration:

```env
GRIDEX_API_BASE_URL=https://app.gridex.se/api/v1
```

API-nyckeln skickas endast server-side som Bearer-token. Tenant och bolag väljs aldrig med `company_id`, tenant-ID eller extra miljövariabler.

## OpenAPI och versionshantering

De incheckade specifikationerna finns i:

```text
docs/openapi/website-integration-v1.json
docs/openapi/customer-portal-v1.json
```

Kommandon:

```bash
npm run api:sync        # hämtar båda live-specifikationerna, validerar gemensam version, skriver atomiskt och genererar typer
npm run api:generate    # genererar typer från incheckade snapshots
npm run api:check       # read-only driftkontroll mot live-specifikationerna
npm run api:check:local # read-only hash-/versionskontroll utan nätverk
```

Runtime skickar `X-Gridex-Accept-Contract-Version: 2026-07-27.1` och verifierar `X-Gridex-Contract-Version` i svar. Fel eller saknad obligatorisk versionsheader behandlas som kontraktsfel i produktion.

## Integrationskontext och readiness

`GET /api/v1/integration/context` verifieras strikt för:

- `contract_version=2026-07-27.1`
- `authoritative_identity=api_key`
- `api_client_reference` och `tenant_reference`
- `Authorization` + `Bearer` + `server_side_only=true`
- exakt obligatorisk tenantvariabel `GRIDEX_API_KEY`
- top-level-placering av ansökningsreferenser
- aktuella OpenAPI-URL:er
- capabilities och scopes

Readiness delas upp i separata funktioner: website sales/checkout, diagnostics, market price, customer portal, supplier switch och production contracts. Ett valfritt market-price-scope får inte blockera ett i övrigt giltigt checkoutflöde.

## Public contracts

`GET /api/v1/website/public-contracts` normaliseras strikt. Nätverksmodellen drivs av genererade OpenAPI-typer och kräver bland annat:

- `offer_reference`
- `contract_type`
- `energy_direction`
- `pricing`
- `production_pricing` för produktionsavtal

Canonical kontraktstyper presenteras som:

- `variable_monthly` → Rörligt månadspris
- `variable_hourly` → Timpris
- `variable_quarterly` → Kvartspris
- `fixed` → Fast pris
- `portfolio` och `mixed` med egna kundvänliga texter

`energy_direction` bevaras från feed till quote, signerad quote, kundansökningsresultat och UI. Ett avtal med `energy_direction=production` utan giltig `production_pricing` blockeras som kontraktsfel. Produktionsavtal får egna texter för ersättning, upplösning, mätpunktsroll och kredit-/självfakturering.

OPS beräkningskomponenter får innehålla dolda avgifter. UI visar endast tillåtna display-/summary-komponenter. Fakturaavgiften 19 kr visas inte separat i kalkylatorn när den är inräknad. Kundtexten `Elnätsavgifter och nätägarens avgifter ingår inte.` behålls.

## Elområde, marknadspris och quote

Elområde löses endast med `POST /api/v1/website/energy-area/resolve`. Checkout använder inte lokal postnummergissning eller lokalt valt SE-område som bindande källa. `resolution_not_ready` och blockerande readiness stoppar quote utan lokal fallback.

`POST /api/v1/website/market-price/current` är en separat informationsfunktion. Den kan visa aktuellt spotpris men är inte ett bindande avtalspris och ersätter aldrig quote.

`POST /api/v1/website/quote` skickar endast OpenAPI-tillåtna fält, inklusive canonical `offer_reference` och `resolution_id`. UI använder OPS totalsumma, prisrader, moms, estimat, varningar och giltighetstid utan lokal omräkning.

Direkt före ansökan körs `POST /api/v1/website/quote/validate`. Runtime kräver att svaret uttryckligen innehåller och matchar både `quote_reference` och `offer_reference`. Saknade referenser fylls aldrig från requesten. Mismatch, utgången, återkallad, förbrukad eller ofullständig quote blockerar submission.

## Customer application

`POST /api/v1/website/customer-applications` använder en stabil `Idempotency-Key` bunden till normaliserad payload. Samma nyckel med ändrad payload blockeras.

`offer_reference`, `quote_reference` och `resolution_id` skickas exakt en gång på top-level. De läggs inte under `contract`. Requesten använder den aktuella OpenAPI-modellen för customer, site, valfri metering point, startuppgifter, juridiska accepteranden och fullmakt.

OpenAPI har `additionalProperties: false`. Därför skickas inte `auth_user_id` eller `customer_portal_user_id` i kundansökan, trots att en mening på dokumentationssidan fortfarande nämner dem. Portalidentitet skickas i portalens egna sync-/bundleflöden. Detta beslut är skyddat med kontraktstest tills dokumentationssidan och OpenAPI är synkroniserade.

### powerOfAttorney

När fullmakt krävs bygger runtime det dokumenterade `powerOfAttorney`-objektet med accepterad status, scopes, signer, signeringsmetod och dokumentversion. Initialt svar bedöms via den publika fullmaktsstatusen, aldrig ett internt ID.

Juridikpaketet hämtas dynamiskt från OPS. Den faktiska nätverkspayloaden för `legal_acceptances` är den fasta OpenAPI-allowlisten `terms`, `privacy_policy`, `withdrawal`, `power_of_attorney` och `price_terms`; okända nycklar skickas inte.

## Kundansökningsresultat

Resultatet läses från den publika `data`-modellen. Mappningen bevarar bland annat kund-/ansöknings-/avtalsnummer, quote-bindning, startdatum, resolution, grid-owner-status, blockers, warnings och `energy_direction`.

`supplier_switch` läses som nästlat objekt med `request_id`, `status`, `can_create_request`, `can_dispatch`, `blockers` och `next_action`.

Fullmakt bedöms från publik status (`signed` eller `missing` i det initiala svaret), aldrig från ett internt `power_of_attorney_id`.

`communication` bevarar strukturerade eventobjekt i `triggered`, `queued`, `sent` och `failed`. Objekt konverteras inte till strängar eller `[object Object]`.

## Mina sidor

### Mina sidor identity rules

Portalidentitet hålls skild från website customer application. Supabase-användaren och stabila kundidentifierare används endast server-side i portalens sync-/bundleflöden.

`POST /api/v1/customer/portal-bundle` är huvudflöde och skickar JSON-body med verifierade kundidentifierare. GET/header-flödet kan endast aktiveras som uttryckligt legacykompatibilitetslager med `GRIDEX_ENABLE_LEGACY_PORTAL_BUNDLE_COMPATIBILITY=true`.

Portaldata cacheas inte publikt och får inte återanvändas mellan tenants eller användare. Supabase `session.user.id` används server-side i portalens identitets-/syncflöde, inte som fritt kund- eller company-ID från browsern.

## Retry, cache och loggning

Begränsad retry används för `429`, `502`, `503`, `504`, timeout och nätverksfel. Retry sker endast för GET/HEAD eller write-anrop med idempotency key, med exponentiell backoff, jitter och respekt för `Retry-After`. `400`, `401`, `403`, `409` och `422` retryas inte blint.

Publika feedanrop kan använda ETag. Kundspecifik portaldata använder `no-store`. Loggar innehåller endpoint, status, kod, request-/correlation-ID, referens, duration och retry count men aldrig API-nyckel, fullständigt personnummer eller full kundpayload.

## Verifiering före deploy

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

Live-E2E kräver en giltig testnyckel och en godkänd staging-fixture:

```bash
GRIDEX_API_KEY='gridex_test_xxxxxxxxx' \
GRIDEX_STAGING_E2E_FIXTURE="$PWD/.local/gridex-staging-e2e.json" \
npm run test:staging:ops
```
