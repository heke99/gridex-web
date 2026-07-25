# Gridex Web ↔ Customer Portal API 2026-07-25.1

## Canonical ansvar

Gridex OPS är ensam source of truth för publicerade avtal, elområdesresolution, avtalspris, avgifter, moms, offertens giltighet och kundansökan. Webbprojektet samlar in kunddata, skickar typade requests och visar den canonical responsen. Det finns ingen lokal fallback som räknar om OPS-offerten.

## Konfiguration

Den enda obligatoriska tenantspecifika hemligheten är:

```env
GRIDEX_API_KEY=
```

API-basen är fast:

```text
https://app.gridex.se/api/v1
```

Tenant, company och scopes härleds server-side genom `GET /api/v1/integration/context`. API-nyckeln exponeras aldrig med `NEXT_PUBLIC_` och används aldrig som browser-token eller lokal signeringsnyckel.

## OpenAPI

```bash
npm run api:sync
npm run api:generate
npm run api:check
```

Det sammanslagna kommandot är:

```bash
npm run api:refresh
```

- `api:sync` hämtar de publika website- och customer-portal-specifikationerna.
- `api:generate` skapar incheckade TypeScript-typer utan runtimeberoende.
- `api:check` stoppar drift mellan live-specifikation, lokal kopia och genererade typer.

OpenAPI hämtas aldrig i applikationens runtime.

## Checkoutflöde

1. `integration/context` verifierar version `2026-07-25.1`, API-bas, top-level application references och readiness.
2. `public-contracts` returnerar publicerade produkter. Fastpris filtreras till verifierat elområde.
3. `energy-area/resolve` returnerar `resolution_id`, `price_area`, capabilities, blockers och expiry.
4. Webben utfärdar en kortlivad signerad token bunden till adress, resolution och prisområde.
5. `website/quote` anropas med `resolution_id`, `offer_reference`, kundtyp, årsvolym och startdatum.
6. OPS-offerten låses server-side och presenteras utan lokal prisomräkning.
7. `website/quote/validate` körs omedelbart före kundansökan med tillgängliga assertions.
8. `website/customer-applications` får top-level `quote_reference` och `resolution_id`, canonical customer/site-data och vid behov ett separat `metering_point`-objekt.
9. Kundportalens lokala onboarding sker först efter accepterad OPS-ansökan och ändrar inte den canonical ansökningspayloaden.

## Readinessnivåer

Readiness hålls separerad:

- `website_checkout_ready` – publicerade avtal, resolution, quote, validation, application och juridik.
- `customer_portal_ready` – Mina sidor-endpoints och tillhörande scopes.
- `complete_tenant_website_ready` – både checkout och kundportal.

`pricing_ready` och `quote_ready` styr prissättning. `switch_dispatch_ready` får inte blockera en offert som i övrigt är redo; den används senare i leverantörsbytesflödet.

## Elområdestoken

Tokenformatet är version 2 (`ea4`) och innehåller:

- resolution-ID,
- prisområde,
- nätområde och nätägare när de finns,
- `pricing_ready=true`,
- `quote_ready`,
- kontraktsversion,
- issued/expiry,
- HMAC-fingerprint av adressen.

Det gamla fältet `automation_allowed` används inte.

## Aktuellt marknadspris

`market-price/current` är en separat informationsfunktion. Responsen bevarar vald och tillgängliga resolutioner, intervall, exklusive/inklusive moms, source/freshness och fallbackinformation.

Ett stale eller saknat informationspris får inte blockera en giltig fastprisoffert eller annan OPS-offert. Offertens egen `market_reference` är den referens som gäller för kundkalkylen.

## Customer application

Requesten skickar endast fält som stöds av kontraktet. Bland annat:

- `external_customer_id`,
- `offer_reference`,
- `quote_reference`,
- `resolution_id`,
- `annual_consumption_kwh`,
- `start_date`,
- `customer`,
- `site`,
- valfritt `metering_point`,
- `contract`,
- `legal_acceptances`,
- valfri `powerOfAttorney`.

`source`, `customer_portal_user_id`, `auth_user_id` och `site.current_supplier_id` skickas inte. `quote_reference` dupliceras inte under `contract`.

### Mina sidor identity rules

Portalidentitet skickas i portalens egna server-side headers och portalroutes. Den blandas inte in i website customer application-requesten. Lokal portalprofil får endast länkas till en accepterad ansökan genom stabila OPS-/kundidentifierare.

### powerOfAttorney

När fullmakt krävs måste `accepted=true`, `signerName`, identity number, scope, signeringsmetod och dokumentversion finnas. `acceptedAt` skickas när tidpunkten finns. Submission blockeras om ett obligatoriskt undertecknarnamn saknas; `null` eller tom sträng skickas aldrig som signerName.

## Notiser

`POST /api/v1/customer/notifications/read` skickar exakt angivna `notification_ids`. Den odokumenterade payloaden `{ all: true }` används inte. Ett UI som vill markera flera notiser skickar deras explicita IDs.

## Fel och loggning

Serverloggar innehåller operation, endpoint, status, canonical code, request/correlation ID, retryable och säkra referenser. API-nycklar, personnummer, fullständiga kundpayloads och signerade tokens loggas inte.

Kunden får ett svenskt meddelande och ett kort referens-ID. Råa stack traces, tabellnamn och interna OPS-detaljer exponeras inte.

## Verifiering

```bash
npm run api:generate
npm run api:contract
npm run typecheck
npm run lint
npm test
npm run build
```

Liveflöden kräver en giltig `GRIDEX_API_KEY`. Databasberoende lagring kräver projektets Supabase-miljövariabler.
