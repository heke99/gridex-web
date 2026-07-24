# Gridex Web – OPS website contract 2026-07-23.1

## Genomfört

Patchen ersätter det konkurrerande lokala checkoutflödet med ett enda tenantbundet flöde:

```text
OPS public-contracts + ETag/revision
→ OPS energy-area/resolve
→ kortlivad signerad area-token
→ extern marknadsprissnapshot när modellen kräver det
→ OPS canonical quote
→ server-snapshot + sanerad signerad browsertoken
→ OPS quote/validate
→ dynamiska juridikkrav
→ idempotent customer-applications
→ opakt kvittotoken för switch-status
```

Viktigaste ändringarna:

- Central kontraktsversion `2026-07-23.1` och canonical checkout-scopes.
- Tenant verifieras genom API-nyckel och integration context; browsern väljer aldrig tenant.
- OPS elområdesresolver är bindande. Lokal resolver är borttagen ur checkoutflödet.
- Den gamla lokala prismotorn `lib/website/pricingPreview.ts` är borttagen.
- OPS quote och quote/validate används före checkout och igen omedelbart före ansökan.
- Fastpris kräver exakt `area_pricing`-rad för verifierat SE-område. Global konflikt blockerar.
- `calculation_components`, `display_components` och `summary_components` hålls separata.
- `website_visibility` bevaras som enum och saknat värde failar stängt.
- Fakturaavgiften räknas server-side men filtreras från kort, DTO, token och sammanställning.
- Canonical komponenter valideras aktivt; okänd enhet/bas eller saknad faktureringsfrekvens blockerar quote.
- Moms och faktureringsfrekvens stöds per komponent.
- Tim-/kvartskontrakt använder komplett marknadsdygn och märker tydligt när källupplösningen är en schablon.
- Portföljhistorik är separat, allowlistad och används inte som aktuell prognos.
- Juridiska krav renderas dynamiskt med dokument-ID, version, hash och publik URL.
- Checkout-readiness och Mina sidor-readiness är separata.
- `Retry-After` respekteras och rate-limitfel klassificeras separat.
- Switch-status kräver opakt resultattoken; fritt `application_number` accepteras inte från browsern.
- Lokala revisionsspår utökas för resolution, marknadsdata, quote, validering, idempotency och OPS-resultat.
- Gamla 2026-07-22.2-dokument och det motstridiga launchtestet är borttagna.


## Hotfix 2026-07-24.1

- `app/api/v1/website/quote/route.ts` deklarerar nu `dynamic` och `runtime` lokalt och delegerar endast `POST` till canonical quote-routen.
- `app/api/v1/website/pricing/verify/route.ts` deklarerar nu `dynamic` och `runtime` lokalt och delegerar endast `POST` till canonical validate-routen.
- Launchtestet blockerar framtida re-export av Next.js route-konfiguration.
- Vid synk av en äldre arbetskatalog måste `lib/website/pricingPreview.ts` raderas explicit eller rsync köras med kontrollerad borttagning. Filen finns inte i den canonical leveransen.

## Databas

Ny migration:

```text
supabase/migrations/20260724120000_ops_website_contract_20260723_1.sql
```

Den lägger till canonical OPS-referenser, hash/evidence, valideringsstatus, ansökningsnummer och RLS/service-role-skydd.

## OPS-blockerare som patchen failar stängt på

Developer-guiden anger quote, quote/validate och dynamisk juridik, men den tillgängliga kundansökningsbeskrivningen anger inte entydigt var `quote_reference` ska ligga. Därför är följande tom som standard:

```text
GRIDEX_OPS_APPLICATION_QUOTE_REFERENCE_MODE=
```

Sätt endast `top_level` eller `contract` efter att OPS OpenAPI/runtime har bekräftat exakt placering. Live-signup markeras annars som inte redo och skickar inte ett odokumenterat fält.

Den maskinläsbara OpenAPI-filen var inte tillgänglig i projektet eller från den publicerade sökvägen under granskningen. Inga genererade typer har därför fabricerats; `lib/ops/generated/README.md` beskriver den kvarvarande atomiska genereringsåtgärden.

## Verifierat i leveransen

- `npm run test:launch`: samtliga 11 testfiler passerar.
- TypeScript syntaxtranspilering: samtliga 31 ändrade TS/TSX-filer passerar.
- `git diff --check`: passerar.
- Full `npm ci`, ESLint, TypeScript-projektkontroll och Next.js build kunde inte köras i arbetsmiljön eftersom det interna npm-registret returnerade HTTP 503 för Next/Supabase/typpaket. Kör kommandona nedan lokalt efter synk.

## Lokal verifiering efter synk

```bash
npm ci
npm run test:launch
npm run lint
npx tsc --noEmit --pretty false
npm run build
npx supabase db push
```
