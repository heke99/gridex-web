# Gridex Web – API-kompatibilitetsgranskning

Datum: 2026-07-30  
Canonical kontraktsversion: `2026-07-30.1`

## Resultat

Gridex Web använder OPS som enda affärskälla. Tenant väljs endast av
`GRIDEX_API_KEY`; klienten skickar aldrig `company_id` eller en dold
tenantfallback.

Den här releasen:

- hämtar OPS release-manifest före OpenAPI-filerna,
- verifierar gemensam version och SHA-256 innan snapshots ersätts,
- kontrollerar lokala `$ref`, snapshots, manifest och genererade typer,
- använder dokumentbundna dynamiska juridikacceptanser,
- skickar samma serververifierade auth-user i båda portal-ID-fälten,
- skickar canonical customer events med event reference, subject och data,
- validerar slutna Website- och Customer Portal-operationer,
- har separata `api:check:local`, `api:check:live`, `api:contract`,
  `api:runtime` och `api:compatibility`,
- blockerar full readiness om live sync, migration, staging, två tenants eller
  webhook retry inte har verifierats.

## Verifierat lokalt

- TypeScript
- OpenAPI snapshot/type/manifest parity
- noll maskinella kontraktsgap
- Website API contract- och runtimekontrakt
- Customer Portal hardening
- prissättning, signup och launch-readiness

## Miljöblockerare

- live-manifestet publicerar ännu inte `2026-07-30.1`,
- staging/API-nycklar och databasanslutning saknas i leveransmiljön,
- OPS historiska migration `20260728170000` har en känd checksumkonflikt,
- stagingflöde, två-tenant-isolering och webhook transport/retry/dead-letter
  kan därför inte få verifierad miljöevidens.

`verification-status.json` är avsiktligt `live_sync_verified=false` tills
`npm run api:sync` har hämtat och verifierat den officiella deployen.

## Releasebeslut

Produktion är `NO-GO` tills miljöblockerarna ovan är lösta och
`npm run api:preflight` passerar mot live/staging.
