# Gridex Web – implementation 2026-07-27.1

## Korrigerad kontraktsdrift

Projektet var bundet till `2026-07-25.1` och innehöll runtime- och testantaganden som inte följde det publicerade `2026-07-27.1`-kontraktet. OpenAPI-snapshots, genererade typer, versionsheaders, filnamn och kontraktstester har flyttats till aktuell version.

## Implementerat

- Reproducerbar tvåspecifikationssync med gemensam versionskontroll, atomisk skrivning, typgenerering och lokal hashkontroll.
- Read-only `api:check` för CI; workflow ändrar inte längre snapshots.
- Genererade website-typer används av runtime för quote, quote validation, customer application, legal acceptances, energy direction, production pricing, supplier switch och communications.
- Strikt public-contract-parser som avvisar okända kontraktstyper/energiriktningar och produktionsavtal utan komplett `production_pricing`.
- Kundvänliga etiketter för månads-, tim-, kvarts- och fastpris samt produktionsspecifik presentation.
- `energy_direction` och `production_pricing` bevaras genom feed, domänmodell, signerad quote, state och UI.
- Quote validation kräver uttryckliga matchande quote- och offer-referenser; requestvärden används inte som fallback.
- Customer application skickar canonical top-level-referenser och OpenAPI-allowlistad legal payload med stabil payloadbunden idempotens.
- Kundansökningsresultat använder aktuell nästlad `supplier_switch`, publik fullmaktsstatus och strukturerade communication events. Borttagna interna responsefält styr inte längre checkout/UI.
- Portal bundle använder POST som huvudflöde; GET finns bara bakom explicit legacyflagga.
- Integrationskontext verifieras för API-key-identitet, authkonfiguration, version, OpenAPI-URL:er, miljökrav och capabilities.
- Market price, diagnostics, portal, supplier switch och production readiness hålls separata från kärncheckout.
- Begränsad säker retry med backoff, jitter, `Retry-After` och idempotenskrav.
- API-basen kan anges med `GRIDEX_API_BASE_URL`; endast `GRIDEX_API_KEY` är obligatorisk tenanthemlighet i canonical produktion.
- UI visar inte intern OPS-identitet, interna prisplans-ID:n eller separat inräknad fakturaavgift.

## Dokumentationskonflikt

Produktionssidans löptext säger att `auth_user_id` och `customer_portal_user_id` ska skickas i kundansökan. Den maskinläsbara OpenAPI-modellen saknar båda fälten och har `additionalProperties: false`. Runtime följer därför OpenAPI och skickar portalidentitet endast i portalens sync-/bundleflöden. Ett kontraktstest låser detta tills Gridex-dokumentationen korrigeras.

## Databas

Ingen lokal schemaändring krävdes. Inga Supabase-migrationer har lagts till eller ändrats.
