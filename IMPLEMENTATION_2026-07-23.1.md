# Gridex Web – implementation 2026-07-23.1

## Mål

Gridex Web ska använda ett enda tenantbundet checkoutflöde:

1. API-nyckeln verifieras mot `integration/context` och opak `tenant_reference`.
2. Publicerade avtal hämtas med tenant- och kanalbunden ETag/revision.
3. Adressen löses genom OPS `website/energy-area/resolve`.
4. Rörliga avtal får en revisionsbar extern marknadsprissnapshot.
5. OPS skapar canonical quote.
6. Browsern får endast en sanerad och lokalt signerad quote.
7. OPS validerar quote omedelbart före kundansökan.
8. Juridiska krav renderas dynamiskt från avtalet.
9. Kundansökan använder dokumenterad quote-bindning och idempotency.
10. Ett opakt kvittotoken används för separat switch-status; ansökningsnumret hålls server-side.

## Säkerhetsgränser

- API-nyckel och fullständiga pris-/juridiksnapshots är server-only.
- Fastpris och `area_pricing` lämnar inte servern före verifierat område.
- `invoice_fee` räknas, men filtreras från kort, sammanställning och browsertoken.
- Samtliga canonical `calculation_components` valideras före quote; okända obligatoriska enheter, procentbaser, saknad faktureringsfrekvens och juridiska acceptance types blockerar flödet.
- Live-teckning blockeras om OPS inte uttryckligen har konfigurerat placeringen av `quote_reference`.
- Switch-status kan inte hämtas med ett fritt ansökningsnummer utan kräver det opaka resultattokenet från kvittot.
- Portföljhistorik returneras genom en strikt allowlistad publik DTO; råa OPS-rader passerar aldrig browsergränsen.

## Kända OPS-kontraktsblockerare

Developer-guiden 2026-07-23.1 listar quote-, validate- och energy-area-routes samt canonical `area_pricing`, men kundansökningsexemplet visar fortfarande inte var `quote_reference` ska placeras. Därför måste `GRIDEX_OPS_APPLICATION_QUOTE_REFERENCE_MODE` sättas till `top_level` eller `contract` först när OPS OpenAPI/runtime bekräftar placeringen.

Developer-guiden beskriver dynamisk juridik, men dokumenterar inte ett top-level-fält `legal_acceptances` i kundansökan. Standardläget är därför `consents_only`.

## Verifiering

```bash
npm ci
npm run test:launch
npm run lint
npm run build
```

Databasmigration:

```bash
npx supabase db push
```
