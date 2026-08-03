# Gridex Web – API-kompatibilitetsgranskning

Datum: 2026-08-02
Canonical kontraktsversion: `2026-08-02.1`

## Kontraktsbevis

Officiell release `2026-08-02.1` publicerades med följande förväntade rå-byte-hashar:

- Website: `971f0f4e00330971c92a37046f54fa7d27416a5b64932c7d37d7892b79691e7a`
- Customer Portal: `921daeb0c1bdfe4f4dc50cbbc3990defce8556bfe7cff0a88a0f4d96f4d6b779`

Leveransmiljön kunde verifiera release-metadata och semantik men inte lagra de
exakta live-bytesen. Därför är `live_sync_verified=false` tills mottagaren kör
`npm run api:sync`; deploy ska blockeras dessförinnan.

## Rättade kontraktsavvikelser

- Publication webhook använder route-specifik body och kräver inte
  `x-gridex-event-type`.
- `revision_token` lagras och skickas till RPC som `text`.
- `customer/sync` och `customer/move-out` följer stängda requestmodeller.
- Response-schemafel är blockerande utom okända additiva properties.
- Schemafelaktiga eller partiella feeds ersätter aldrig last-known-good; tenant-/authfel får aldrig döljas med fallback.
- Persistent snapshot verifierar tenant, kontraktsversion, parser, schemahash, maximal ålder och canonical-empty-bevis; stale svar ger inte 304.
- `PublicContract.legal` är ensam immutable juridisk sanningskälla i checkout.
- Required price-option- och quote-fält fabriceras inte från legacyalias eller
  requestdata före validering.
- `is_default` är canonical; `default` är endast ett verifierat deprecated alias.
- Resolverkedjan förväntar inte ett `grid_owner_id` som OpenAPI inte publicerar.
- OPS request-, correlation- och trace-ID sparas separat.
- Quote och quote-validation kräver ett framtida `valid_until`; exakt värde binds i token och utgångna offerter kräver omprisning.
- Portalens två identitetshuvuden och två sync-ID:n binds till samma verifierade auth-UUID medan kundnummer hålls separat.

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
