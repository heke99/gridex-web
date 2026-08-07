# SECURITY_REVIEW

## Trust boundaries

`Browser -> Gridex Web server routes -> OPS API/Supabase`

API credentials och service-role access ska stanna server-side.

## Verifierade kontroller

- OPS Authorization header sätts endast i server-side transport.
- Redirects blockeras för att undvika credential forwarding.
- Timeouts är bounded.
- Endast GET/HEAD auto-retryas.
- OPS error payloads saneras innan kundmeddelanden används.
- Runtime request/response schema validation finns för website/customer operations.
- Tenant reference verifieras från OPS payload/context där det krävs.
- Customer application kräver verifierad portal/auth identity och UUID/equality guards.
- Idempotency och post-commit reconciliation skyddar write-flöden mot dubbelregistrering/partiella lokala fel.
- Public-contract snapshots är tenantbundna och service-side.
- Distributed rate limiter är migration-backed och service-role-begränsad.
- Webhook-flöden har signature/identity/tenant checks och durable retry/dead-letter-state.
- CI quality gate har `contents: read` och kan inte skriva till `main`.

## Canonical quote integrity

En redan signerad quote återvalideras från sin immutabla tuple. Browser/context-fält återintroduceras inte som en konkurrerande source of truth.

## Secrets

Ingen hemlighet, API-key eller token har lagts in i rapporter eller kod under remediationen.

## Kvarvarande externa verifieringar

- Produktiva secrets/rotation/permissions i Vercel och Supabase: UNVERIFIED från GitHub-only scope.
- Penetrationstest/DAST mot publicerad produktion: UNVERIFIED.
- Live webhook signature rotation/failure drills: UNVERIFIED.
