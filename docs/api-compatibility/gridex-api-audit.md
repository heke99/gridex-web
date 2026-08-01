# Gridex Web – API-kompatibilitetsgranskning

Datum: 2026-08-01
Canonical kontraktsversion: `2026-08-01.1`

## Lokalt kontraktsbevis

De incheckade specifikationerna och release-manifestet använder samma version.
Verifierade lokala SHA-256:

- Website: `3a6227270d3b2cca77791334c7f29103afa75dbc9952c8c5dcf8fa75894a0821`
- Customer Portal: `ae6ef4b09137cd2cc8f22b21aed4a1b7730b45f12007e8516ab0a9ec1bebb2a3`

## Rättade kontraktsavvikelser

- Publication webhook använder route-specifik body och kräver inte
  `x-gridex-event-type`.
- `revision_token` lagras och skickas till RPC som `text`.
- `customer/sync` och `customer/move-out` följer stängda requestmodeller.
- Response-schemafel är blockerande utom okända additiva properties.
- Kontrakts-/schema-/tenant-/publiceringsfel kan inte döljas med stale avtal.
- Persistent snapshot verifierar tenant, kontraktsversion, parser, schemahash och
  maximal ålder; stale svar ger inte 304.
- `PublicContract.legal` är ensam immutable juridisk sanningskälla i checkout.
- Required price-option- och quote-fält fabriceras inte från legacyalias eller
  requestdata före validering.
- `is_default` är canonical; `default` är endast ett verifierat deprecated alias.
- Resolverkedjan förväntar inte ett `grid_owner_id` som OpenAPI inte publicerar.
- OPS request-, correlation- och trace-ID sparas separat.

## Felisolering

Ett semantiskt fel i en avtalsrad blockerar den raden. Envelope-, tenant-,
kontraktsversions- och publication-revision-fel blockerar hela operationen.
Nullable legal URL och explicit nullable `legal_bundle_reference` tömmer inte
automatiskt hela feeden.

## Kvarvarande miljöbevis

Denna kodleverans kan inte ensam bevisa:

- faktisk OPS-runtime mot publicerad OpenAPI,
- tenantens publicerade avtalsdata och price-option-snapshots,
- webhookleverans från OPS till driftsatt URL,
- applicering av Supabase-migrationer i länkad produktionsdatabas,
- komplett stagingflöde med riktig API-nyckel och riktiga tenantdata.

Dessa verifieras efter installation med `api:check:live`, migration apply,
staging-E2E och produktionsnära webhooktest.
