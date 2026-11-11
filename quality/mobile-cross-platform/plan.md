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

## d919 terminal follow-up: bounded Auth and complete cancellation

Shared run42968402151 is terminalFAIL, not a release receipt. Its HTTP suites
passed (12core,18features,2resilience,2documentlink cases); Android13core and A/B
extra checkpoints passed up to the new offline foreground check, which failed
after69s without reaching the generic error. iOS authenticated A/restart/sites/
invoice/line and real external PDF GET without bearer passed, then its return
header seek failed; there was no postreturn detail GET in the available log.
No viewport-vs-session root cause is claimed from those incomplete observations.

A stalled SDK session operation was independently reproduced as an unbounded
busy state: its deadline previously began only after Auth completed. The whole
caller wait now shares20s and Auth transport headers+body are bounded10s.
Cancellation discards late response/body results in all customer paths and keeps
uncertain actor-bound mutation attempt keys. Six timeout/privacy regressions
failed before repair. Review found a further real SDK late-login persistence
race introduced by detaching the caller wait; a real SDK delayed-login test
reproduced it. Client-owned Auth cancellation and raw-SDK task tracking now
serialize subsequent operations and make logout remove the session AFTER any
already-started persistence. A second real SDK delayed-storage test verifies
this ordering. Native storage completion itself is not universally time-bounded;
logout remains blocked until confirmed cleanup, preserving fail-closed behavior.

The iOS return test now snapshots after actual PDF receipt, normalizes to the
customer heading, seeks the exact own invoice downward with60s bound, and
requires a fresh OPS read. Reconnect/support return use the same scroll
normalization. Customer root testIDs contain only finite resource/loading state;
failure artifacts export strictly fixed booleans, never raw native text/inputs
or hierarchies. Android now captures the same bounded failure observations.
No customer assertion or external PDF/handoff requirement was removed.

Both independent reviewers cleared the prepared race/privacy repair after the
reproduced blockers were fixed. New exact-commit preflight, full same-backend
acceptance and both production native builds are required; d919 artifacts are
superseded by this common app code change. Positive consumption, Apple signing/
TestFlight/physical iPhone and authenticated production access remain separate
unverified requirements.

The next attempt66d86c0 exposed a real portable-export omission: the explicit
allowlist excluded the two new helpers (CI42977311137 TS2307). A relative-import
closure regression reproduced the missing dependency before adding both files.
The actual exporter has now been run outside the repo, followed by its own
locked npm install, extracted typecheck and Android+iOS JavaScript exports, all
PASS. This is additional source/export evidence, not native binary acceptance.

A second native-specific issue was reproduced using the locked WHATWG Response:
its ArrayBuffer-backed JSON decoder corrupted UTF-8 names/emoji. Auth transport
now buffers through response.text under the same10s cancellation/deadline and
reconstructs a string-backed Response. The actual native-polyfill Unicode
regression failed before and passes after;78 lifecycle/adapter and91 canonical
native-only tests pass without root dependencies. Both independent reviewers
cleared the prepared UTF8/export patch. The confirmed portability failure and
Unicode bug invalidate66 as a release candidate. Replace it only after the
complete fixed matrix, actual extracted exports and exact-source reviews are
ready; record any superseded runs as terminalCANCELLED, never PASS. The next
candidate must complete full coherent runtime verification and new production
builds. Do not sign or deliver66 production builds as final.

## 1c terminal follow-up: verify foreground after external readers

Run42980471856 is terminalFAIL with12HTTPcore/18features/2resilience/
2document-link cases and13Androidcore cases PASS. Actual final observations show
own invoice-PDF GETs for BOTH customers on BOTH platforms, without bearer.
Android fails AFTER its B-PDF receipt at launch()+seek_checkpoint (traceback
line92); its captured hierarchy has no Gridex text/resource markers. iOS reaches
A's exact invoice return+fresh read, B contract/site/invoice and B-PDF GET, then
reports Unknownerror without a B-return screenshot. This proves a post-reader
foreground verification gap; it does not prove a particular OS/driver root cause.

The Android harness now waits for two external-reader frames after the actual
PDF receipt, uses am start-W and two own-package frames to resume, and restores
foreground if a reader activates late during the data seek. Exact own/foreign
markers and a new OPS read remain required. A regression against archived1c
reproduced the old behavior scrolling the reader instead of reactivating Gridex;
all8 helper tests now pass, including late focus-steal interleavings.

The native shell has a nonvisual root testID, also asserted in guest smoke.
iOS external returns retry ONLY activation/root-id/stability at most3total
attempts; intentional lifecycle Home/restart/outage tests and customer-data/
fresh-OPS assertions are unchanged. Strict phase/package boolean observations
and allowlisted control-action/outcome/timestamp records add failure context
without exporting input/header bodies or raw hierarchies. PDF fixture filenames
are unique by validated document reference; name collision is not claimed as
the observed cause. Linux/Mac job bounds are105/90min and Mac terminal wait60min
to fit full journeys, observed slow simulator startup and bounded activation
attempts. Endpoint timeouts and authorization assertions are not loosened.

Prepared validation:10Node evidence/security tests,8Android browser/foreground,
2input and4simulated-identity tests PASS, full YAML parse and7preflight groups
PASS. Two independent static reviews cleared the bounded foreground/privacy
repair; exact-SHA binding follows. All native builds must be refreshed because
the shell identifier changes the app binary. Prior1c signed APK and iOS archives
remain build-verified historical artifacts, not final customer acceptance.

### iOS driver bootstrap follow-up
The cba9a90 shared run 42990051259 passed Android's 13 core and 64 expanded checks but failed before iOS executed any customer test: Maestro raised LocalXCTestInstaller$IOSDriverTimeoutException after 180 seconds and produced no JUnit report. Increase only driver startup to 300 seconds and allow one retry only for that exact exception with no report. Started journeys and ordinary assertion failures remain terminal. Four shell-stub regression cases verify retry bounds, report gating and failure propagation.

### Production iOS step deadline follow-up
Run 42997847622 on a5891b1 ended FAIL at the 15-minute simulator-step deadline. Its preserved real JUnit nevertheless contains one SUCCESS (108 seconds), and the receipt is bound to a5891b1; simulator data migration/boot alone took 324 seconds before driver startup. The simulator/device binaries and production configuration independently pass actual-file checks. This is artifact-scoped evidence, not a green workflow. Give the full bootstrap + one permitted driver retry + guest UI step 25 minutes; keep the driver and journey limits unchanged. Export only the fixed first-bootstrap log filename through the existing sanitizer, with credential-redaction regression coverage. Await the current shared run's terminal result before starting the next coherent candidate.

### iOS notification navigation follow-up
Shared run 42997847692 ended FAIL with iOS missing Dokument. It executed real A/B journeys, both invoice-PDF returns and lifecycle recovery first. The notification-read screenshot shows the Förbrukning tab; the sanitized server log has the iOS notification GET but no subsequent notification-read POST. The previous negative-only disappearance assertion therefore did not establish a write. Center the notification write and refresh targets away from the persistent tab bar using the pinned Maestro centerElement option. Require the notifications resource identity, a valid read timestamp, explicit refresh, the same timestamp field and fresh OPS observation before the notification screenshot. This fixes test targeting and closes the false-positive assertion; it does not claim a product notification API defect.
