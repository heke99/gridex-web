# Gridex Web – implementationsrapport 2026-07-25.1

## Grundorsak

Webbprojektet blandade kontraktet `2026-07-24.2` med den publicerade `2026-07-25.1`-modellen. Den största produktionsblockeraren var att pris- och offertflödet fortfarande härledde readiness från `automation_allowed`. Det fältet finns inte i det aktuella kontraktet, vilket gjorde att en löst adress kunde falla till `409 resolution_not_ready` trots att pris eller quote var redo.

Samtidigt var aktuellt marknadspris hårt kopplat till quote, Mina sidor-readiness använde fel scope-antagande och kundansökan behövde striktare canonical requestbyggning.

## Ny arkitektur

### Tenant och konfiguration

- `GRIDEX_API_KEY` är den enda tenant-API-nyckeln.
- API-basen är fast till `https://app.gridex.se/api/v1`.
- Tenant, company, scopes och readiness hämtas från integration context.
- API-nyckel, tenant-ID eller company-ID exponeras inte till browsern.

### Energy-area resolution

- Responsen normaliseras med capabilities, blockers, retryability, källa och serverversion.
- Pricing och quote styrs endast av `pricing_ready` respektive `quote_ready`.
- Facility lookup, switch creation och switch dispatch hålls separata.
- Den signerade tokenen är V2/`ea4`, har expiry och adressfingerprint och innehåller inget `automation_allowed`.

### Quote och marknadspris

- Quote anropas direkt med `resolution_id`, offer, kundtyp, årsvolym och startdatum.
- `price_area` skickas inte i quote-requesten; OPS resolution är canonical.
- `market-price/current` används endast för information och kan inte blockera en giltig quote.
- Marknadsreferensen används inte som fallback för kundens avtalade fullständiga kWh-pris.
- Quote validation körs omedelbart före submission med dokumenterade assertions.

### Kundansökan

- Referenser ligger top-level och dupliceras inte under `contract`.
- `metering_point_id` skickas under `metering_point`.
- Site-data bevarar verifierat område, nätområde och nätägare när de finns.
- Privat- och företagskund är separata typgrenar.
- Fullmakt kräver `accepted=true`, giltigt scope, signer, metod och publicerad textversion.
- Portal-/auth-ID, `source` och `current_supplier_id` skickas inte som odokumenterade requestfält.

### Kundportal

- Readiness skiljer website checkout, customer portal och complete tenant website.
- Portal bundle använder GET enligt det aktuella kontraktet.
- Bundle-readiness använder de tio faktiska read-scopes som Mina sidor kräver.
- Notisuppdatering skickar explicita ID:n.

### OpenAPI

- Lokala nyckelscheman är uppdaterade till `2026-07-25.1`.
- `api:sync` hämtar de kompletta publika dokumenten atomiskt i normal nätverksmiljö.
- `api:generate` skapar typer och bäddar in source-hash.
- `api:check` verifierar version, genererad hash och drift mot live-specifikationen.

## Databasbedömning

Ingen ny migration behövs för denna klient- och kontraktsrättning. Befintliga migrationer har inte skrivits om eller återanvänts, vilket undviker drift i redan applicerad Supabase-historik.
