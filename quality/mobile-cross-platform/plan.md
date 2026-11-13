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

### Sibling-artifact transport follow-up
In shared run43006044521, the iOS job failed before simulator/customer-test startup: a single `gh api .../artifacts` read exited1 while awaiting Android's still-running terminal marker. Artifact upload also reported transient request timeouts. The former uncaught read made this network failure terminal. Actual CLI regression with a synthetic first-read failure is RED against37b134f and GREEN against the repaired waiter. Bound each list/download invocation, retry at most six consecutive failures within the original overall deadline, retain generic errors without upstream output, and publish only a complete nonempty staging download. Android-terminal waiting gets40minutes to cover the measured ~30minute Android job after a faster iOS build; iOS-terminal60 and fixture25 remain unchanged. Six new regressions cover transient list/download failure, repeated failure, empty/partial downloads, late Android completion and overall deadline; total20testsPASS. Current shared run must reach terminal cleanup before the next coherent candidate starts.

### First-login diagnostic follow-up
Shared43010633625 failed at the first iOS A-contract checkpoint after156seconds. Exported native flags establish guestlogin+controlledreaderror+idlecontracts, not an authenticated customer; the A marker may be the synthetic email input. No iOS customer HTTP request appears after Android's completed77PASS. Actual Auth response/transport/storage cause is not proven by existing evidence. Keep that distinction: do not attribute this to bad credentials or a timeout without observation. Add isolated-gateway-only Auth operation/platform/status/body-completion outcome/time and exactsyntheticcredential-match enums, bounded8KiB password-body observation with unchanged streamed-byte forwarding. Never retain/export body/token/header/rawerrors. Observe response end or abort, not merely headers200. Require complete entered email before submit in both native logins.22device/evidence tests pass, including an actual streamed-proxy byteidentity/UTF-8 regression and fixedschema redaction. No app/Auth deadline or customer assertion is weakened; the next full run will either produce diagnostic failure evidence or coherent runtime evidence.

### External PDF observation deadline — proven failure
Shared43017832643 is terminalFAIL with Android77PASS. New Auth observations prove exact A and B credentials, complete200responses (124ms/109ms), real refreshes and A/B customer UI. It did not reproduce40's unclassified initial-login failure. The actual failure is now bounded precisely: assert-invoice-pdf-b started1794401729426 and failed1794401749455 (~20seconds); B's real iOS PDF GET without bearer arrived1794401752104 (~22.7seconds after assertion start). No B-PDF return/fresh-read PASS is claimed. Increase only read-only external browser observation to a bounded60seconds, retaining exact expected reference/path/platform and explicit no-credential predicates. Use the same helper for cold browser handoffs formerly limited10seconds. PinnedMaestro2.12.1 GraalJsEngine uses5minute read/write/call timeouts, so this60second server wait remains within its client limit; no unsupported per-request timeout option is added. Regression rejects the measured22.7second arrival with old20second budget, accepts it at23seconds with new60second budget, and still rejects missing/foreign/wrong-platform/credential-bearing observations through deadline. No customer/API/Auth deadline is increased and no journey is retried.

The external-handoff audit additionally found a pre-existing falsegreen: repeated /dashboard/support checks could match an earlier request. Every iOS external handoff now snapshots the exact matching count before tapping and requires an increase afterward; the JS baseline is bound to the expected handoff kind. Recovery adds the same real-request assertion alongside its existing page-heading assertion. Historical, wrong-path and credential-bearing requests cannot satisfy the new baseline.

## Resumed 12 November 2026 after terminal94 results

The user resumed the task. All five separate94a73d8 quality/build workflows ended SUCCESS; coupled43026097384 ended FAIL with bothcleanup stepsSUCCESS and AndroidstepSUCCESS. Downloaded exactartifacts shared-94a73d8-failure / ios-customer-94a73d8-failure. iOS screenshots prove both invoicePDFreturns, offlineforeground preservation/recovery, phonewrite and notification positivefreshreadback. Lastsuccessfulcontrol disable-document-b thenJUnit fails `Element not found: Öppna dokument i extern läsare`. The flow had scrolled only to the documenttitle, never the action below it beforedisablingtheupstream. No productAPI failure is inferred. A viewportregression is RED against94 andPASS after preparing/centeringthecachedbutton before upstreammutation. Audit remaining unexecuted contentactions: explicitviewportpreparation for filters, scopedcaseopen, secondcomposerfield, newcaseopen andpriceretry, pluscenteringexistingcontenttargets. Fixedbottomtabs andpreviouslypassedearlyA/B/lifecycle sequencesremainunchanged. Documentreaderreturn now requires ownBdocument, absenceofA andfreshOPSread before screenshot. Userhandoff11Nov preserved ashistorical and included nowthat a newcodecandidate isauthorized.

### Refresh viewport normalization after terminal e07

Shared run 43260518653 ended FAIL. Android's actual receipts contain 77 PASS;
both cleanup steps succeeded. The iOS stale-document-denial screenshot now
exists, disable/restore controls passed, and the sanitized Web log ends with
the expected document-open 503 followed by a document-list GET 200 (158 ms).
There is no subsequent document-open request. The failure is after the restore
and refresh, at the fixed UP search for the opening action. It is distinct
from the earlier failure before the stale-link click.

The loader clears private rows before fetching and remounts them afterward.
This can clamp the scroll offset while the content is absent, so an old
direction cannot establish where the remounted action lies. A bounded helper
waits for the expected resource idle marker, normalizes to Mina sidor upward,
then seeks the expected positive own field downward. Apply it to document,
phone, notification and support readbacks and the support return to list.
Retain positive readback, exact own references, foreign-data checks and fresh
OPS observation; add snapshots/fresh assertions where they were missing.
No refresh or write is replayed to fix targeting. Normalize market entry and
retry to Spotpriser before seeking its control, and reveal conditional future
data and empty-filter output explicitly. Product/Auth/API code is unchanged.

A geometry/sequence regression models both clamped and retained offsets: it
fails against e07's UP search and passes after normalization. All 28 device
and evidence tests and full Maestro YAML parsing pass. This model is not
emulator evidence; final qualification still requires a new coherent run.

### Lost customer evidence on 267854f

Shared run 43271860023 ended unqualified. Android's current receipts contain
77 PASS and all five separate build/quality workflows succeeded. The customer
iOS job exited 1 at 18:39 UTC, but both terminal and customer-evidence uploads
failed CreateArtifact with ENOTFOUND. Its actual JUnit and failure cause are
unavailable. Do not infer a product, viewport or network cause for that test
from the upload error. The successful production guest iOS artifact is a
different evidence subset and cannot replace the missing customer result.

The Linux job waited for the missing terminal. A normal cancellation request
at 18:42 did not interrupt its always() wait promptly; the runner was eventually
cancelled with explicit cleanup still pending and no final server artifact.
Cleanup is not verified for this run. GitHub CLI access is working again,
verified through authenticated read and the ordinary cancellation endpoint.

Preserve a bounded public failure summary immediately after successful UI
sanitization: one escaped JSON line, at most 8 KiB, only sanitized JUnit/log
text and allowlisted boolean markers. A sanitizer failure emits fixed text
only, never a private fallback or parser error. Preserve the original nonzero
UI exit and never create a PASS receipt for failure. The terminal waiter can
observe the exact iOS producer in the current run-attempt; if it is completed
and the terminal is still missing after 60 seconds of delivery grace, fail
generically so the normal always() cleanup and server upload can run. Missing,
running or unavailable producer status is not evidence of completion.

Retry only the two iOS artifact uploads, once each after 15 seconds. Retries
overwrite only the same owned artifact name to cover ambiguous upload commit.
All four attempts require actual files, and a final gate requires one actual
success for each artifact. No customer journey, mutation, Auth/API deadline or
product code is changed or retried. Exact-attempt producer status does not
change the existing run-wide artifact-name lookup: coupled replays must use
a fresh push/workflow_dispatch run ID, not mixed artifacts from old attempts.

Actual shell regressions fail on the previous missing console diagnostics,
sanitizer exit/privacy handling and hour-long missing-terminal wait, then
pass after repair. All 36 device/evidence tests, full affected YAML parsing,
Bash syntax and diff checks pass. Both independent static reviews cleared
the repair after requiring if-no-files-found:error on all four upload steps.
The underlying lost native failure remains unknown; the next fresh coherent
run must provide the actual complete result or actionable sanitized failure.

### Initial activity and customer-resource selection after terminal 8374b91

Fresh shared run 43285631623 ended FAIL, with both explicit cleanup steps
SUCCESS and all server/iOS artifacts delivered. The new public console
summary preserved the actual iOS JUnit as designed. Five separate workflows
and actual production-file audits passed. Same-source HTTP results contain
12 core, 18 extended, 2 timeout and 2 document-link PASS. These subsets do not
make the failed coupled run qualified.

The Android traceback underlines the original first wait_for('Gridex El') at
OPS helper line 83, before Mer or any login. Its artifact contains only the
APK and successful credential-isolation check, with no scenario receipts.
The actual test APK has the expected x86_64 ABI, package, SDK and activity.
There is no captured hierarchy/crash proof; do not infer an Auth/API or app
crash cause from the absent heading. A Web-owned wrapper now validates the
whole pinned helper SHA-256 (84d4f0f81e5febaa04c2a05c0c9204080980a7b51584d47f16ea233777d6a2d2),
loads its original definitions with the original __file__, replaces only
launch with bounded am start -W activation and two stable own-package frames,
then executes the complete unchanged original body/finally exactly once.
Keep the original heading wait and all 13 core checks. Each new ADB call is
bounded; at most three activity activations fit within 30 seconds. Failure
exports only fixed boolean observations and a validated source SHA, never
raw hierarchy, logcat, command arguments, process IDs or login values.

iOS passed A/B, both invoice-PDF returns, lifecycle/outage recovery and phone
write/fresh readback. Its JUnit then failed finding NOTICE_B. The sanitized
server log ends with profile POST 200 and profile GET 200, with no subsequent
notifications GET or POST. Resource selection was not observed; no failure
of the notifications API or exact obscured tap coordinate is established.
Use one finite label/resource-pair helper for all ten existing customer tab
transitions: normalize to Mina sidor, center the chosen tab downward, settle
animation, request one tap with retryTapIfNoChange:false, and require the
expected resource idle marker. Retain every positive own-data, foreign-data
and fresh-OPS check in the caller. The fixed bottom navigation is unchanged.
An allowlisted synthetic authenticated-panel screenshot records the prepared
target; no login/password screenshot is introduced.

Seven Android core-driver tests cover the old early-return readiness model,
all original body/finally checks running once, hash/marker rejection, finite
activation and ADB bounds, rejection of late frames and private-value-safe
diagnostics. The late-frame case was RED before its deadline check and GREEN
afterward. All 37 device/evidence tests and 8 browser, 2 input and 4 simulator
identity tests pass; affected YAML/Bash/diff checks pass. Both independent
static reviews cleared the exact implementation. This remains a bounded
test-driver repair awaiting real native acceptance, not a proven crash fix.


### 2026-11-12: wait for completed iOS logout before process restart

Candidate 847c5bb shared run 43295865407 failed the iOS guest assertion after
A logout/restart. Actual sanitized state showed authenticated A on contracts;
the evidence does not distinguish a missed tap from process termination during
asynchronous session cleanup. Android passed all 77 checks, and both jobs
completed their explicit cleanup steps. All five other workflows passed.

The iOS journey now centers the logout control, taps once without automatic
retap, waits for the guest heading and the existing invoiceDetail idle marker,
and rejects the logout-failure control and A data before terminating the app.
The hook reaches idle after secure-storage signout completes. The original
restart, guest and no-A assertions remain mandatory. Independent read-only
review confirmed this completion boundary; a fresh coupled run is required.


### 2026-11-12: prepare all remaining scrolled iOS action targets

Candidate aaecc0e shared run 43305792298 is terminal FAIL. Android passed
77/77, all five separate workflows passed, and both explicit cleanup steps
succeeded. Actual iOS screenshots prove completed A logout/restart, B login,
B invoice PDF, expiry, background and network recovery. The next failure was
the positive phone-save notice: authenticated B idle, final profile GET 200,
no subsequent iOS profile POST. Evidence cannot distinguish missed input,
disabled unchanged input and a missed button tap; this is not an API-failure
or precise-coordinate diagnosis. Android B used +46744444444, distinct from
the intended iOS +46755555555.

The phone journey now requires the full escaped literal input value, centers
and settles both input/save, takes a fixed authenticated target screenshot,
clicks once, waits for profile idle and positively seeks/asserts the saved
notice. Existing fresh GET, canonical phone readback and OPS checks remain.
An audit prepares the same demonstrated viewport class throughout the rest
of the journey: 15 formerly uncentered scrolled interactive targets are now
centered, and 54 scrolled clicks settle and explicitly disable retapping.
Fixed bottom navigation and all original selectors, mutations and assertions
are preserved. A decoded before/after comparison confirmed original command
order/semantics, permitting only deterministic viewport preparation and the
additional positive phone checkpoints. No API/Auth deadline is increased.

Only the fixed authenticated profile-phone-target screenshot joins the export
allowlist; login/password targets and arbitrary raw hierarchy remain excluded.
The existing sanitizer privacy regression now exercises both cases. A fresh
complete coupled run, actual artifacts and final reviews are still required.


### 2026-11-12: derive price expectations when that journey starts

The next coupled run can cross Swedish midnight before iOS reaches prices.
The old runner fixed today/yesterday/tomorrow before the entire native journey,
while the app recomputes its Stockholm calendar day during render/refresh.
The isolated price stage now reads the canonical default business day from
the public price endpoint at that stage, validates it and derives adjacent
calendar dates. Future publication checks use the same phase date. Both
scripted probes set a fixed non-native user agent and no authorization, so
they cannot substitute for actual Android/iOS price-request evidence.
The stale job-start date environment is removed; native price UI, nonempty
prices, interval/retry and future publication assertions remain unchanged.
Calendar-boundary tests cover midnight/date change, year rollover, leap day,
DST day, invalid dates, unavailable source and absence of phase initialization.
No production app, gateway, Auth or API behavior changes.


### 2026-11-13: fix the original document restore and reuse qualified Android

b270ddf shared run 43317701063 is FAIL with both cleanup steps SUCCESS.
All five other workflows and Android 77/77 passed and remain approved.
iOS passed the phone and notification writes/readbacks, then restored the
document fixture and fetched it successfully but could not find its open action.

The concrete fixture bug is environment ordering: stack.sh starts the gateway
before exporting GRIDEX_DEVICE_PUBLIC_ORIGIN. The old gateway restore therefore
wrote the literal undefined/qualification-document/... string. The database
accepted that text; the Web validator correctly marked the document unavailable.
A loopback HTTP regression with the origin absent reproduced that exact bad
value before the fix (RED), then restored the original URL after it (GREEN).
The control now reads exactly one synthetic row before disable, validates its
ID/HTTPS tunnel URL/owned document reference, patches by company/title/ID and
keeps the original snapshot only after a successful disable. Restore requires
that snapshot and unchanged browser count; double disable/restore is rejected.
Two focused control tests cover actual GET/PATCH, unsafe/foreign/ambiguous
snapshots and stale-link browser requests. Production app/API code is unchanged.

Latest user instruction: do not repeat approved Android tests or builds without
a relevant change. A new stacked qualification PR targets the b270ddf feature
branch, so its fixture-only diff does not retrigger Android or iOS production
builds. The shared job authenticates and hashes the immutable reference server
archive 13993066937 from run43317701063 (SHA256 6623f87fe67f50123798eebaea409a7e65b447be6a83d8394e95c5b48dbefb01),
verifies b270ddf/OPS6819 and all 13+64 Android checks, credential isolation and
10 Android system checks. Source equivalence rejects any changed product or
Android driver input and compares gateway bytes outside the iOS-only document
control. Qualified reuse skips Android native dependency/preflight/emulator
steps; source changes require fresh Android, while invalid/unavailable reference
evidence fails without starting duplicate tests. GitHub reads alone have bounded
transport retries. Reused receipts explicitly preserve the old source/run.

Fresh HTTP, full iOS journeys and all iOS public-reader observations remain
mandatory. Current iOS proof cannot be supplied by cached Android observations.
Seven focused control/reuse regressions pass, including wrong source/OPS,
missing/failing/duplicate checks, changed proxy/product, digest substitution,
foreign terminal and absence of fresh iOS observations. Existing b270ddf
production artifacts and other unaffected results are preserved, not rebuilt.

Main branch metadata currently reports protected=false and no required checks.
After successful new qualification/reviews, normal merge of PR68 is supported
by the new proof on identical production code, then the fixture PR is retargeted
to main and normally merged. This avoids synchronizing the original feature
branch and triggering its unrelated native builds again. Re-read refs/policy
before mutation; no forced merge, fabricated status or policy bypass is allowed.


The reuse exception also pins the reference workflow bytes
(11b5a9ded609fb15a0af3529d073eb84d0cb9d9e025b9158a70a7e98821c23b1)
and reviewed current workflow bytes
(a73079ca53397ccfbccbf5b72bddd74852169c06518fae9deec8d6a94fecf08e).
Changed SDK/emulator/Java or any unreviewed workflow bytes cannot reuse
this proof. These digests are included in the receipt and rechecked before
importing cached Android system checks. Both independent scoped reviews
are clear. Only affected control/reuse regressions and changed-file lint
are repeated; unchanged Android/native/typecheck suites stay approved.
A local end-to-end proof-gate smoke using the actual pinned public archive
is required before pushing, to confirm it selects reuse instead of an
unnecessary Android run.


### 2026-11-13: bounded iOS read activation; preserve production iOS builds

7837fa7 run43330390627 failed before reaching the repaired document control.
Android was correctly REUSED/SKIPPED, all three quick gates passed, and both
explicit cleanup steps succeeded. The actual iOS failure was No visible element
found: Hämta igen after disconnect, while the sanitized hierarchy still contained
the read control and B invoice content. No post-disconnect retry request reached
Web. This establishes a failed native read action, not an OPS/API failure; exact
viewport/animation timing is not established. Earlier b270 native core, phone
and notification proofs remain scoped and valid on identical production code.

Seven read preparations now use a dedicated helper: await the expected resource
idle, normalize to Mina sidor, reveal/center Hämta igen, capture the existing fixed
authenticated diagnostic and dispatch once without the extra animation wait
between reveal and tap. A maximum of two extra attempts repeats only this
idempotent read preparation, never a write or whole customer journey. All seven
plain foreground activations use the existing bounded app-shell resume helper.
All original operations, positive readbacks, foreign-data exclusions and fresh
OPS assertions are preserved in order; decoded before/after comparison passes.
The changed activation/read behavior warrants fresh iOS verification, not new
Android or production builds. Focused tests simulate a relocated target, bounded
failure and preservation of every original caller assertion.

Customer-only iOS YAML changes otherwise trigger the production-iOS workflow.
A lightweight source/metadata proof now reuses the actual already-verified b270
production archive from run43317701158/artifact13990897235/SHA256
3e207110fd41ffe5e9fd46f022d8aeeeb7d3a68d779c9cce5903870e5e22317d.
It requires identical production inputs, exact reviewed workflow bytes and
authenticated successful source/run/immutable artifact metadata; a failed proof
does not start a duplicate native build. Relevant input changes still require
a new production qualification. The archive, guest UI and distribution limits
remain credited to b270, never reported as freshly built on this candidate.
Android reuse additionally allows these reviewed iOS-only test/guard files,
while unchanged product/Android input and exact shared-workflow checks remain.
Eleven affected regressions pass. No Android emulator/build or iOS production
build is repeated to validate the new control/guard logic.


### iOS footer visibility adjustment after 058e2db

Run 43337964821 finished FAIL: JUnit 12m16s, no visible Hämta igen in invoice read refresh. Both credential/stack cleanup steps succeeded; Android77 and production-iOS artifacts were reused, no new Android/native production run. Actual iOS artifact13999268294 SHA256 e4d06f5d0439a06bd48fa93aa8badc4371a309466ea456c60731cf846cb3e731; server14000596425 SHA256 0d3afed20790e77f673a87e923ee2f21f63436d9245c1288be930156f483bbda. HTTP core12/features18/document2/resilience2 PASS; current full iOS remains unapproved.

The previous target PNG was from an earlier resource selection, so it does not establish failing scroll geometry. Pinned Maestro2.12.1 Orchestra.scrollUntilVisible performs up to four extra centering swipes before normal visibility fallback; the short15s bound could expire first. Geometry remains a hypothesis. Refresh now requires fully visible footer without centering, allows60s scroll with500ms settle, and overwrites the same authenticated allowlisted PNG before searching, so any failed search has current viewport evidence. Bounded GET-only retry, exact resource idle, all original positive/negative/freshness/write checks are retained. No product, Android, production recipe or reuse allowlist/hash change. 11 affected checks and changed-file lint/diff PASS; both scoped read-only reviews clear. Only affected iOS/HTTP qualification is rerun.
