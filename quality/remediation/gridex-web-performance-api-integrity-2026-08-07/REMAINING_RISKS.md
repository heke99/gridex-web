# REMAINING_RISKS

## Resolved repo risks

Följande är inte längre öppna risker i repo-scope:

- OPS/OpenAPI `2026-08-05.2` vs `2026-08-05.1` drift.
- 5 287-raders OPS client-monolit.
- Begränsad runtime version-observation.
- Next.js `module` lint blocker.
- Runtime type-importfel från första modulsplitten.
- Föråldrade source-text regressionstester.
- Avsaknad av full CI quality gate.

## Kvarvarande externa risker

### R-001 – Live tenant E2E
Status: UNVERIFIED

En full checkout med verklig API credential, tenant, quote, application, customer number, contract, portal sync och efterföljande statusflöde har inte körts i denna GitHub-only remediation.

### R-002 – Produktionsdeployment
Status: UNVERIFIED

Vercel/deploymentstatus måste verifieras separat efter `main` push.

### R-003 – Produktionstelemetri och last
Status: UNVERIFIED

Repo-gates bevisar korrekthet/build men inte p95/p99 latency, connection saturation, OPS rate-limit behavior under peak eller Core Web Vitals i verkliga användarsessioner.

### R-004 – Produktionsschema drift
Status: UNVERIFIED

Migrationskedjan är intern konsekvent, men exakt live Supabase-schema kräver miljö-/DB-jämförelse.

## Rekommenderad releaseordning

1. Push verifierad commitkedja till `main`.
2. Kräv grön read-only main quality gate.
3. Verifiera deploymentstatus.
4. Kör staging/live-safe tenant smoke/E2E med testidentiteter.
5. Följ p95/p99, 429/5xx, reconciliation queues och DB telemetry efter release.
