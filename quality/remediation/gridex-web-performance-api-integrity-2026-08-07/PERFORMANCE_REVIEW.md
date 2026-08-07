# Performance review

## Verified existing strengths
- OPS calls are centrally bounded by a 12 s default timeout (configurable within fixed min/max).
- Automatic retries are limited to GET/HEAD and retryable network/status failures; POST is not implicitly replayed.
- Backoff includes jitter and honors numeric `Retry-After`.
- Transport defaults to `no-store` for correctness-sensitive OPS traffic.
- Swedish postal-code/energy-area resolution is local reference logic, avoiding an external lookup on every request.
- Public-contract flow supports ETag/304 reuse rather than unconditional full refetch.

## Remediation effect
The main measured engineering risk in this pass was correctness/performance interaction: contract drift could force failed quote/application paths and unnecessary repeated client attempts. Realigning the canonical contract and observing version headers across all contract surfaces reduces that failure/retry pressure without weakening freshness.

## Not claimed
No Lighthouse/Core Web Vitals or production latency benchmark was available through the GitHub-only connector, so LCP/CLS/INP/TTFB before/after values are `UNVERIFIED`. No speculative memoization, global caching or dependency removal was introduced without runtime evidence.
