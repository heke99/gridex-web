# Gridex Web public-contract end-to-end fix — 2026-08-03

## Slutsats

OPS-databasen och OPS API-routen är inte längre den aktiva felkällan. Live-spåret visar upprepade `200` från `/api/v1/website/public-contracts`, `result_count=1`, `rejected_contracts=0` och `publication_revision=55` för Gridex-webbens aktiva API-klient.

Det aktuella avtalet `Gridex Månad` är canonicalt synligt i OPS med `visible=true` och utan blockers.

Felet låg därefter i Gridex-webbens mottagarsida:

1. Den durabla last-known-good-databasen saknades helt live.
2. Gridex-webb körde ett andra, striktare semantiskt policyblock efter att OPS redan serializerat och OpenAPI-validerat DTO:t.
3. Den äldre snapshot-RPC:n hade fel SQL/JSON-null-semantik för ett normalt `contracts_present`-snapshot.
4. Felinformationen i Gridex-webbens logg tog inte med `OpsError.details`, vilket dolde de exakta blockerande parserreglerna.

## Live-Supabase som redan är korrigerad

Följande två migrationseffekter är redan applicerade på projekt `piidsfebjqjmnepdpnas`:

- `20260803100040 public_contract_snapshot_shared_schema`
- `20260803100130 public_contract_snapshot_shared_rpc`

Live-ledgern innehåller exakt dessa versioner.

Skapade objekt:

- `public.ops_publication_state`
- `public.website_public_contract_snapshots`
- `public.store_website_public_contract_snapshot(...)`

Website-revisionen är seedad till `55` för tenant:

`tenant_60de87cf9c7e4de9936cf3a47f4080dd7a7c`

Säkerhet verifierad:

- RLS aktiverad på båda tabellerna.
- `anon` saknar SELECT.
- `authenticated` saknar SELECT.
- endast `service_role` får läsa/skriva tabellerna.
- endast `service_role` får exekvera snapshot-RPC:n.

Migrationerna ska inte köras manuellt igen på samma liveprojekt. De checkas in för att repositoryts migrationshistorik ska matcha live-ledgern och för rena miljöer.

## Kodändring i Gridex-webb

### Canonical mottagarpolicy

`lib/ops/client.ts` behåller fail-closed för:

- fatal semantik, såsom saknad eller ogiltig `offer_reference`;
- fel kanal;
- blockerande OpenAPI-/strukturfel;
- kompatibilitetsnormalisering som misslyckas;
- DTO:er som inte kan normaliseras till Gridex-webbens runtime-modell.

När DTO:t däremot:

- kan normaliseras,
- saknar blockerande strukturella OpenAPI-fel, och
- saknar blockerande kompatibilitetsnormaliseringsfel,

får ett duplicerat Gridex-webb-semantikfel inte längre släcka hela tenant-feeden. Det registreras som en varning. OPS serializer och OPS canonical readiness förblir källan till sanning för publiceringsintegriteten.

### Observability

`lib/website/publicContractFeed.ts` loggar nu även säkra `OpsError.details`. Vid ett framtida fel syns bland annat exakta blockeringskoder, paths, upstream request ID och correlation ID i Vercel-loggen.

## Tester

Tillagda/uppdaterade regressioner verifierar att:

- semantisk policy-drift på ett i övrigt canonicalt DTO inte tar ned feeden;
- verkliga OpenAPI-typfel fortsatt blockeras;
- saknad canonical referens fortsatt blockeras;
- shared snapshot-schema och RPC finns i migrationskedjan;
- JSON-null för `empty_feed_authorization` hanteras korrekt;
- `anon` och `authenticated` inte beviljas snapshotåtkomst;
- migrationsmanifestet har 31 unika migrationer utan versionskollision.

Verifierat i leveransmiljön:

- `node tests/public-contract-cache-durability.test.mjs` — passerar.
- `node scripts/check-migration-manifest.mjs` — passerar, 31 filer.
- syntaxkontroll för ändrade TypeScript-/testfiler — passerar.

Full npm-svit kunde inte köras i leveranscontainern eftersom dess interna npm-registry saknar `ajv-formats` och tidigare även `zod-validation-error@4.0.2`. Kör hela sviten lokalt där projektets dependencies redan fungerar.

## Verifiering efter deploy

Efter att ändringarna har deployats ska:

- Gridex-webb acceptera OPS-avtalet;
- en rad med revision `55` skapas i `website_public_contract_snapshots`;
- tenantens `/elavtal` visa `Gridex Månad`;
- ett tillfälligt OPS-fel falla tillbaka till durable last-known-good i stället för att avtalet försvinner;
- `/api/web/contracts` returnera en feed med minst ett avtal och `feed_loaded_with_contracts`.
