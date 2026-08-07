# REMAINING_RISKS

## Resolved repo/deployment risks

Följande är stängda i verifierat scope:

- Lokal/live OPS OpenAPI-drift.
- Same-version `.2` hashdrift i klienten: klienten är resynkad mot aktuell live-hash.
- 5 287-raders OPS client-monolit.
- Begränsad runtime version-observation.
- Next.js lint blocker.
- Runtime type-importfel från modulsplitten.
- Föråldrade source-text regressionstester.
- Avsaknad av full CI quality gate.
- Avsaknad av live OpenAPI-gate vid main-push.
- Vercel commit/deployment-status för `d1bfd11e…`: `Vercel – gridex-web = success`.

## Kvarvarande risker

### R-001 – Upstream immutable release-policy
Status: OPEN UPSTREAM

OPS ändrade `website-integration-v1.json` inom samma `2026-08-05.2` från hash `d0bdc356…` till `e8ddc6b8…`. Gridex Web blockerar nu sådan drift på varje `main`-push, men korrekt långsiktig lösning är att OPS aldrig muterar en redan publicerad release utan versionsbump.

### R-002 – Live tenant E2E
Status: UNVERIFIED

En full checkout med verklig API credential/tenant, quote, application, customer number, contract och portal sync kördes inte med produktionscredentials i denna GitHub-remediation.

### R-003 – Produktionstelemetri och last
Status: UNVERIFIED

Repo-/deployment-gates bevisar build och integrationstatus men inte p95/p99 latency, connection saturation, OPS 429 under peak eller Core Web Vitals i verklig trafik.

### R-004 – Live Supabase schema drift
Status: UNVERIFIED

Repo-migrationskedjan är konsekvent och 33 filer verifieras, men exakt live DB-schema kräver databas-/miljöjämförelse.

## Releaseordning efter denna remediation

1. `main` är synkad mot aktuell OPS `.2` och live-/quality-gates är gröna.
2. Vercel commit-status är verifierad `success` för rapporthead `d1bfd11e…`.
3. Nästa separata verifiering bör vara säker tenant smoke/E2E med testidentiteter.
4. Följ p95/p99, 429/5xx, reconciliation queues och DB telemetry efter release.
5. Rätta OPS release governance så samma versionsnummer aldrig publicerar ny schemahash.
