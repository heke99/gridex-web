# Full E2E Verification Report

## Release verdict

**RED — full E2E qualification is incomplete.** The remaining required real email-link activation has not been completed. This verdict does not mean an outage was observed. The scoped code defects below were reproduced, fixed, and regression tested. Production publication is recorded separately after source verification.

## Execution identity

- Repository: `heke99/gridex-web`.
- Branch: `codex/gridex-web-audit-round2-20261020`.
- Parent production source: `c2ac08b68f39c5db6df3977d438fa469b8ebde9d`; equivalent local parent `384fb6916dea43342343700d693a09c5ce6c91a6`, tree `37b51a8aab21ad5ede5fdf7b94049680b6c68b06`.
- Runtime: Next16.3.8, React19.2.3; local Node24, existing production project Node22.
- Environment: local isolated SQL/runtime/browser fixtures and bounded reads of protected `gridex.se` and separate Support123/OPS services.
- Database: existing Gridex Web Supabase project; no schema or customer data changed by this audit.
- Date: 20 October2026, displayed times use Europe/Stockholm.
- Skill: full-e2e-verification. No PROJECT_E2E configuration exists. No new real application, customer, email or supplier switch was created. Previous original test application was never replayed.
- Detailed private evidence: `/workspace/gridex-proof-output/web-audit-round2-20261020/`; no credentials, cookies or original customer payloads are included in this repository report.

## Architecture

1. Public checkout → bounded Web BFF → typed OPS transport/schema → canonical address/area/quote/legal/application → durable local receipt/onboarding → status UI.
2. Native Auth verification → server-derived customer identity/assertion → tenant-scoped OPS customer API → private response/UI.
3. Support123 → native Auth → authoritative OPS staff binding/permission → tenant staff API. Its local public inquiry inbox follows the same staff gate.
4. Privacy BFF → service-only atomic request/outbox RPC → OPS support or local inquiry/message/receipt → fenced worker → owned status history.
5. Legacy authorized invoice intake → normalize/validate → profile/invoice persistence → integration sync log. These legacy storage stages remain sequential; no general cross-table transaction is asserted.

## Quality gates

| Gate | Result | Evidence |
|---|---|---|
| Full npm test | PASS after fixes | Launch, audit-hardening, customer writes, SQL/RLS, admin users, and new authority/invoice regressions |
| Support suite | PASS | Staff authorization, tenant invitation delivery, customer support, attachments, public reader and recovery |
| Privacy | PASS | 20 SQL/runtime/BFF/worker tests |
| Registration default role | PASS | 2 SQL regressions; no live signup repeated |
| Public support boundary | PASS | 4 actual-route tests |
| New admin context regressions | PASS | 3 behavior tests using actual context/guards and privileged routes |
| New invoice validation regressions | PASS | 6 behavior tests, including actual HTTP intake bounds, invalid calendar days, malformed amounts and zero/credit compatibility |
| Isolated browser suite | PASS | Pending states, recovery limits, notification read, support intent across reload, stale quote rejection, terminal status polling |
| Isolated production Next session/prefetch simulation | PASS | Concurrent users isolated; three same-request Auth reads deduplicate; idle/hover/focus/navigation behavior |
| Lint and both typechecks | PASS | Repository lint and Web/Support TypeScript |
| Production Web build | PASS | Next webpack production build |
| Migration file integrity/API compatibility | PASS | 49 files; no identified pinned-contract gaps |
| Live OpenAPI drift | PASS | Website, customer and staff snapshots still match OPS |
| Production dependency audit | PASS | Zero reported npm vulnerabilities in production dependencies; not a guarantee against unknown vulnerabilities |
| Recent runtime errors | No clusters returned | Web and Support123 read for preceding6h |

## Scenario summary

| ID | Priority | Flow | Result |
|---|---|---|---|
| AUTH-01 | P0 | Public registration defaults; role metadata cannot escalate | PASS in isolated SQL |
| AUTH-02 | P0 | Customer/staff authorization and expired-session boundaries | PASS in runtime/SQL tests |
| AUTH-03 | P0 | Real received confirmation email → completed native activation | BLOCKED |
| ADMIN-01 | P0 | Ticket manager retains scoped console access, denied unrelated privileged operations | PASS |
| CHECKOUT-01 | P0 | Canonical area/price/legal tuple and original evidence preservation | PASS in contract/runtime simulations; existing original proof reused |
| QUEUE-01 | P0 | Unknown outcomes, stable intent/key, Retry-After, fencing, DB failures | PASS in runtime/SQL tests |
| PRIVACY-01 | P1 | Linked/unlinked request, atomic receipt and replay | PASS in SQL/BFF/worker simulations |
| SUPPORT-01 | P1 | Public intake bounds, failure and durable inquiry | PASS |
| INVOICE-01 | P1 | Invalid invoice fields rejected before mutations | PASS |
| BROWSER-01 | P0 | Public/customer UI resilience and reload behavior | PASS in isolated Next/browser |
| BROWSER-02 | P1 | Concurrent SSR sessions and intent-only prefetch | PASS |
| CRAWL-01 | P1 | Public read crawl and desktop/mobile rendering | PASS |
| OPS-01 | P0 | Published specifications/typed adapters/POA archive contract | PASS in contract checks; not every production mutation executed |
| DB-01 | P0 | Relevant SQL/RLS/RPC boundaries | PASS for tested fixtures/native catalog; full legacy schema replay not performed |
| DEPENDENCY-01 | P1 | Build/type/lint/dependency checks | PASS |

## P0 evidence

### ADMIN-01 — scoped authority

- Actor: synthetic verified user with only `support_tickets.manage`.
- Trigger: actual `getAdminContext`, guard and admin route modules.
- Before: `isAdmin=true`, converting a scoped permission into general authority.
- After: `isAdmin=false`; legitimate support console access remains. Outbox replay and CIS operations return403 without invoking privileged write ports. Missing authority data fails closed.
- Authorized global `admin` role and explicit `admin.access` retain existing authority; inactive/unrelated roles do not acquire it.
- Production access was not attempted with another person's credentials or forged sessions.

### CHECKOUT-01 / QUEUE-01 — recovery

The existing launch/customer-write suites exercise real normalizers, typed clients and workers against isolated service ports: original evidence preservation, canonical tuple mismatches, stale quote responses, idempotency conflicts, ambiguous success, rate limits, Retry-After, obsolete leases and partial storage failures. Browser tests confirm truthful pending/error states and intent persistence. Earlier original application/PDF evidence remains separate and was not replayed.

### AUTH-03 — exact blocked boundary

A genuine earlier registration sent a confirmation email, which the recipient received. Its link stopped at intentionally retained Vercel protection. The recipient did not subsequently open it, Outlook is not connected, and the original message is unavailable in the connected sending account. The disposable account was removed as requested. No verification token was generated, harvested or substituted, and native confirmation was not fabricated. A fresh authorized confirmation journey is needed for complete live qualification.

## Failures and fixes

### DEFECT-001 — scoped support permission became full administration

- Severity: high authorization defect in the server context predicate; no production exploitation observed.
- Root cause: `support_tickets.manage` was included in the predicate setting `isAdmin`; privileged operations trusted this field.
- Fix: full administration derives from the existing `admin` role or `admin.access`. Console admission separately preserves scoped support access.
- Regression:3 actual context/route/guard tests; pre-fix failure preserved privately.

### DEFECT-002 — malformed invoice data could affect persisted customer state

- Severity: incorrect financial data and partial mutation on invalid input.
- Root cause: invalid supplied amounts fell back to zero; date normalization ran after the profile update. JavaScript also normalized impossible calendar dates.
- Fix: validate supplied date/amount/object fields before all writes. Reject invalid/non-finite values and impossible ISO calendar dates with400. Retain optional omissions, actual zero, credit amounts, existing localized decimals and leap days.
- Regression:6 behavior tests; pre-fix failures preserved privately. The tests assert no profile, invoice or sync mutation for malformed input.
- Limit: this fix does not turn the legacy multi-stage invoice importer into a new database transaction.

### DEFECT-003 — previous public-support change broke an older regression harness

- Severity: test-gate failure, not an observed product outage.
- Root cause: the previous bounded-reader import was absent from the older VM test harness.
- Fix: load the actual shared reader/HTTP safety module and use a real Request. Preserve the original rejection and complete4000-character message assertions.
- Regression: full npm test passes again; no production validation was removed or mocked away.

## Security / tenancy

Auth/tenant tests include denied roles, cross-customer identifiers, tenant headers, stale sessions and attachment boundaries. The new scoped-admin regressions explicitly cover authorization before side-effect construction.

Native database advisor results contain23 service/internal tables with RLS and no browser policy; this is not itself an access leak. Nine authenticated SECURITY DEFINER helpers were inspected: they bind to auth.uid directly or through fixed self-bound helper calls. Blanket EXECUTE revocation would break intended behavior and was not performed.

Leaked-password protection is reported as disabled: [Supabase guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No Auth policy was changed during this audit.

## Database / migrations

Critical repository SQL fixtures passed customer/tenant isolation, forged write denial, scoped permissions, current Auth email, atomic rollback, duplicate/replay handling and queue fencing. Migration file checks cover49 files. A complete empty-database replay of the legacy production schema was not performed.

Performance advisor follow-up remains:61 uncovered foreign keys,187 indexes without observed use,537 role/action observations of multiple permissive policies, and6 duplicate-index groups. These are advisor observations, not measured production bottlenecks or537 distinct defects. No speculative index deletion or access-policy rewrite was made.

- [Foreign-key index guidance](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys)
- [Permissive-policy guidance](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies)
- [Duplicate-index guidance](https://supabase.com/docs/guides/database/database-linter?lint=0009_duplicate_index)

## External integrations

Published OPS contracts still match. Webhook parsing/signature, transport errors, customer assertions, retries, public support delivery idempotency and archive handling are covered by runtime/SQL simulations. No new actual email or contract mutation was triggered. Earlier original PDF/email proof remains a separate transport/business evidence record, not MailR3.1 acceptance.

## Performance observations

125 discovered permitted public pages were read sequentially, excluding stateful/auth/API/admin paths. No HTTP errors or framework error pages were found; the permitted discovery queue was exhausted. Five critical pages were rendered at1440px and390px:10/10 checks passed with no first-party HTTP failures, browser page errors, framework overlays or horizontal overflow. Third-party scripts were blocked. This is bounded sanity testing, not a load test or field-performance guarantee.

## Cleanup

Isolated browser servers, temporary applications and synthetic identities were disposed by their test runners. No new production customer or business request was created. Existing staff accounts, Vercel protection and original signed evidence were preserved.

## Remaining blockers

1. Real confirmation-email activation remains unverified as described in AUTH-03.
2. The previous exact OPS test portal retirement remains incomplete after a connector `Invalid or expired requestState` error. Its last native reconciliation showed an active identity, no retirement audit and no separate portal account. This audit does not claim to have completed that data change.
3. Full legacy schema replay and every possible production mutation are outside the evidence obtained here; tested simulations and live reads must not be represented as those missing proofs.

## Final conclusion

The discovered scoped-admin, invoice-validation and test-gate defects are corrected and covered by regression tests. The named automated checks and bounded read/browser probes pass. Full real-world activation remains blocked, so the entire system is not certified GREEN.
