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
