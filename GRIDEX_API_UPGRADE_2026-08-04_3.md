# Gridex Web – uppgradering till API 2026-08-04.3

Datum: 2026-08-05

## Resultat

Gridex Web är uppgraderad från kontraktsversion `2026-08-04.2` till den aktuella Gridex API-releasen `2026-08-04.3`.

Lokala OpenAPI-filer är byte-exakt synkroniserade mot release-manifestet:

- Website Integration API: `cb646455421d1c56bd94ce11c970ad73560d88b72a9c9940c405ac754c0a6595`
- Customer Portal API: `16187883ad4df64ac8e67b9352753d2492369978961c3c84cef0eadb8739d922`
- Release/build commit: `6bcd5bd939dc5bb6c33cffee00840aa0d190ccf8`
- Minsta tenant-integration: `2026-08-04.3`

## Implementerade ändringar

1. Uppdaterade båda kanoniska OpenAPI-filerna till `2026-08-04.3`.
2. Uppdaterade release-manifest, lokalt manifest, verifieringsstatus och genererade TypeScript-definitioner.
3. Uppdaterade centrala kontraktskonstanter, immutable OpenAPI-URL:er och SHA-256-låsningar.
4. Låste quote-flödet mot det nya idempotenskontraktet:
   - obligatorisk `Idempotency-Key`;
   - deterministisk nyckel baserad på `quote_attempt_id` och kanonisk payload-hash;
   - verifiering av `Idempotency-Replayed` på samtliga quote-svar;
   - verifiering av `503` när idempotenslagret är otillgängligt;
   - verifiering av tenant-/API-klient-/route-isolerad idempotens.
5. Verifierade att kundansökan kräver giltiga och identiska `customer_portal_user_id` och `auth_user_id` innan anropet skickas.
6. Regenererade API-typer för Website Integration API och Customer Portal API.
7. Ersatte regressionssviten för `2026-08-04.2` med en ny svit för `2026-08-04.3` och uppdaterade `package.json`.
8. Uppdaterade README och integrationsdokumentation till aktuell version och aktuella checksummor.

## Verifiering

Följande kontroller passerade:

- lokal OpenAPI-driftkontroll för båda kontrakten;
- migrationsmanifest: 33 filer;
- API-kompatibilitet: 0 upstream-kontraktsgap och 0 miljöblockerare;
- OpenAPI sync contract;
- API-regressioner för `2026-08-04.3`;
- API compatibility hardening;
- tidigare API-regressioner för `2026-08-02`;
- automatic checkout policy;
- checkout post-commit durability;
- application-number-kontrakt;
- public-contract cache durability;
- public-contract failure visibility;
- public-contract feed fail-closed/isolation;
- signup quote binding/pricing regression;
- inga aktiva referenser till den gamla `2026-08-04.2`-testfilen eller centrala kontraktskonstanten.

Full verifieringslogg finns i `GRIDEX_API_VERIFICATION_2026-08-04_3.log`.

## Begränsning i verifieringsmiljön

En komplett `npm ci`, TypeScript-build och Next.js-build kunde inte slutföras i den här körmiljön. Miljön använder ett internt npm-registry som inte levererade projektets beroenden och timeoutade även mot npmjs.org. Den utökade launch-sviten passerade fram till första testet som importerade det ej installerade paketet `ajv`; felet var `ERR_MODULE_NOT_FOUND`, inte ett kontrakts- eller applikationsfel.

Kör därför följande lokalt efter synkronisering:

```bash
npm ci
npm run typecheck
npm run test:launch
npm run build
```

## Synkronisering på macOS

Efter att zip-filen har packats upp:

```bash
rsync -av \
  --exclude='.git/' \
  --exclude='.env*' \
  --exclude='node_modules/' \
  --exclude='.next/' \
  /tmp/gridex-api-2026-08-04.3/gridex-web-main/ \
  /Users/hekmath/Projects/gridex-web/

rm -f /Users/hekmath/Projects/gridex-web/tests/api-contract-regressions-20260804-2.test.mjs

cd /Users/hekmath/Projects/gridex-web
npm ci
npm run typecheck
npm run test:launch
npm run build
```
