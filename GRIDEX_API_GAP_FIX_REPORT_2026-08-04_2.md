# Gridex Web – API-gapfix 2026-08-04.2

## Resultat

Gridex Web är uppdaterad från OPS-kontrakt `2026-08-04.1` till den publicerade releasen `2026-08-04.2`.
De incheckade OpenAPI-filerna är byteidentiska med release-manifestets SHA-256:

- Website Integration: `8c1bc549b4b874ce66e8b68793cafb16184d1a70214ea980f2b4bed8b2583ec6`
- Customer Portal: `b28e73ee068619e2677d966d3bd4be82a95d926c6e347c60e59df080ff94d95d`

## Brister som fanns

1. **Projektet var låst till föregående kontrakt.**
   Kontraktkonstanter, OpenAPI-snapshots, genererade typer, manifest och dokumentation låg på `2026-08-04.1`.

2. **`price_area_assurance` saknades i runtime-modellen.**
   OPS `2026-08-04.2` kräver ett separat evidensobjekt för om SE1–SE4 får användas för pris/offert. Webbklienten kastade bort objektet och kunde därför inte verifiera att ett prissättningsbeslut var konsekvent.

3. **Blockerade resolutioner hanterades som kontraktsfel.**
   `price_area` är nullable när OPS inte kan lösa området. Webbklienten kastade 502 innan den kunde visa OPS blockerare och `next_required_action`.

4. **Checkout härledde assurance lokalt från confidence.**
   Webbens API använde egna trösklar (`confidence >= 0.95`) och skapade lokala statusvärden. Det är inte längre tillåtet; OPS `price_area_assurance.status` är canonical.

5. **Resolution-status hårdkodades till `resolved`.**
   Ansökans signerade payload kunde säga `resolved` även när den riktiga OPS-statusen var exempelvis `postal_suggested`.

6. **Den signerade resolution-tokenen saknade beslutsunderlaget.**
   Tokenen band inte `resolution_status` eller `price_area_assurance`. Ett senare quote-/submit-steg kunde därför inte bevisa vilket assurance-underlag som hade godkänt priset.

7. **Kundportalen läste deprecated switch-alias först.**
   `customer_status.supplier_switch.can_dispatch` ignorerades och endast `can_start_switch`/camelCase-alias lästes.

8. **Databasens auditmodell använde lokala assurance-värden.**
   Tabellen accepterade `sufficient_for_application` och `indicative_only`, men saknade de canonicala värdena `estimated` och `ambiguous` samt strukturerade assurance-fält.

## Korrigeringar

- Synkat båda OpenAPI-kontrakten, genererade TypeScript-typer och alla kontraktmanifest till `2026-08-04.2`.
- Lagt till strikt runtime-mappning och konsistenskontroll för `PriceAreaAssurance`.
- Tillåter `price_area = null` för riktiga blockerade/unresolved-svar och lämnar beslutet till OPS capabilities/blockers.
- Pris-token uppgraderad från `ea5`/payload v2 till `ea6`/payload v3.
- Tokenen binder verklig `resolution_status` och den prissättningsrelevanta assurance-snapshoten.
- Checkout kräver `capabilities.pricing_ready=true`, matchande prisområde och exakt ett unikt prisområde i assurance.
- Lokala confidence-trösklar borttagna; canonical assurance används i svar, audit och ansökningshash.
- Full assurance-evidens sparas server-side i revisionsspåret, medan browser-svaret bara får den signerade, begränsade snapshoten.
- Kundportalens switchbeslut prioriterar `supplier_switch.can_dispatch`; deprecated alias används endast som fallback.
- Ny migration `20260804190000_price_area_assurance_20260804_2.sql` uppgraderar auditkolumner och constraints.
- Ny regressionstestsvit verifierar hashes, schemas, tokenbindning, nullable blocked resolution, portal dispatch och databasmodellen.

## Identitetsregeln som behållits avsiktligt

Den maskinläsbara `POST /api/v1/customer-portal/sync`-modellen kräver fortfarande `external_customer_id`, `customer_portal_user_id` och `auth_user_id`. Webben ersätter därför aldrig `external_customer_id` med OPS kundnummer. `customer_number` används separat där portal-bundle/auto-link tillåter det. Detta undviker en farlig sammanblandning av tenantens externa identitet och OPS canonicala kundnummer.

## Genomförda verifieringar

Godkänt:

- OpenAPI raw-byte SHA-256 mot release `2026-08-04.2`
- `node scripts/check-openapi-drift.mjs --local-only`
- `node scripts/check-api-compatibility.mjs`
- `node scripts/check-migration-manifest.mjs`
- `tests/openapi-sync-contract.test.mjs`
- `tests/api-contract-regressions-20260804-2.test.mjs`
- äldre API-regressioner för 2026-08-01 och 2026-08-02
- syntaxkontroll av samtliga ändrade `.ts`-filer

Inte körbart i leveransmiljön:

- `npm ci`, full `typecheck`, lint, full testsvit och Next.js-build kunde inte slutföras eftersom sandboxens npm-proxy returnerade 404 för den låsta publika dependency-filen `zod-validation-error@4.0.2`.
- En global TypeScript-kontroll visade endast saknade installerade paket/typer för ändrade filer; inga nya interna typfel kunde identifieras därifrån.

Kör därför de fulla verifieringarna lokalt efter `npm ci`.

## Driftsättningsordning

1. Synka filerna.
2. Kör den nya Supabase-migrationen före webbdeploy.
3. Installera dependencies och kör samtliga verifieringar.
4. Deploya Gridex Web.
5. Testa minst ett fullständigt adressfall och ett `postal_suggested`-fall där pris är redo men EDIFACT fortsatt blockerat.
