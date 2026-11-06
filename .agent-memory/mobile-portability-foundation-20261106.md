# Mobile app portability foundation – 2026-11-06

Owner: current root session. Scope is additive mobile foundation files only.
Base main: `1fc033ef791b5bb62ac6672576e64c83727c17d0`.

User decisions: website and native customer app share gridex-web and the existing
Gridex Web Supabase project/accounts. OPS keeps its own repository/database and
is consumed through its API. Mobile template/layout must be extractable later.
Buyer installations use their own credentials/data and OPS tenant or compatible
API; a template export never copies Gridex accounts/customers/secrets.

Implemented: dependency-free public brand model, provider-neutral interface
contracts, separate Gridex brand configuration, allowlisted standalone foundation
export, portability tests and CI job. Masterplan updated to v2 in docs/mobile.

Validation: Node v24.22.1, six focused runtime/export tests PASS. Exported package
tests run in a fresh directory outside the repository. Tests cover two independent
brands, forbidden config fields, unsafe URLs/themes, standalone export, refusal
of existing destinations and paths into the source (including parent symlinks).
Source syntax and whitespace checks PASS. No root dependencies or web runtime
paths changed. Whole-web tests/build, Node22 CI and native builds not run locally.

No database/hosted Auth changes, migration, live customer read, deployment or
production activation. This increment is a portable foundation, not a working
native customer app. Source remains separate from production until qualified.

Next: integrate Expo runtime, actual shared mobile layout and guarded per-brand
build configuration; then Supabase Auth adapter against existing Gridex accounts
and server-verified OPS customer overview. Test every added package in standalone
export. API gaps for contract change, price series and summaries remain in plan.


Continuation: added Expo 58 native shell, independent locked dependency install,
brand-driven five-tab layout, isolated TypeScript config and Metro sibling-package
watch boundary. Typecheck PASS; Android JS/Hermes export PASS (not an APK).
Six portability tests remain PASS. Added native CI typecheck and platform bundles.
Physical-device UI/Auth/OPS verification remains pending. No database changes.


Customer-flow increment: added memory-only Supabase login adapter/form, a contracts
view and a disabled-by-default bearer-authenticated BFF contracts route. BFF checks
Auth via getUser(token), reads customer_profiles with subject filter and user RLS,
and uses existing OPS customer transport. No client-selected customer identity.
Tests: six handler behavior checks PASS; root and native typecheck PASS. Live
Auth/OPS, portal binding and physical-device E2E remain unverified. No production
enablement, DB changes or customer creation. Mobile sessions are not yet persistent.

Final validation for customer-flow increment: root typecheck, focused ESLint,
Next production build (without provider credentials), Android and iOS Hermes
exports PASS. Six handler tests + six portability tests PASS. Three actual
production HTTP checks PASS in a child-server harness: absent bearer 401,
customer override 400, missing provider config 503, private/no-store responses.
No successful live Auth/OPS call or device-rendering evidence is claimed.


Four-part increment: SecureStore persistence/rotation, foreground refresh/privacy,
password-recovery handoff to existing tenant web flow, sites and invoices APIs/UI.
Shared generic bearer gate and RLS/OPS identity runtime; whitelisted projections.
Added actual hook lifecycle tests with React renderer and synthetic Auth/AppState,
secure storage behavior tests, client parser/recovery origin tests and API resource
mapping tests. No hosted activation, DB migration, outbound email or live customer
operation. Full pagination, invoice detail/PDF and device E2E remain pending.

Four-part final local verification: 25 pure resource/storage/parser/handler and
portability tests plus 7 actual-hook/adapter tests PASS (32 total), root/native
TypeScript, full repository lint, Next production build and both Hermes exports
PASS. Nine real production HTTP denial/configuration checks PASS across all
three resource routes. SDK singleton prevents duplicate refreshers on remount.
The previous remote Web verify failure was the owned CommonJS Metro config;
converted to supported ESM and full lint plus both native bundles now PASS.
Previous remote contract preflight is separately RED: published OPS release
manifest reports mixed contract versions. No gate weakened or contract blindly
resynced. New remote CI still required; no merge/release is claimed.

Invoice continuation: added subject-bound invoice-by-reference route and native refresh action. Typechecks and existing handler/resource regressions pass. Full invoice line/PDF projection, actual-route IDOR regressions and live detail envelope qualification remain pending; this is a draft increment.


Five-part packet: replaced flattened invoice draft with actual invoice/lines/docs
contract; added invoice lines UI, fresh authenticated attached-document link read
with exact HTTPS-origin allowlist, customer support list and public message detail.
Added shared portable detail types (included in foundation export), native parsers,
detail navigation/retry preservation and stale-document navigation suppression.
API evidence: actual OPS main invoice route and publicDto read in this session;
customer invoice response contains data.invoice, data.lines, data.documents.
No OPS source edits, producer changes, hosted DB operations or production activation.

Verification PASS: 38 pure tests + 13 hook/adapter tests + 8 actual-route tests
with synthetic provider boundaries (59); 27 existing support API + 9 handoff tests;
21 production HTTP denial/configuration checks; root/native TS, full ESLint,
Next build, Android/iOS Hermes bundles. No physical-device or live Auth/OPS success.
Limits: document reader/provider URLs require staging qualification, support is
read-only natively and message/list pagination remains bounded. OPS release-manifest
mismatch remains a release blocker, not waived. Next: pagination/writes and data
flows, plus actual provider/dev-build E2E; no production-ready claim.


Support-write/cursor packet: added bounded closed-body authenticated create/reply
BFF routes, OPS SDK mutations, native composer with stable process-local attempts
and confirmation-only reset, stale confirmation suppression, and case cursor paging
with deduplicated append. Messages cursor is absent from frozen local OpenAPI, so
no undocumented messages paging added. Native views/read boundaries retained.
No hosted writes, email delivery or API activation; all mutation tests synthetic.
Validation for support write/case-pagination packet: 43 pure tests, 16 real hook/
adapter tests with synthetic providers and 10 actual-route tests with synthetic
Auth/OPS PASS (69 total). Root/native TypeScript, full ESLint, Next production
build and Android/iOS Hermes exports PASS. No real customer mutation/email sent.
Native write attempts are process-local; no durable outbox guarantee. Case cursor
is documented; message cursor is not in the frozen spec and remains pending.

Next packet: five native read views (profile, notifications, documents, powers,
legal acceptances) plus fresh scoped general-document opening. API whitelist,
verified subject/RLS binding and disabled-by-default flag preserved. Sixteen actual
route tests + six projection tests pass against synthetic providers; eighteen
actual-hook/adapter tests pass including all five view transitions and URL-only
document handoff. Existing pure regressions pass. Native typecheck, root typecheck
and lint pass; Android/iOS Hermes export pass. Initial Next build hit a corrupt
local persistence cache; moved generated .next aside and reran clean. No live
customer/provider writes, new DB or production activation. Release qualification
and full-app extraction remain outstanding.
Clean Next production build passed; built-server HTTP checks passed (18 requests across all six new endpoints: unauthenticated401, query override400, unconfigured provider503, private/no-store). Total targeted tests: 83 (43 pure, 22 route/projection, 18 hook/adapter).
