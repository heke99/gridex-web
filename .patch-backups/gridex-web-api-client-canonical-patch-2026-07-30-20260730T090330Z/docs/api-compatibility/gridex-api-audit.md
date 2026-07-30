# Gridex Web – API-kompatibilitetsgranskning

Datum: 2026-07-29  
Mål: produktionsmässig kompatibilitet med Gridex OPS Customer Portal / Website API.  
Canonical version i kod: `2026-07-28.2`.

## Resultat

Gridex Web har byggts om för att faila stängt, använda en canonical transport, validera dokumenterade operationer och visa granular readiness. Full produktionskompatibilitet kan inte deklareras eftersom OPS OpenAPI fortfarande motsäger den publika guiden på flera centrala punkter och eftersom live/staging inte kunde köras i leveransmiljön.

## Genomförda korrigeringar

### Canonical kontrakt och driftkontroll

- En canonical versionskonstant används av transport, validatorer, genererade typer och readiness.
- Lokala specs, manifest och typer är internt konsistenta på `.2`.
- `verification-status.json` är avsiktligt `live_sync_verified=false` tills `npm run api:sync` hämtat båda officiella specs och hela kedjan passerat.
- Syncscriptet hämtar båda specs innan filer ersätts, kräver samma version, skriver semantic diff, regenererar typer/manifest och markerar verifiering först efter lyckad kontroll.

### Transport och validering

- Alla OPS-anrop går genom `lib/ops/transport.ts`.
- Redirects blockeras innan credentials kan följas.
- Timeout, abort, retryklassificering, JSON/content-type, safe errors och version header hanteras enhetligt.
- Validatorn kontrollerar operation, request body, query, path-parametrar, dokumenterade headers och success response.
- Odokumenterade endpoints och queryparametrar stoppas.
- Schema- och tenantfel är non-retryable och får inte maskeras av lokal portal fallback.

### Priser

- Current market price använder exact request/response och inga lokala semantiska fallbackvärden.
- Fel resolution, kontraktsversion eller stale pris stoppas.
- BFF bevarar request ID och version och använder private no-store.
- Portfolio parser läser den dokumenterade history-noden, kräver locked settlement och blockerar interna ID:n.

### Kundansökan och juridik

- Serververifierad auth-user binds till båda portal-ID-fälten i application input.
- Buildern kräver båda eller inga, och identiska värden.
- Eftersom OPS schema förbjuder fälten stoppas inloggad ansökan med tydlig contract unsupported-kod i stället för att skapa osynkad data.
- Legal bundle renderas datadrivet och valideras inför submit, men payloaden kan inte göras fullt dynamisk före OPS-kontraktsfix.

### Customer Portal

- Read/write-operationer använder serververifierad sessionidentitet och canonical kundnycklar.
- Granular routes använder endpointsspecifik operationvalidering.
- Opaque invoice-ID används utan lokal matchning mot fakturanummer eller interna providerfält.
- Odokumenterad `/api/v1/customer/switch-status` anropas inte.
- Lokal read-only fallback används endast vid uttryckligen retrybart transportfel; schema-, tenant- och kontraktsfel failar stängt.

### Readiness

Följande separata kontroller finns:

- configuration,
- authentication,
- tenant,
- contract version,
- live OpenAPI sync,
- public contracts,
- energy area,
- quote,
- quote validation,
- customer application,
- legal bundle,
- market price,
- portfolio,
- portal contract/runtime,
- switch status,
- webhook transport/projection,
- database migrations,
- full compatibility.

Full status kräver alla kontroller och noll upstream gaps.

### Webhooks

- Signatur verifieras över `timestamp.rawBody` med timing-safe comparison.
- Event ID, event type, delivery ID, timestamp, envelope och tenant kontrolleras.
- Publication events invalidaterar endast rätt website-cache.
- Dokumenterade domänevents lagras och projekteras idempotent.
- Okända signerade events lagras som `ignored`, inte som affärsmässigt processed.
- Retry, backoff, max attempts och dead-letter finns i SQL + skyddad cron-route.

### Migrationer

- Alla SQL-filer ingår i checksum-manifest.
- Tidigare versionskollision `20260602` är löst genom unik filversion för marknadspris-/fakturaintegrationen.
- Webhookprojektioner har en ny migration.
- Remote Supabase migration history måste kontrolleras innan push eftersom en äldre miljö kan ha registrerat den tidigare kolliderande filversionen.

## Kända blockerare

Se `upstream-contract-gaps.md`. Sammanfattat:

1. portal-ID saknas i customer application schema,
2. legal acceptances är fasta booleanfält,
3. portfolio saknar schema,
4. quote validation är öppen,
5. customer events är öppna,
6. portal sync har fri request och fel response,
7. externa authheaders saknas i portal OpenAPI,
8. portalresurser saknar riktiga schemas,
9. domänwebhookscheman är inte publicerade.

## Miljöblockerare i leveransen

- Paketinstallation kunde inte slutföras i byggsandlådan på grund av registry-404 för en låst transitive dependency.
- Därför kunde full `typecheck`, ESLint och Next production build inte köras med projektets riktiga dependencies.
- Kompletta live JSON-snapshots kunde inte laddas ned till arbetsytan; liveversion och dokumenterade skillnader verifierades via officiella källor, men bundlad snapshot är ärligt markerad som ej live-synkad.
- Ingen staging-API-nyckel, Supabase-databas eller webhooksecret fanns för end-to-endtest.

## Releasebeslut

Webbkorrigeringarna är lämpliga att synka till en utvecklings-/staginggren efter granskning av migration history. Produktion är NO-GO tills strict compatibility, build och stagingchecklistan passerar och OPS-kontraktsluckorna är korrigerade.
