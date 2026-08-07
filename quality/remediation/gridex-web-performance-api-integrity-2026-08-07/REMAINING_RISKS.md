# REMAINING_RISKS

## Resolved repo risks

Följande är stängda i repo-scope:

- Lokal/live OPS OpenAPI-drift.
- Same-version `.2` hashdrift i klienten: klienten är resynkad mot aktuell live-hash.
- 5 287-raders OPS client-monolit.
- Begränsad runtime version-observation.
- Next.js lint blocker.
- Runtime type-importfel från modulsplitten.
- Föråldrade source-text regressionstester.
- Avsaknad av full CI quality gate.
- Avsaknad av live OpenAPI-gate vid main-push.

## Kvarvarande risker

### R-001 – Upstream immutable release-policy
Status: OPEN UPSTREAM

OPS ändrade `website-integration-v1.json` inom samma `2026-08-05.2` från hash `d0bdc356…` till `e8ddc6b8…`. Gridex Web blockerar nu sådan drift, men korrekt långsiktig lösning är att OPS aldrig muterar en redan publicerad immutable release utan versionsbump.

### R-002 – Live tenant E2E
Status: UNVERIFIED

En full checkout med verklig API credential/tenant, quote, application, customer number, contract och portal sync kördes inte med produktionscredentials i denna GitHub-remediation.

### R-003 – Produktionsdeployment
Status: UNVERIFIED tills deployment-evidens kontrollerats

GitHub build är grön, men Vercel production deployment för slutlig SHA måste verifieras separat.

### R-004 – Produktionstelemetri och last
Status: UNVERIFIED

Repo-gates bevisar build/korrekthet men inte p95/p99 latency, connection saturation, OPS 429 under peak eller Core Web Vitals i verklig trafik.

### R-005 – Live Supabase schema drift
Status: UNVERIFIED

Repo-migrationskedjan är konsekvent och 33 filer verifieras, men exakt live DB-schema kräver databas-/miljöjämförelse.

## Releaseordning

1. Main är synkad och båda GitHub-gaterna är gröna.
2. Verifiera deploymentstatus.
3. Kör säker tenant smoke/E2E med testidentiteter.
4. Följ p95/p99, 429/5xx, reconciliation queues och DB telemetry efter release.
