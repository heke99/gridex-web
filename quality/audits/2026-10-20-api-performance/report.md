# API performance observability

Scope: bounded server-side cache/latency/OPS-attempt measurements and an offline
log summarizer. Parent production source:
`bdfa41b29698cea92752131074867ee195f83002`.
Exact delivered source, deployment, gates and native sample results are recorded
in PR53 and `/workspace/gridex-proof-output/api-performance-20261020/checkpoint.json`.

## Implementation

- Central request-scoped collector groups actual transport attempts and cache
  decisions into one JSON line per selected public API operation. Context from
  concurrent requests stays isolated; nested scopes do not duplicate counts.
- Logical OPS timings include response processing and existing read retries.
  Attempts, intermediate 429s, last HTTP status and successful conditional 304s
  are visible. Write retry, timeout and authentication policies are unchanged.
- Exact context hit/miss/join/bypass and validated database snapshot hit/miss/error
  are distinguished from Next data-cache lookup/fill executions. No speculative
  cache-hit inference is made from snapshot source or response time.
- Labels are bounded; dynamic references and queries are removed. No private
  input/output, user identity or credential is added to the new log format.
  There is no new network exporter, database write, dependency or paid service.
- The CLI report accepts JSONL and Vercel/connector exports and reports scoped
  counts and nearest-rank p50/p95 with sample counts. Unknown data is discarded.

## Verification

Ten new behavior tests exercise actual transport retries, a genuine context-cache
burst, concurrent/nested scopes, HTTP errors, timeout and malformed response,
post-response work, logging failures, observation bounds, privacy filtering and
report arithmetic. Full regression, snapshot/database-query regression, lint,
TypeScript, production build and delivery integrity are checked separately.

Native verification uses the published Web deployment, public catalogue/address/
quote operations, and the existing temporary outer Vercel access. Runtime log
retrieval verifies ingestion, and the report is generated from those real logs.
No new customer, signed application, agreement, email or supplier switch is
submitted. No original signing request is replayed.

## Limits

Controlled production probes are a small synthetic workload against real systems,
not a representative customer-traffic or monetary-savings study. Logs cover only
their retained/exported window. Next stale/background fills are not exact cache
hits. Provider calls inside OPS and browser cache hits are not measured here.
Operation records cap their upstream observations and report any truncation.
Earlier incomplete genuine registration-link verification and exact OPS test-link
retirement remain separate outstanding tasks; this is a scoped verification.

Operational use: [API performance guide](../../../docs/operations/api-performance.md).
