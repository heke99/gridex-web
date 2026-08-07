# Security review

Reviewed trust boundaries include browser input, server-only OPS credentials, tenant scoping, rate limiting, error shaping, redirect behavior and cache isolation.

## Verified controls
- OPS Authorization is attached server-side by the centralized transport.
- Transport blocks unexpected redirects (`redirect: manual`) and non-JSON upstream responses.
- Customer-facing upstream errors are filtered to avoid HTML/stack/Postgres/SQL/auth-header leakage while retaining request/correlation IDs in diagnostics.
- Distributed rate-limit RPC access is migration-restricted to service role; RLS is enabled.
- Transactional OPS traffic defaults to `no-store`.
- POST calls are not automatically replayed.

## Remediation
Contract-version drift observation now covers the full website/customer/OpenAPI boundary. This improves detection of integrity failures before they become silent schema assumptions.

No secret values were copied into reports or changes. Production cookie flags, deployed environment variables, WAF/bot controls and external penetration results are `UNVERIFIED` without the deployed environment.
