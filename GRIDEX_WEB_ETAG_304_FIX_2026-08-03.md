# Gridex Web – ETag/304 public-contract fix

Datum: 2026-08-03
Källa: `gridex-web-main (1)(10).zip`

## Verifierad rotorsak

Gridex OPS och Gridex Web följer samma API-kontrakt `2026-08-02.1`, men transportordningen i Gridex Web var fel.

1. Första anropet till `GET /api/v1/website/public-contracts` returnerar `200`, ett avtal och en ETag.
2. Gridex Web sparar den verifierade feeden i `website_public_contract_snapshots`.
3. Nästa anrop skickar `If-None-Match` med den sparade ETag-värdet.
4. Gridex OPS bygger och validerar den aktuella feeden. När representationen matchar returnerar OPS korrekt `304 Not Modified`.
5. Gridex Web kontrollerade tidigare alla HTTP-statusar `300–399` som otillåtna redirects innan den kontrollerade `allowNotModified && status === 304`.
6. Därför kastades `ops_redirect_blocked` för ett korrekt 304-svar och sidan visade inget avtal trots att ett giltigt snapshot redan fanns.

## Korrigering

`lib/ops/transport.ts` hanterar nu `304` före den generiska redirectspärren:

- `304` + `allowNotModified=true` returneras som ett cacheträffssvar.
- Ett oväntat `304` på en route som inte tillåter det ger den separata felkoden `ops_not_modified_unexpected`.
- Riktiga redirects `301`, `302`, `303`, `307` och `308` blockeras fortsatt.
- Redirectens `Location` loggas som säker diagnostik, men Authorization följs aldrig eftersom `redirect: 'manual'` behålls.

## Databasstatus

Ingen ny migration behövs för denna fix. Följande är redan verifierat:

- `ops_publication_state` finns.
- `website_public_contract_snapshots` finns.
- snapshot-RPC:n finns.
- website revision är `55`.
- ett snapshot finns med `accepted_count=1`, `blocked_count=0` och `feed_state=contracts_present`.

Migrationsmanifestet i den uppladdade zippen var däremot stale och hänvisade till borttagna shared-migrationer. Manifestet och cache-durability-testet har synkroniserats med de portabla migrationerna:

- `20260803102000_public_contract_snapshot_portable_schema.sql`
- `20260803102100_public_contract_snapshot_portable_rpc.sql`

## Ändrade filer

- `lib/ops/transport.ts`
- `package.json`
- `supabase/migrations/manifest.json`
- `tests/api-compatibility-hardening.test.mjs`
- `tests/ops-transport-not-modified.test.mjs`
- `tests/public-contract-cache-durability.test.mjs`

## Verifieringar som passerade

- `npm run test:ops-transport`
- `node tests/api-compatibility-hardening.test.mjs`
- `node tests/public-contract-cache-durability.test.mjs`
- `npm run db:migrations:check`

Det nya runtime-testet verifierar både att:

- ett korrekt `304` accepteras och kan återanvända snapshoten,
- ett riktigt `307` fortfarande ger `ops_redirect_blocked`.

## Efter deploy

Efter att patchen deployats ska nya requests inte längre logga:

```text
code: ops_redirect_blocked
status: 502
```

för ETag-cacheträffar. Tenantens `/api/web/contracts` ska kunna returnera snapshoten med revision `55`, och avtalet ska inte försvinna mellan anrop.
