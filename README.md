# Gridex Web

Next.js-webb, checkout, kundportal och adminyta för Gridex. Supabase används för
autentisering, RLS-skyddade lokala read models och immutable checkout-bevis.
Gridex OPS är source of truth för tenant, avtal, quote, juridik, ansökan och
kundportal.

Canonical kontraktsversion är `2026-08-02.1`. Den incheckade leveransen markerar live-synk som **overifierad** tills `npm run api:sync` har hämtat båda officiella specifikationerna och regenererat alla artefakter.

## Lokal start

```bash
cp env.example .env.local
npm ci
npm run api:check:local
npm run dev
```

Öppna `http://localhost:3000`.

## Gridex tenant integration

Den tenantspecifika integrationen kräver endast en server-side API-nyckel:

```env
GRIDEX_API_KEY=
```

`GET /api/v1/integration/context` härleder och verifierar tenant, API-klient,
kanal, scopes, capabilities och `contract_version`. Ingen separat tenant- eller
companyvariabel får användas som genväg.

OPS-routes anropas endast server-side. Webbens egna routes är separerade:

- `/api/checkout/*` – checkout-BFF
- `/api/web/*` – publik och autentiserad webb-BFF
- `/webhooks/contracts.publication.changed` – canonical signerad webhook

Projektet exponerar inga egna `/api/v1/*`-facader.

## Gridex Web infrastructure

Följande är webbapplikationens infrastruktur, inte tenantidentitet:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

GRIDEX_OPS_API_URL=https://app.gridex.se/api/v1
GRIDEX_OPS_STAGING_ALLOWED_ORIGINS=
GRIDEX_WEBSITE_STATE_SIGNING_SECRET=
GRIDEX_WEBSITE_STATE_SIGNING_KID=
GRIDEX_WEBSITE_STATE_SIGNING_PREVIOUS_SECRET=
GRIDEX_WEBSITE_STATE_SIGNING_PREVIOUS_KID=
GRIDEX_WEBHOOK_SIGNING_SECRET=
GRIDEX_WEBHOOK_TOLERANCE_SECONDS=300
WEBHOOK_RETRY_CRON_SECRET=
GRIDEX_WEBHOOK_PROJECTIONS_READY=false
GRIDEX_DATABASE_MIGRATIONS_READY=false

CRON_SECRET=
PII_HASH_PEPPER=
PII_ENCRYPTION_KEY=
```

`GRIDEX_WEBSITE_STATE_SIGNING_SECRET` och webhookhemligheten ska vara separata,
slumpmässiga värden om minst 32 byte. State-nyckeln stödjer aktiv och föregående
`kid` under rotation. I produktion får `GRIDEX_OPS_API_URL` endast vara
`https://app.gridex.se/api/v1`; andra HTTPS-origins måste uttryckligen
allowlistas för staging.

## Canonical dataflöde

Checkout:

```text
integration/context
→ public-contracts (fresh före CTA, inklusive immutable legal snapshot)
→ energy-area/resolve
→ quote
→ quote/validate
→ customer-applications
→ application status
```

Browsern får signerad state, men OPS `quote_reference`, `resolution_id`,
`offer_reference`, juridikversioner och kommersiell snapshot bevaras
oförändrade. Svenska affärsdatum hanteras i `Europe/Stockholm`.

### Canonical offertgiltighet

`valid_until` är obligatoriskt i OPS quote och quote-validation för kontrakt
`2026-08-02.1`. Webben signerar exakt samma värde i offerttoken, vägrar skapa
en token utan ett framtida giltighetsdatum och kräver en ny offert när tiden har
passerat. OPS quote-validation är dessutom auktoritativ för revocation,
teckningsbarhet, konsumtion och övriga bindningar.

Teknisk cache och checkout-handoff får ha kortare TTL, men de får aldrig förlänga
OPS-offertens giltighet. Kundtyp, startläge, startdatum, resolution, prisalternativ,
områdespris, fakturametod, komponentval och site count binds innan quote skapas.

## OpenAPI och deploy-preflight

Snapshots och godkända hashvärden finns i `docs/openapi/`. `api:check` är
read-only, jämför version och hash mot produktion och visar semantiska ändringar
innan den blockerar. `verification-status.json` måste samtidigt visa
`live_sync_verified=true`; en lokal versionsändring räknas aldrig som livebevis.

```bash
npm run api:generate
npm run api:check:local
npm run api:check
npm run db:migrations:check
npm run api:compatibility:known-gaps
npm run api:preflight
```

`npm run api:sync` är en avsiktlig utvecklaråtgärd: den hämtar båda
specifikationerna, regenererar typer och skriver ett nytt hashmanifest som ska
granskas i diff före merge. GitHub-workflowen kör preflight vid pull request,
manuellt och schemalagt.

## Databas

Kör migrationerna i `supabase/migrations` i ordning. Public-contract-feeden har en tenantbunden last-known-good-snapshot i `website_public_contract_snapshots`. OPS hämtas alltid med `no-store`; en tom kandidat får endast ersätta senast verifierade snapshot när svaret uttryckligen har `feed_state=canonical_empty` och ett komplett `empty_feed_authorization` vars revision matchar feedens publication revision, canonical source är `canonical_public_contract_delivery_readiness_v` och alla required bevisfält är giltiga. Partiella, schemafelaktiga eller tillfälligt tomma svar får aldrig skriva över last-known-good. Webhooken invaliderar dessutom feedens cachetagg och alla publika avtalsytor.

De senaste migrationerna:

- lagrar tenantbunden last-known-good public-contract-snapshot och skyddar den atomiskt mot falska tomma/all-blockerade svar
- gör publication revision numerisk och tillämpar webhookevent transaktionellt
- lagrar `revision_token` och deduplicerar event/delivery
- bevarar immutable juridikbevis per ansökan
- lägger tenant-, OPS-ID-, revision- och synkmetadata på portalprojektioner
- projekterar signerade domänevent idempotent och kör retry/dead-letter via `/api/internal/webhooks/retry`
- återställer canonical quote-expiry: nya snapshots kräver OPS `valid_until`,
  utgångna offerter kan inte återaktiveras och den gamla non-expiring-backfillen tas bort

## Verifiering före deploy

```bash
npm ci
npm run api:sync
npm run api:check:live
npm run db:migrations:check
npm run typecheck
npm run lint
npm run test:launch
npm run api:compatibility
npm run build
npm run api:preflight
```

Staging-E2E kräver en godkänd testnyckel och en git-ignorerad fixture:

```bash
GRIDEX_API_KEY='gridex_test_xxxxxxxxx' \
GRIDEX_STAGING_E2E_FIXTURE="$PWD/.local/gridex-staging-e2e.json" \
npm run test:staging:ops
```

Mer integrationsdetaljer och kända upstreammotsägelser finns i
`docs/website-integration.md`.
