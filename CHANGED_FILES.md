# Ändrade och tillagda filer

Baseline: `gridex-web-main(43).zip`  
Ändrade: **39**, tillagda: **18**, borttagna/ersatta: **2**.

| Fil | Status | Ändring |
|---|---|---|
| `README.md` | ÄNDRAD | Dokumenterar canonical API-synk, kompatibilitetsgrindar och verifieringskommandon. |
| `app/(public)/teckna-avtal/page.tsx` | ÄNDRAD | Binder serververifierad portalidentitet atomiskt, tar bort sekundär portal-sync och visar specifikt kontraktsfel. |
| `app/admin/integrations/page.tsx` | ÄNDRAD | Visar granular readiness och tydliga OPS-/miljöblockerare. |
| `app/api/web/customer/events/route.ts` | ÄNDRAD | Hårdar kundendpointen med serveridentitet, strict OPS-operation och private no-store-response. |
| `app/api/web/customer/invoices/[id]/route.ts` | ÄNDRAD | Hårdar kundendpointen med serveridentitet, strict OPS-operation och private no-store-response. |
| `app/api/web/customer/move-out/route.ts` | ÄNDRAD | Hårdar kundendpointen med serveridentitet, strict OPS-operation och private no-store-response. |
| `app/api/web/customer/notifications/read/route.ts` | ÄNDRAD | Hårdar kundendpointen med serveridentitet, strict OPS-operation och private no-store-response. |
| `app/api/web/customer/portal-bundle/route.ts` | ÄNDRAD | Hårdar kundendpointen med serveridentitet, strict OPS-operation och private no-store-response. |
| `app/api/web/customer/profile-update/route.ts` | ÄNDRAD | Hårdar kundendpointen med serveridentitet, strict OPS-operation och private no-store-response. |
| `app/api/web/customer/switch-status/route.ts` | ÄNDRAD | Hårdar kundendpointen med serveridentitet, strict OPS-operation och private no-store-response. |
| `app/api/web/customer/sync/route.ts` | ÄNDRAD | Hårdar kundendpointen med serveridentitet, strict OPS-operation och private no-store-response. |
| `app/api/web/market-price/current/route.ts` | ÄNDRAD | Bevarar strikt market envelope och privat no-store-cache. |
| `app/api/web/portfolio-prices/route.ts` | ÄNDRAD | Använder canonical price_area och bevarar final portfolio-envelope. |
| `docs/openapi/customer-portal-v1.json` | ÄNDRAD | Synkroniserar lokal .2-snapshot/manifest eller verifieringsstatus. |
| `docs/openapi/manifest.json` | ÄNDRAD | Synkroniserar lokal .2-snapshot/manifest eller verifieringsstatus. |
| `docs/openapi/website-integration-v1.json` | ÄNDRAD | Synkroniserar lokal .2-snapshot/manifest eller verifieringsstatus. |
| `docs/website-integration.md` | ÄNDRAD | Canonical drift-, checkout-, portal-, webhook- och readinessdokumentation. |
| `env.example` | ÄNDRAD | Lägger till säkra readiness- och webhook retry-konfigurationer utan tenantfallback. |
| `lib/api/webBoundary.ts` | ÄNDRAD | Inför gemensam privateJsonResponse och säkra no-store-felresponses. |
| `lib/customerPortal/resourceRoute.ts` | ÄNDRAD | Gör alla kundresurser explicit privata och icke-cachebara. |
| `lib/ops/client.ts` | ÄNDRAD | Canonical transport, strikt endpointvalidering, market/portfolio, portalidentitet, idempotens och fail-closed mapping. |
| `lib/ops/contract.ts` | ÄNDRAD | En enda canonical kontraktsversion 2026-07-28.2. |
| `lib/ops/generated/customer-portal-api.d.ts` | ÄNDRAD | Regenererar TypeScript-typer från lokal .2-OpenAPI. |
| `lib/ops/generated/website-api.d.ts` | ÄNDRAD | Regenererar TypeScript-typer från lokal .2-OpenAPI. |
| `lib/ops/readiness.ts` | ÄNDRAD | Granulära produktionsgrindar inklusive upstream-, migration- och stagingbevis. |
| `lib/ops/validators/openapi.ts` | ÄNDRAD | AJV-baserad operation/request/query/path/header/response-validering och gapdetektion. |
| `lib/webhooks/opsWebhook.ts` | ÄNDRAD | Typade aktiva/framåtriktade event, notification mapping och envelopevalidering. |
| `lib/webhooks/publicationChanged.ts` | ÄNDRAD | Verifierar signerade headers/tenant och kör durable publication/domain projection. |
| `package.json` | ÄNDRAD | Lägger till scripts för live/local OpenAPI, strict compatibility, migrationer och leveransverifiering. |
| `scripts/check-openapi-drift.mjs` | ÄNDRAD | Kontrollerar snapshots, version, hashes, typer och valfri live drift. |
| `scripts/generate-openapi-types.mjs` | ÄNDRAD | Genererar deterministiska path/schema/header-typer med ref-resolution. |
| `scripts/sync-openapi.mjs` | ÄNDRAD | Atomisk live-synk med backup, semantic diff, type/manifest regeneration och rollback. |
| `tests/customer-facing-pricing-visibility.test.mjs` | ÄNDRAD | Uppdaterar regressionstest för canonical .2-beteende och fail-closed-krav. |
| `tests/customer-portal-api-hardening.test.mjs` | ÄNDRAD | Uppdaterar regressionstest för canonical .2-beteende och fail-closed-krav. |
| `tests/launch-readiness.test.mjs` | ÄNDRAD | Uppdaterar regressionstest för canonical .2-beteende och fail-closed-krav. |
| `tests/staging-canonical-ops-flow.mjs` | ÄNDRAD | Uppdaterar regressionstest för canonical .2-beteende och fail-closed-krav. |
| `tests/website-api-runtime.contract.test.mjs` | ÄNDRAD | Uppdaterar regressionstest för canonical .2-beteende och fail-closed-krav. |
| `tests/website-api.contract.test.mjs` | ÄNDRAD | Uppdaterar regressionstest för canonical .2-beteende och fail-closed-krav. |
| `vercel.json` | ÄNDRAD | Schemalägger skyddad webhook retry/dead-letter-processor. |
| `CHANGED_FILES.md` | NY | Komplett manifest över ändrade, nya och ersatta filer. |
| `DELIVERY_REPORT_2026-07-29.md` | NY | Slutrapport med status, blockerare, synkkommandon och NO-GO. |
| `VERIFICATION_LOG_2026-07-29.md` | NY | Exakta genomförda och blockerade verifieringar. |
| `app/api/internal/webhooks/retry/route.ts` | NY | Skyddad cron-endpoint för webhook retries. |
| `docs/api-compatibility/endpoint-matrix.md` | NY | Dokumenterar endpointstatus, upstreamkrav eller stagingverifiering. |
| `docs/api-compatibility/gridex-api-audit.md` | NY | Dokumenterar endpointstatus, upstreamkrav eller stagingverifiering. |
| `docs/api-compatibility/staging-verification.md` | NY | Dokumenterar endpointstatus, upstreamkrav eller stagingverifiering. |
| `docs/api-compatibility/upstream-contract-gaps.md` | NY | Dokumenterar endpointstatus, upstreamkrav eller stagingverifiering. |
| `docs/openapi/verification-status.json` | NY | Synkroniserar lokal .2-snapshot/manifest eller verifieringsstatus. |
| `lib/ops/canonicalJson.ts` | NY | Deterministisk JSON-serialisering och SHA-256 för idempotens. |
| `lib/webhooks/retry.ts` | NY | Idempotent retryprocessor med malformed dead-letter. |
| `scripts/check-api-compatibility.mjs` | NY | Failar strict compatibility på kända OPS- och miljöblockerare. |
| `scripts/check-migration-manifest.mjs` | NY | Verifierar versionskollisioner, saknade filer och checksummor. |
| `scripts/write-migration-manifest.mjs` | NY | Genererar deterministiskt migrationsmanifest. |
| `supabase/migrations/20260602010000_market_price_and_invoice_integrations.sql` | NY | Ger tidigare kolliderande migration en unik 14-siffrig version. |
| `supabase/migrations/20260729131000_ops_webhook_domain_projections.sql` | NY | Lägger till durable domänprojektion, retrybudget och dead-letter. |
| `supabase/migrations/manifest.json` | NY | SHA-256-manifest för samtliga migrationer. |
| `tests/api-compatibility-hardening.test.mjs` | NY | Regressioner för transport, priser, portal-ID, no-store, readiness och webhooks. |
| `DELIVERY_REPORT_2026-07-28.1.md` | BORTTAGEN/ERSATT | Äldre NO-GO-rapport ersatt av aktuell leveransrapport. |
| `supabase/migrations/20260602_market_price_and_invoice_integrations.sql` | BORTTAGEN/ERSATT | Ersatt av unik 14-siffrig migration. |
