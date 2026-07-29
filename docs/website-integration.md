# Gridex Web ↔ Gridex OPS

Canonical kontraktsversion: `2026-07-28.2`.

`docs/openapi/verification-status.json` är den separata sanningskällan för om de
incheckade snapshotsen verkligen har hämtats från live-API och regenererats.
Den här leveransen lämnar flaggan `false`; kör `npm run api:sync` i en
nätverksansluten miljö före release.

## Kontraktsgräns

OpenAPI-snapshots:

```text
docs/openapi/website-integration-v1.json
docs/openapi/customer-portal-v1.json
docs/openapi/manifest.json
docs/openapi/verification-status.json
```

`GRIDEX_API_CONTRACT_VERSION` i `lib/ops/contract.ts` är enda importerbara
versionskällan. `scripts/sync-openapi.mjs` hämtar först båda livefilerna,
kräver samma version, skriver en semantisk diff, regenererar typer/manifest och
sätter inte `live_sync_verified=true` förrän alla lokala kontroller passerat.

Alla utgående OPS-anrop går genom `lib/ops/transport.ts`. Transporten:

- skickar API-nyckeln endast server-side och endast till allowlistad HTTPS-origin,
- inspekterar och avvisar redirects utan att följa dem,
- använder timeout/abort,
- retryar endast GET/HEAD eller skrivningar med `Idempotency-Key`,
- returnerar strukturerade, kundsäkra fel,
- validerar dokumenterade requests, queryparametrar och responses mot OpenAPI,
- blockerar ett anrop om operationen inte finns i någon incheckad specifikation.

## Checkout

```text
integration/context
→ public-contracts
→ energy-area/resolve
→ quote
→ legal-bundle
→ quote/validate
→ customer-applications
→ customer application status
→ website switch-status
```

`offer_reference`, `quote_reference`, `resolution_id`, juridikversioner och
OPS-prissnapshot bevaras. Marknadspris är endast en separat referens och används
inte för att lokalt bygga kundens avtalspris.

När användaren är autentiserad hämtas Supabase `session.user.id` server-side och
förbereds som både `customer_portal_user_id` och `auth_user_id`. Nuvarande OPS
OpenAPI saknar dock fälten och förbjuder extra properties. Submission stoppas
därför fail-closed med
`ops_customer_application_portal_identity_contract_unsupported`; en separat
portal-sync används inte längre för att låtsas att nyteckningen var atomisk.
Kundansökan skickar samtidigt den signerade fullmakten tillsammans med en full metering-point-modell när avtalet och anläggningsuppgifterna kräver det.

## Juridik

Legal bundle renderas dynamiskt och hämtas på nytt före submit. Webben bevarar
requirement code, dokument-ID, version, hash, bundle-version och faktisk
acceptanstid i sitt immutable bevis.

Nuvarande OPS requestmodell kan endast uttrycka fem fasta booleanfält. Ett nytt
obligatoriskt krav blockeras därför i stället för att ignoreras. OPS måste införa
en dokumentbunden `legal_acceptances[]`-modell innan full kompatibilitet kan bli
grön.

## Market price och portfolio

`fetchOpsCurrentMarketPrice()` validerar hela `CurrentMarketPriceRequest` och
`CurrentMarketPriceResponse`. Inga lokala standardvärden skapas för
`reference_type`, resolutioner, freshness eller include-flaggor.

Portfoliohistorik läses endast från:

```text
data.method
data.historical_final_prices
data.final_billing_rule = locked_settlement_only
request_id
contract_schema_version
```

Historiken presenteras aldrig som aktuellt pris. OPS OpenAPI saknar fortfarande
ett stängt maskinschema för detta svar, vilket är en upstreamblockerare.

## Kundportal

Portaloperationer använder samma verifierade Supabase-ID i båda identitetsheaders:

```text
x-gridex-customer-portal-user-id
x-gridex-auth-user-id
```

Övriga kundidentifierare skickas endast när de kommer från den canonicala
profilkopplingen. Alla portalrequests/responses valideras endpoint för endpoint.
Pagination/envelopemetadata bevaras.

Den odokumenterade `/api/v1/customer/switch-status` anropas inte. Checkout använder
`/api/v1/website/switch-status`; den autentiserade portalen använder
portal-bundle och events.

`POST /api/v1/customer-portal/sync` är fortfarande blockerad av OPS-specifikationen:
requesten är öppen, identitetsheaders saknas och 200-responsen pekar på
`CustomerInvoice[]`.

## Webhooks

Canonical publik endpoint är fortsatt:

```text
POST /webhooks/contracts.publication.changed
```

Den kan ta emot de signerade eventtyper som OPS skickar till samma callback.
Rå body, timestamp, HMAC-SHA256, event-ID, delivery-ID, tenant och payloadhash
verifieras före affärsprojektion.

Följande statusar skiljs åt i databasen:

```text
received
verified
processed
ignored
retryable_failure
permanent_failure
```

Aktiva domänevent projekteras med `apply_ops_domain_event`. Retry sker genom:

```text
GET|POST /api/internal/webhooks/retry
Authorization: Bearer <WEBHOOK_RETRY_CRON_SECRET eller CRON_SECRET>
```

Efter maxförsök sätts `permanent_failure` och `dead_letter_at`. Okända men korrekt
signerade typer lagras som `ignored`, inte som affärsmässigt behandlade.

## Readiness

Adminytan skiljer bland annat mellan:

- konfiguration/autentisering/tenant,
- kontraktsversion och live-OpenAPI-synk,
- public contracts, resolver, quote och quote validation,
- customer application och legal bundle,
- market price och portfolio,
- Customer Portal-kontrakt respektive runtime,
- webhooktransport respektive projektion,
- applicerade migrationer,
- full API-kompatibilitet.

`GRIDEX_WEBHOOK_PROJECTIONS_READY=true` och
`GRIDEX_DATABASE_MIGRATIONS_READY=true` är bevisflaggor och får endast sättas
efter stagingverifiering. De kan inte ensamma göra full readiness grön.

## Verifieringskommandon

```bash
npm run api:sync
npm run api:check
npm run api:contract
npm run db:migrations:check
npm run api:compatibility
npm run typecheck
npm run lint
npm test
npm run build
```

Kända upstreamblockerare finns i
`docs/api-compatibility/upstream-contract-gaps.md` och endpointstatus i
`docs/api-compatibility/endpoint-matrix.md`.
