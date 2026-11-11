# Cross-platform qualification

Mandate: attached user prompt, 11 November 2026 (Europe/Stockholm).
Source: Web main c0bcafbbad547cbb0c2b3f17ffb1ca1030c4f62f; OPS PR1047
6819d12d35a8d8ce560889b29c91f330a2655724. Read remote refs before delivery.

Skills: Supabase for real Auth/session boundaries; full-e2e-verification for
requirements, version-bound scenarios, failures and release verdict. Database
optimization, email delivery and production migration skills are conditional:
no production schema mutation or outbound mail is part of this test package.

Architecture: native UI -> SecureStore-backed verified Supabase session -> Web
subject binding -> ordinarily authenticated/asserted OPS customer API -> OPS DB.
Public prices use a separate public endpoint without a customer bearer token.

## Matrix

| ID | Priority | Journey | Required evidence |
|---|---|---|---|
| AUTH | P0 | A/B login, invalid/unlinked/missing sessions | Real Auth, own exact rows, no foreign data |
| CORE | P0 | Contracts/sites/invoices/detail, A-B-A, foreign invoice | Same-stack HTTP and both native UIs |
| RESTORE | P0 | Authenticated restart, logout restart, expiry/revocation | Fresh backend read, identity stays correct |
| RESILIENCE | P0 | Background, offline/reconnect, OPS outage/timeout/recovery | Controlled errors, private/no-store, no leaks |
| PROFILE | P1 | Profile and phone update | Canonical customer read-back, other customer unchanged |
| SUPPORT | P1 | List/detail/create/reply/continuation | Own public messages persisted once; no internal notes |
| EXTRAS | P1 | Documents/open, notifications/read, powers, legal | Own nonempty fixtures, foreign denial, canonical read-back |
| CONSUMPTION | P1 | Facility/period selection and availability | Authoritative delivery/revision capability or explicit unavailable state |
| PRICES | P1 | SE1-SE4/day/intervals/retry | Public data and no customer bearer |
| HANDOFF | P1 | Recovery/contracts/support/document links | Approved HTTPS only, no bearer forwarding, return to app |
| IOS-UI | P1 | Small/notched screen, keyboard, safe areas/navigation | Installed native simulator app and screenshots |
| RELEASE | P0 | Android signature/config; iOS bundle/config/build | Exact source, native artifact, signature/environment checks |
| APPLE | P0 | Distribution/TestFlight/physical iPhone | Existing Apple account/profile/device access; never substitute simulator proof |

Synthetic fixtures are disposable. Credentials, private keys and session-bearing
traces must never be uploaded in plaintext. Always clean up owned processes/data.
No extra heavy same-stack run before the remaining harness is prepared.

## Current checkpoint

Web PR68 source follows f31e310. First expanded run42929886692 failed real
profile writes before transport: closed OPS schema rejects identity body fields.
The client now sends identity in verified headers and retains its binding in
implicit idempotency keys. Red-before/green-after transport/schema regressions
PASS (12 tests). Support harness now expects the actual create/reply status201.
Early sanitized failure artifacts avoid waiting for a fixture that cannot exist.

Local mobile verification (route/account/lifecycle/native and web types/lint),
4 compiler/encryption/gateway/evidence-security tests, shell/Python/YAML syntax
checks PASS. Native search/clear and future market day checks are prepared before
the next coherent coupled run; they still need actual device UI verification.

Production-configured iOS run42929886818 on f31e310 passed actual simulator native
Release build and unsigned arm64 device archive. Its UI step was falsely green:
macOS Bash3.2 aborted on an empty array before Maestro and EXIT sanitization masked
the failure. No simulator receipt/screenshots exist, so UI proof is invalidated.
The corrected script uses a nonempty environment, preserves failure status, and
requires JUnit+receipt output; workflow independently requires both files.
This is neither Apple distribution signing, TestFlight nor physical iPhone proof.
Android production-configured build42932214860 on f31e310 passed; final updated
app source still needs its own qualified release artifact and signature checks.

OPS6819 has two independent reviews. The minimal two-file retention form fix
passed red-before/green-after,86 neighboring tests and type/lint checks. Core
real-stack HTTP/Android replay42931159750 is green. Full hardening42931159640
is still running; no merge-role claim is held while awaiting mandatory gates.

Expanded shared backend uses OPS6819 and this Web source, broader fixtures/scopes,
HTTP writes/read-back/idempotence/foreign denial, outage/stalled request/recovery,
Android core+extras. macOS UI starts after Android terminal marker to prevent
shared synthetic B-session revocation races. Recipient-bound RSA/AES-GCM carries
only synthetic credentials. Restricted gateway denies Auth-admin/REST/directOPS;
private lifecycle control exists only in the disposable job. No production
credentials or customer data are used or uploaded.

Consumption positive path is still unimplemented in OPS. Existing normalized
revision fields and customer_supply_periods exist, but sites/metering APIs omit
them. Required current OpenAPI paths are held by foreign receipt
0592bde7dab712b44737b4268187620f3ea708aa (authenticated GET_MATCH), so do not
change/release those claims without bounded handoff. Fail-closed UI checks do not
prove successful consumption. Apple distribution/TestFlight and physical iPhone
access have no configured existing flow; finish independent work before asking.

Next: bind two static reviews to the final commit, push and follow the coherent
coupled run to terminal; fix real
failures, repeat affected and final coherent acceptance. Get two exact final
reviews. Do not call both platforms ready while consumption/Apple/device gaps remain.


## Follow-up after actual0ca run

42936011139 passed real shared-backend HTTP/core/extras/writes/replay/foreign
checks, but native verification failed. Android action uses /bin/sh; `source`
failed127 before build. An explicit Bash-owned runner fixes the actual boundary.
iOS shared flow failed starting XCTest driver; bounded startup allowance now180s.
Production smoke42936011277 failed finding keyboard accessory after password;
actual UI proof remains absent. Simulator now explicitly disconnects hardware
keyboard so acceptance exercises the on-screen keyboard.

OPS1047 merged normally asd93f361c51e81bc49cd48e817bd0b0fbe65e3d5b,
exacttree2c51fb1c19c33fe25221690700d0e5a927480a87 of6819. All gates,
including pr-certificate, green; actual clean artifact has31browserPASS and
25057unitPASS/4existing skips. Own mergerole released FIRST and own source claims
released receipt-matching; foreign refs untouched. No OPS production publication.

Requirements review found feasible extra E2E gaps despite existing unit tests.
Before next coherent run the harness now also prepares invoice lines/PDF own/
foreign reads and real external browser requests;52 own support cases with actual
cursor/no-overlap/cross-customer cursor denial; public staffreply/internal-note
sentinel; support detail web handoff; native statusfilter; stale customer-document
URL fresh denial/no external request then restore; price-network error/retry.
These additions are pending actual CI qualification. They are not additional
external prerequisites and must be followed to terminal results.

## Actual19 run and native repairs (2026-11-11)

Shared run42939724745 on Web19e594 / OPS6819 passed expanded real HTTP checks
and Android's13 core journeys. Android extras reached real profile, notifications,
invoice PDF/lines, support cursor/filter/public staff detail and web handoffs.
Support write201/read200 then failed intended full-text read-back: AOSP adb shell
argument joining truncated multiword input. Web-owned input now shell-quotes the
space-encoded text, asserts complete input before POST, and seeks bounded UI
read-back. Regression was red before and2PASS after. Later native scenarios remain
unverified; do not treat this partial run as acceptance.

Actual iOS19 builds succeeded, UI failed locating the keyboard accessory. Focused
invalid-form diagnostics found -34018 Keychain errors: CODE_SIGNING_ALLOWED=NO
omitted simulator identity entitlements. A manual host-signing experiment passed
static codesign but failed actual direct launch: host AMFI rejected restricted
entitlements. It is discarded, not an accepted fix. Main has no manual signer.

Diagnostic branch9248dde probes normal Xcode simulator signing and simulator-only
CODE_SIGN_ENTITLEMENTS packaged as __TEXT,__entitlements. Actual Mach-O parser
checks every slice/platform7/scoped identity. Both independent reviewers cleared
its scope for diagnostic execution; run42952604523 remains pending actual native
build/launch/Keychain evidence. Intentional diagnostic marker failure is never a
successful acceptance result. Physical archive remains separately unsigned.

Current local preflight passed mobile:verify (customer routes/account/provider,
native lifecycle/native types/Web types/lint),6 device/security tests and2 Android
input tests. These checks do not replace final coherent CI and emulator journeys.
Required OPS documentation files remain owned by foreign receipt0592bde7, exact
three refs rechecked authenticated on2026-11-11. No foreign files/claims changed.


## Offline restoration and browser evidence follow-up

405 shared42960268160 ended FAIL despite all HTTP gates. Android's Chrome consent
node disappeared between the captured hierarchy and generic label re-selection;
optional onboarding now uses validated bounds from that same Chrome snapshot and
actual own-reference PDF GET remains mandatory. Focused reproduction was3FAIL
before and4PASS after. Early Android evidence upload is prepared before Mac waits.

Actual405 iOS passed both customers, invoice PDF returns, authenticated restart,
background/expired-token refresh, then did not see the controlled offline error.
The error is below retry in the scroll view; bounded scrolling is used and future
failure evidence exports only fixed boolean state markers, never raw hierarchies.
This does not assert that viewport position was the proven cause.

A separate real hook defect was reproduced: retryable Auth refresh failure caused
local signout. The pinned Supabase SDK deliberately retains sessions for this
error. Preserve that behavior while hiding all customer rows until a fresh server
read; definitive revoked refresh still clears the session. Regression was1FAIL
before and38PASS after. Both native matrices now exercise offline foreground
recovery plus fresh read-back. Private data remains hidden and invalid/explicitly
logged-out sessions must still never return.

This changes common app code: the old signed0ca APK is superseded for this new
candidate and must be rebuilt through the existing production flow and signed
with the preserved key after code qualification. No key regeneration or Apple
signing claim. Next coherent run waits for full targeted/security/type preflight
and two exact-SHA independent reviews of all prepared changes.

The same classified SDK failure was then reproduced in document opening, all
write wrappers and consumption session lookup:6 new regressions failed before
the guards,49 lifecycle tests pass afterward. Retryable failures clear displayed
details without local signout or discarding an uncertain mutation's attempt key;
definitive invalid sessions still clear credentials and cannot issue requests.
The SDK error-class test import now resolves from apps/mobile's locked SDK,
fixing f6's native-only portability failure. The exact canonical native-only suite
was reproduced with no root node_modules and64 tests passed. The superseded f6
heavy runs are cancelled before another qualification candidate is published.
