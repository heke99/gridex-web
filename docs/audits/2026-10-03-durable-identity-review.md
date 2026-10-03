# Durable customer identity review — 2026-10-03

This package reviews the checked-in OPS release `2026-10-02.4` and the actual Web
onboarding, portal write queue, domain webhook and retry callers. It does not
claim production activation or a locally completed native PostgreSQL run.

| Confirmed failure path | Correction | Regression evidence |
| --- | --- | --- |
| A durable onboarding payload with `authenticatedUserId` bypassed the worker's fresh Auth email-confirmation check, including a missing/deleted Auth user. | `onboarding.ts` now requires a returned Auth user and confirmation from the current Auth response. Contact email can still differ for an authenticated checkout, as the product permits. | A stored authenticated UUID with an unconfirmed or missing Auth user never reaches OPS sync; an actually confirmed owner reaches sync and completes. |
| Unbound onboarding could accept a matching external ID while a known customer number disagreed, or the reverse. | Shared `stableIdentity.ts` requires at least one stable match and no contradictory known identifier. The historical `contract_customer_ref` external-ID fallback is not mistaken for a customer number. | Both contradictory combinations fail; one actual stable identifier and the legacy external-reference fallback continue to work. |
| Safe login resume validated one same-email job set, then the legacy helper re-read every same-email job. A newly queued job could inherit the authenticated UUID without those checks. The re-read also used ILIKE patterns. | Resume passes the exact validated job IDs, uses normalized-email equality, and conditionally claims each job by prior status and attempt count. | A job inserted between validation and resume stays pending and unbound while the validated job completes. |
| A stale portal queue worker could complete or fail a replacement worker's processing lease because the final UPDATE checked only `status=processing`. | Queue claim, completion and failure compare the attempt count; completion/failure also compare the actual claim timestamp. Onboarding final writes compare their lock timestamp as well, so resetting a retry budget cannot reuse an old lease. | The original queue/onboarding worker cannot change a replacement processing lease with the same attempt count and reports the lost lease instead. |
| A claimed portal write or old onboarding job minted a fresh assertion from retained identity without rechecking whether the Auth user was deleted, unconfirmed, banned or the account disabled. | Each claimed write and confirmed onboarding operation fetches the current Auth user and account status before dispatch. Identity disagreement, missing/deleted/banned users and disabled accounts stop permanently; verification outages retain a retry. Queue writes reject unconfirmed users; healthy onboarding waits for confirmation without consuming its retry budget. Rejected onboarding never writes a local projection. | Actual worker tests exercise every operation type, disabled/suspended accounts, Auth bans/deletion, lookup failures and an account changed between two jobs in one run. Actual onboarding regression rejects banned/deleted/disabled current accounts. No rejected job reaches an OPS caller. |
| The profile action treated any returned response as applied, then wrote submitted browser values as a current local OPS projection; a lost response also discarded its original operation key/body. | Only accepted/submitted successful receipts with `profile_updated=true` show applied confirmation. Intake shows received, rejected/unknown results fail. Browser inputs are never projected as canonical data. A canonical retryable transport failure retains the exact identity, payload, metadata and scoped operation key in the durable queue. | Actual server-action tests cover intake/applied/rejected/unknown/false results, caller identity, exact retained retry and storage failure; all outcomes leave local projections unwritten. |
| Onboarding and queue retries ignored explicit `retryable=false` on canonical 502/503 failures; queued HTTP 200 rejection could count as completed. | Permanent canonical failures stop for review/dead-letter. Queue dispatch also requires the operation's accepted business outcome, including explicit linked owner access for portal linking. | Actual `OpsError` 502/503 permanent failures stop; a retryable 503 remains retryable. Queue regressions reject profile/move-out/linking/notification false outcomes without completing. |
| The receiver required an extra `x-gridex-event-type` header that the published callback contract does not require. | The signed body supplies event type; a legacy header remains optional and must agree when present. | An exact documented application-status callback succeeds without the extra header; a mismatched optional header fails before durable apply. |
| Node hex decoding silently discarded an odd 65th signature nibble, making a malformed SHA-256 signature compare equal. | Webhook comparison requires exactly 64 hexadecimal characters before constant-time comparison. | Valid SHA-256 succeeds; truncated, changed and odd trailing-nibble signatures fail. |
| The domain webhook parser ignored documented `subject_reference` and data-level `customer_reference`. | Both canonical references now reach the existing invoice/customer correlation arguments. | The exact `OpsDomainWebhookEnvelope` shape yields the expected customer and invoice references. |
| Stored retry metadata could disagree with the signed body's organization, delivery ID or occurrence timestamp. | Retry checks body-to-row agreement and durably dead-letters an inconsistent stored event. | Three mismatched stored identities never call the apply RPC; the valid stored identity is applied. |
| Historical `apply_ops_domain_event_v2` used OR across stable identifiers and email, allowing an unrelated customer's event to update a local invoice and assign a notification through email alone. It also accepted a conflicting unknown stable identifier when another identifier matched. | Forward migration `20261003175858_gridex_web_stable_webhook_identity.sql` removes email from ownership resolution, accepts the verified Auth UUID alongside the portal identity, and quarantines contradictory known external, customer-number, canonical/billing-reference or portal identifiers. Canonical references saved in onboarding metadata and `canonical_ops_id` participate in correlation alongside the historical aliases. An event with no stable match is retained with an unresolved notification. Organization references must be non-null and replay identity must include the organization. | Native RED reproduces historical email-only ownership. Native GREEN covers stable ownership despite alternate contact email, five conflict types, replay idempotency, Auth UUID, alternate billing reference, null organization and atomic rollback/durable retry after notification sink failure. These native files require CI execution. |

The migration preserves the existing RPC signature, service-only EXECUTE ACL,
existing durable status/retry behavior and historical migration file. It changes
no production data and introduces no public table, browser grant or RLS policy.
Its SECURITY DEFINER function uses an empty search path and qualified relations.

## Validation

Passed locally with Node 22.23.3:

- `node --experimental-strip-types tests/portal-durable-identity-runtime.test.mjs`
- `node --experimental-strip-types tests/portal-outbox-eligibility-runtime.test.mjs`
- `node --experimental-strip-types tests/profile-action-outcome-runtime.test.mjs`
- `node --conditions=react-server --experimental-strip-types tests/request-performance.test.mjs`
- `node --experimental-strip-types --experimental-loader ./tests/typescript-alias-loader.mjs tests/auth-onboarding-hardening.test.mjs`
- `node tests/checkout-post-commit-durability.test.mjs`

A complete single-session SQL replay of the selected SETUP, deployment assertions
and rollback BEHAVIOR files passed on PGlite PostgreSQL 17.5 after adding these
fixtures. This verifies SQL semantics only and does not replace native PostgreSQL
or multi-session concurrency CI.

Scoped ESLint passed for the changed onboarding/identity, queue, webhook and
runtime-regression files. Full candidate gates are recorded separately by the
integration owner.

Native fixtures are included in `scripts/run-native-database-tests.py` and must
pass its existing PostgreSQL 16/17 CI matrix before this forward migration is
deployed. Local PostgreSQL server execution was unavailable in this environment;
the native assertions are staged evidence, not completed native verification.
The runner loads the historical webhook function explicitly before its RED
reproduction, so its raw migration-file count includes that historical replay
file in addition to the new forward migrations.

## Operational completion

This package does not configure signing secrets, OPS customer assertion keys,
cron credentials, Auth redirects or production domain routing. Integration
readiness and authenticated tenant/support smoke tests remain deployment gates.
The new SQL must be deployed together with the Web caller corrections after its
native matrix passes; deploying only the JavaScript changes would leave the
historical email-only SQL ownership rule active.
