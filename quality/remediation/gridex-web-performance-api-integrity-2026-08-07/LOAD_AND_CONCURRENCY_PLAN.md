# LOAD_AND_CONCURRENCY_PLAN

## Mål

Verifiera systemets beteende under samtidiga quote-, application-, public-contract- och portalflöden utan att bryta idempotency, tenant isolation eller OPS rate limits.

## Föreslagen lastprofil

1. Public contracts: hög read-concurrency med ETag/304-hit-rate.
2. Energy-area resolve: burst från checkoutstart.
3. Quote create/validate: normal och peak checkout concurrency.
4. Customer applications: låg/medelhög write-concurrency med återupprepade client retries och samma idempotency key.
5. Portal bundle: authenticated read concurrency.
6. Webhooks: burst/retry/dead-letter recovery.
7. Distributed rate limit: flera serverless instances mot samma Supabase RPC.

## Obligatoriska mätvärden

- request rate, error rate och p50/p95/p99 latency per endpoint.
- OPS 429/5xx och Retry-After.
- DB RPC/query p95/p99.
- connection pool saturation.
- cache/ETag hit-rate.
- duplicate/idempotency conflict rate.
- reconciliation queue depth och age.
- webhook retry/dead-letter counts.

## Safety gates

- Ingen write-loadtest direkt mot produktion utan isolerade testidentiteter och explicit testtenant.
- Samma idempotency key ska inte skapa dubbla kund-/avtalsobjekt.
- Tenant A-data får aldrig synas i tenant B-cache/resultat.
- 429 ska ge kontrollerad backoff, inte retry storm.

## Status

Planen är dokumenterad. Ett verkligt externlasttest har inte körts i GitHub-remediationen och är därför `UNVERIFIED`, inte PASS.
