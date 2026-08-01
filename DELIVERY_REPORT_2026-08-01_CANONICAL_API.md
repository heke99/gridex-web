# Leveransrapport – Gridex Web canonical API-alignment

**Datum:** 2026-08-01
**Målkontrakt:** `2026-08-01.1`
**Omfattning:** public contracts, publication webhook, immutable juridik, quote, Customer Portal-mutationer, cache, spårbarhet, databas och regressionsskydd.

## Levererat resultat

Projektets runtime och databas har riktats mot de incheckade OpenAPI-kontrakten för Website Integration och Customer Portal. Arbetet omfattar bland annat:

1. Publication-webhooken använder canonical body, route-specifika obligatoriska headers och opaque `revision_token` som text.
2. Publiceringsrevisionen lagras beständigt och full avpublicering verifieras mot tenantens lagrade revision, inte mot fritext i `reason`.
3. Customer Portal `sync` och `move-out` använder stängda, canonical request bodies med fält på rätt nivå.
4. Response-schemafel i required canonical data blockerar operationen; okända additiva properties behandlas som kompatibilitetsvarning.
5. Persistent avtalscache verifierar tenant, kontraktsversion, parser, OpenAPI-checksumma och maximal ålder.
6. Schema-, versions-, tenant- och juridikfel kan inte döljas med gammal cache. Stale snapshots ger inte 304.
7. Avtalsvisning och digital teckningsbarhet är separerade. Ett avtal kan visas utan att osäkert checkoutflöde tillåts.
8. Checkout använder det immutable juridiksnapshot som följde med valt avtal; ingen senare juridikhämtning kan byta bundle.
9. Quote-verifieringen kräver canonical referenser, input-echo, komponentlistor, resolver/geodata/market-versioner, energiriktning och områdesprissnapshot.
10. OPS `request_id`, `correlation_id`, `trace_id`, mottagen kontraktsversion och använd lokal kontraktsversion sparas separat.
11. Resolverflödet fabricerar inte längre ett internt `grid_owner_id` som det publika API:t inte returnerar.
12. Testsviten har uppdaterats till `2026-08-01.1`, `is_default` och canonical webhook-/portalpayloads.

## Nya databas-migrationer

- `20260801192000_publication_revision_token_text.sql`
- `20260801200000_public_contract_empty_revision_authorization.sql`
- `20260801203000_website_submission_traceability.sql`

Migrationerna är framåtriktade för redan installerade miljöer. Historiska migrationer har också korrigerats så att nya installationer får samma canonical slutläge.

## Verifiering utförd i leveransmiljön

Godkänt:

- migration manifest: **27 migrationer, inga avvikelser**
- lokal Website OpenAPI-drift: **godkänd, `2026-08-01.1`**
- lokal Customer Portal OpenAPI-drift: **godkänd, `2026-08-01.1`**
- 19 fristående kontrakts-, cache-, checkout-, portal-, pris- och hardeningtester: **godkända**
- TypeScript-start: inga projektdiagnoser hann produceras innan kompilatorn stoppades av saknade installerade type packages

Inte fullständigt körbart i den uppladdade miljön:

- 5 Ajv-baserade runtime/OpenAPI-tester stoppades med `ERR_MODULE_NOT_FOUND` för `ajv/dist/2020.js`.
- `npm run typecheck`, `npm run build` och full `npm run test:launch` kräver en komplett `npm ci`.
- `ajv` och `ajv-formats` finns redan korrekt deklarerade och låsta; felet beror på att zippen saknade installerade dependencies och att leveransmiljön inte kunde nå projektets npm-källa.

Detta ska därför köras i projektets normala miljö före deploy:

```bash
npm ci
npm run api:check:local
npm run db:migrations:check
npm run typecheck
npm run test:launch
npm run build
```

## Produktionsordning

1. Applicera patchen.
2. Installera dependencies och kör hela verifieringskedjan ovan.
3. Kör Supabase-migrationerna före applikationsdeploy.
4. Deploya webbapplikationen.
5. Skicka en canonical signerad publication-webhook och verifiera event, publication state, cacheinvalidiering och revalidering.
6. Kör smoke-test för public contracts, quote, ansökan, portal sync och move-out.

## Viktigt

Källkoden är korrigerad och regressionsskyddad, men denna rapport påstår inte att externa OPS-, Supabase- eller Vercelmiljöer har migrerats eller deployats. Det måste utföras med projektets riktiga credentials och nätverksåtkomst.
