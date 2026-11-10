# Cross-platform qualification

Mandate: attached user prompt, 11 November 2026 (Europe/Stockholm).
Source: Web main c0bcafbbad547cbb0c2b3f17ffb1ca1030c4f62f; OPS PR1047
81e9e6a39536c6787dcfd217a4d5be43a0aa343e. Read remote refs before delivery.

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

Known baseline blocker: unrelated unchanged Ediel retention browser test prevents
OPS1047 merge. It does not invalidate the separately green core integration run
42912180714. All expanded scenarios need their own current terminal result.

Current next action: implement platform build/UI harness and expanded fixture/API
coverage, run regressions, then version-pin and execute final qualification.
