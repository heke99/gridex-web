# Full E2E Verification Report

## Release verdict

**RED — complete live qualification remains incomplete.** The earlier genuine registration email reached the recipient, but full activation through its original confirmation link was never completed. Its disposable account has been removed as requested. This is a missing proof, not evidence of an observed outage. Scoped customer journey results are recorded below.

## Execution identity

- Repository: `heke99/gridex-web`.
- Branch: `codex/customer-journey-audit-20261020`.
- Parent production source: `bdf9b873d0a61f1a51e624c19533c9e5367cfafb`; equivalent local parent `ea38d546bde82b1d39a4700063b3ed98074be878`.
- Environment: actual Web source, isolated real Next/browser fixtures, existing protected production Web alias, live OPS OpenAPI reads.
- Runtime: Next16.3.8, React19.2.3; local Node24, existing production Node22.
- Database: existing Web Supabase; no migration or customer data mutation in this audit.
- Date:20 October2026, user-facing dates use Europe/Stockholm.
- Evidence: `/workspace/gridex-proof-output/customer-journey-audit-20261020/`.
- Skill: full-e2e-verification. The original live agreement and its idempotency key were never replayed.

## Architecture

1. Verified native Auth user → request-owned local identity references → tenant-scoped OPS bundle → actual Web mapper → Mina sidor, overview and contract views.
2. Canonical quote/address/legal snapshot → actual private/business application form → explicit review/consent → stable submission intent → existing server validation/idempotency → OPS application/continuation.
3. API failure → existing shared customer error boundary → read retry or explicitly selected link repair → authoritative read-back.
4. Customer privacy links → existing atomic request workflow. Contract termination remains a distinct support question.

## Quality gates

| Gate | Result | Evidence |
|---|---|---|
| Full repository test suite | PASS | `full-regression.log` |
| Customer mapper/page regressions | PASS |8 tests through actual mapper and pages; synthetic Auth/OPS ports |
| Real Next/browser customer journeys | PASS |40 scenario runs: Chromium + Firefox, each desktop/mobile; `browser-chromium.log`, `browser-firefox.log` |
| Lint/TypeScript/production build | PASS | `lint.log`, `typecheck.log`, `build.log` |
| Live published contract drift | PASS | Website, customer and staff snapshots still match OPS2026-10-12.1 |
| Delivery/migration integrity | PASS |49 migration files, local schema/type snapshots and API compatibility |

## Scenario summary

| ID | Priority | Flow | Result |
|---|---|---|---|
| CJ-01 | P0 | Owned fixed/variable contract prices and fees reach three customer views | PASS in runtime and browser |
| CJ-02 | P1 | Empty account → signup or existing-customer linking | PASS in runtime and browser |
| CJ-03 | P1 | Privacy requests and customer support are discoverable | PASS in runtime and browser |
| CJ-04 | P0 | Invalid dates and Stockholm calendar day preserve page usability | PASS in runtime and browser |
| CJ-05 | P0 | Temporary OPS outage/recovery | PASS in runtime and browser |
| CJ-06 | P0 | Private/business review, explicit consent and unchanged submission retry | PASS in Chromium/Firefox, desktop/mobile |
| CJ-07 | P0 | Guest identity requires login | PASS in runtime/browser |
| AUTH-03 | P0 | Genuine email confirmation → native activated account | BLOCKED, earlier disposable account removed |

## P0 evidence

### CJ-01 — recorded contract prices

The actual `getCustomerPortalOverview` mapper feeds all three real page modules. The new shared price component renders monthly fee, invoice fee, markup, fixed energy price where applicable and price area. Zero stays zero, negative recorded values are retained and missing values remain missing. It never substitutes a current public quote for an existing customer contract. Variable products explain period settlement without inventing a locked future energy price. The customer contract API does not establish a VAT basis, so no unverified VAT conversion is added.

### CJ-04 — malformed dates

The parent source reproduces `RangeError: Invalid time value` in Mina sidor. Overview cards also used an unchecked formatter with the server's default timezone. Both now use the existing shared formatter: invalid values render a placeholder, date-only values retain their day, and instants use Europe/Stockholm. Before-fix failures are preserved in `before-fix.log`.

### CJ-05 — temporary dependency failure

The existing error boundary was already shared by Mina sidor and dashboard. It used `reset`, which clears the local error without re-fetching failed server contents. A real Next browser scenario reproduced the customer remaining in the error state after the synthetic OPS outage ended. The pinned Next16.3 documentation specifies the stable `retry` prop for re-fetch and re-render. Both the read-only retry button and confirmed link-repair completion now use it; pending repairs do not trigger a successful read or new write.

### CJ-06 — retrying the same application

A real browser form reproduced a returned failed action resetting the required consent checkboxes while the controlled review state remained accepted. The next click never submitted. `consent-reset-before-fix.log` preserves the failure. The review form now prevents implicit native reset, so an unchanged retry carries the same explicitly selected consent, price/legal evidence and operation ID. Navigation back to unchanged details no longer rotates that identifier; actual field or consent edits still do.

Both browser engines verify private/business validation, a disabled submit before consent, returned failure, retained checkboxes, identical full payload on retry, identical payload after back/review, a distinct ID for edited details, and cleared/disabled consent after a new legal bundle. This is a synthetic action boundary; no new live application is submitted.

## Failures

- Missing customer price information: central contract-price component added to all customer entry/contract views, including previously omitted invoice fee and area.
- Fragile dates: the two remaining unsafe entry-page/card formatters now use the common validated Stockholm formatter.
- Stuck recovery: use the pinned framework's `retry` API after a temporary OPS failure.
- Blocked application retry: preserve controlled consent during returned-action reset; keep the same operation on unchanged review navigation. Changed fields and new legal versions are covered separately.
- Incomplete navigation: empty contract states offer signup and existing-customer linking; support is present in the customer navigation; access/erasure links reach the atomic privacy workflow rather than a generic case form.

## Security / tenancy

External Auth, OPS and storage ports are synthetic in browser simulations. Actual page/service authorization remains active; the browser fixture omits the production proxy because it otherwise calls real Auth. Guest behavior is checked separately in actual page tests and production HTTP probes. No fake session, production OTP, service key or another customer's identity is used. Existing cross-tenant and server-side API tests remain part of the full repository suite.

## Database / migrations

No schema or data change is included. Existing migration integrity and compatibility checks pass. The underlying privacy RPCs, signing evidence and original application are unchanged. This audit does not assert a new full legacy schema replay or every possible production mutation.

## External integrations

Current website/customer/staff documentation and committed generated contracts agree with OPS. Existing original PDF/hash/verification/IP/time and real mail-delivery evidence from earlier work is retained without replay. No new supplier switch, real application, customer or email is created by these tests.

## Performance observations

Contract prices reuse the already-authoritative bundle; displaying them adds no API requests. The common price component stays on the server side. Desktop/mobile browser checks cover the changed pages and real form. Earlier bounded125-page public crawl and29 live public Web→OPS price/area calls remain separate evidence from the preceding source; the corresponding public transport/quote modules have not changed here.

## Cleanup

The browser runner uses a disposable local application, synthetic credentials and explicit external ports. Network requests leaving localhost are blocked. Local test servers/processes and temporary source copies are disposed. No production customer fixture or mail cleanup is required.

## Remaining blockers

- Full real confirmation-email activation needs a fresh authorized disposable registration and the genuine received link. No removed account's old link should be reused.
- The previous exact OPS test portal retirement remains incomplete after a connector request-state failure; this Web-only source change does not claim to complete it.
- Scoped simulations and production guest probes must not be represented as a new signed production agreement or a complete authenticated production customer journey.

## Final conclusion

All named scoped gates pass: full tests, lint, TypeScript, production build, API/migration compatibility and40 real Next/browser scenario runs. The customer price/navigation/date/recovery/application-retry defects are corrected. Production delivery is tracked in PR53 and the private delivery checkpoint. Complete real confirmation-email activation remains unverified, so a system-wide GREEN verdict is not asserted.
