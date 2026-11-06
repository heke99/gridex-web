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

Whole-native-source export packet: scripts/export-mobile-app.mjs plus root
mobile:export command, explicit file allowlist, neutral/alternate branding,
validated app identifier/scheme, refuse existing/in-repo/symlinked destinations,
source-component symlink validation and SHA-256 manifest. Copies no environment,
customer data, web/server credentials or Gridex branding. Backend integration
contract is documented, not provisioned. Isolated /tmp export successfully ran
npm ci --offline, tsc, Android Hermes and iOS Hermes without original repo imports.
Five new export regressions pass. CI adds a separate extracted-native job.
This supersedes the earlier full-native-source-extraction gap; backend migration,
real provider/device qualification and signed builds remain open.

Four-part continuation: configurable validated native API prefix; exported
OPS-free Request/Response customer backend (verified binding, field projection,
body bounds, safe provider status codes, optional writes, read-only synthetic demo);
actual native web contract action buttons; Gridex preview activation/readiness.
GRIDEX_MOBILE_API_ENABLED=true added to Vercel gridex-web ONLY preview branch
codex/mobile-portability-20261106 (team_e3htkJPyBNSw3Ix1KQLlf180). Existing env key
names checked without disclosing values. Production remains disabled. Native hook
successfully read profile through independent handler without OPS; real Gridex
customer/device test not performed. Live API gate still fails mixed versions:
release/spec/guide2026-10-12.1 vs runtime2026-10-09.1. Do not weaken it. Generic
native template uses optional EXPO_PUBLIC_CONTRACT_WEB_ORIGIN (no web assumption).

Verification follow-up: 104 local targeted tests pass; native-shell,
standalone-export and portable-native-export passed GitHub CI at880d196.
Vercel dpl_DzoJtSF5mWzH3xGmQdFtkoFHjrJF is READY. Authenticated Vercel fetch
of contracts?customerId=foreign returned400 with private/no-store from mobile
handler, confirming preview flag is active. Ordinary direct checks return302
(protection), not public API ready. Tool's unauthenticated401 fetch was classified
as auth wall; do not treat it as a verified customer check.
Broad CI contract job fails mixed OPS manifest; verify job failed npm audit11.
Applied root Next16.4.5, fast-uri^3.1.9, targeted estree/minimatch^11.0.5,
zod^4.6.7; no force/downgrade. Root npm audit now0. Root typecheck/lint,
api:contract, test:customer-support and test:audit-hardening pass after update.
Root Next16.4.5 production build passed; built-server mobile guard checks18 passed
without real credentials. Support webpack build compiled and typechecked. Root
npm audit0 is specific to root lockfile, not a claim about all exported installations.

Current continuation corrects prior blocker diagnosis: OPS documentation/wire
versions are intentionally independent (verified upstream source constants and
live x-contract-schema-version). Web incorrectly enforced equality. Added doc
constant, exact manifest/spec/runtime/floor/hash validation, synced real live
specs and generated types. api:preflight now passes with no upstream gaps or
environment blockers. Runtime9.1 / docs12.1 are both validated. OPS repo unchanged.
Old producer commercial JSON is preserved; current test server metadata uses wire
constant and downgrade rejection is explicitly asserted. Customer support fixture
uses current Customer wire while separately pinned Staff schema remains unchanged.
Native daily prices added with optional buyer provider, zero/negative/missing/DST,
duration weighting, race/background/error tests. Real Gridex SE3 feed returned96
intervals and passed actual native parser. Browser observed /login?next=%2Fdashboard,
no user authenticated; auth capability guidance read, credential handoff not yet
requested. Never obtain or echo user credentials/tokens. Production/mobile device,
consumption and native signing are still not qualified.

User clarified they have no Gridex account and wants continued app work. Browser
secure sign-in was declined; do not retry/request credentials again. CUA check
ended without login. Explained this is customer app, not OPS operator app.
At73522e all GitHub jobs passed (verify/contract/support/native/standalone/portable),
preview dpl_62J7TZAjqiq2Rtm5aSbBrbAMJdAk READY. No production activation.
New packet implements native phone edit and notification-read writes with bounded
closed payloads, verified subject/RLS identity, canonical OPS accepted/profile_updated
and notification read-back checks. Native generalized write pipeline retains retry
keys for malformed/uncertain confirmation and checks epochs after completion.
Neutral backend adds optional phone / notificationRead provider writes; demo remains
read-only. Tests cover actual adapters/routes, caller binding, field injection,
body limits, provider errors, retry identity, malformed timestamps, late logout
and PhoneEditor rendering. No real customer change/email/account creation performed.
Latest packet local results:71 pure/export/backend/account tests,24 actual mobile
route/projection tests,28 native hook/adapter/UI tests and4 release-revision tests
=127 unique targeted checks passed. Root/native typecheck, lint and Next production
build passed. Six built-server POST guard checks passed (unauth, identity query,
unconfigured provider on both profile and notification read). Gridex Android/iOS
Hermes exports passed. Isolated export verification started from locked dependencies.


2026-11-06 continuation: user explicitly authorized packages1–2 to production,
multiple testing methods and two reviews. Implemented ConsumptionPanel with facility,
7/30 Stockholm calendar-day selection, DST tests, chart/fetched totals, partial-state,
retry and stale/logout/background guards. Portable backend consumption contract
requires authoritative verified delivery windows, excludes crossing intervals,
rejects duplicates/overlapping revisions/foreign facilities. Gridex route fails503
BEFORE raw readings because main AND deployed OPS source 8969f01 lack the required
facility delivery-right DTO/guard. No direct OPS DB access and no OPS edits/deploys.

Release inspection caught production Web7c215d13 containing47 commits beyond
GitHub main1fc033e. Merged actual deployed lineage, retaining all portal/privacy,
Support recovery, invoice, cache and SEO code/modes. Shared deployed OPS SDK,
Staff runtime, response profiles4.1/9.1 and migrations are byte-identical to deployed
baseline. Strict three-spec docs/wire/hash/source checks retained and live-resynced.
Updated fixtures to represent supported profiles and correct canonical URLs;
unsupported versions, missing business identity and mixed header/payload still fail.

Two self-reviews (security/data and UI/integration/export) completed and repeated
against actual production base. All executed CI green at 921aca405b48524d33a7b5dea6fdd5a63ce0cb8b.
PR #56 merged 84278b717029424c3cb4b7d6e6e08a9d293f72b5, identical tree 061c6237.
Production mobile flag true, existing Web deployment dpl_97r9w3PvvjavCfpHgJiUEVyjBujw
READY, gridex.se/www aliases confirmed.30/30 public HTTP guards PASS. Signup canonical
redirect, login, public contracts and96 real SE3 intervals PASS. Short production
error scan found no runtime errors. No real customer account, mutation or signed
device qualification. Local/CI root/native types, lint, regression/browser/security,
Turbopack+webpack/Support builds, Gridex and extracted Android/iOS exports pass.

Next: authoritative OPS facility delivery windows/revision-safe readings adapter
under current OPS custody protocol; then authenticated two-customer readback with
provisioned customer identities. Do not claim complete packages1–2 until these
blocked checks pass. No credential handoff re-request. Native signing/switching
and signed store builds remain packages3–4. Evidence docs/mobile/release-package-1-2.md
and quality/mobile/package-1-2/. Final evidence commit is docs/reports only.

Continuation after user asked to keep working packages1–2: read actual OPS source,
canonical customer_supply_periods schema and current board#840 (766 full at2500).
Prepared official private source plan, validated only. No gh CLI/token/credential
provider or connector atomic tag-ref creation capability, so no OPS claim/write.
Exact relevant file-ref404 is not ownership. No foreign resources modified.

Web packet adds actual scoped opsConsumption loader, proposed complete per-facility/
per-meter delivery capability, revision/direction/unit checks, per-meter rights,
bounded cursor loops and partial cap/deadline. Initial capability request is a
published base path without queries. Real published validator confirms current
paging/filter queries unavailable; no exemption added. Legacy OPS remains503.
Neutral/native consumption gains optional public series with matching rights and
per-series overlap checks. Two independent non-coauthor reviewers approved final
consumer after reproducing/fixing multi-meter overlap and documenting query gate;
final approvals include post-read deadline check.26 focused tests pass, actual
route tests still synthetic Auth/provider; no real account or live OPS readback.
Required upstream source/query/publication handoff is recorded in docs/mobile/
ops-consumption-required-contract.md. Full packets remain unqualified until that
publication/contract sync and actual customer verification. Keep production API
active and publish safe consumer packet after candidate CI; do not call blocked
real consumption complete or silently write OPS outside custody.


Publication completed: PR57 head967d09ae8fa4615940066b6e31bc4bb42e489cf8 had all
executed CI SUCCESS (CodeRabbit skipped). Merged35b2946b96876b5369a383265ea15bf42606d33c,
exact same reviewed tree. Vercel productiondpl_3zHRj3GSEoz8s7BMkZh3rBbgfp9r READY,
gridex.se/www aliases confirmed, existing production mobile flag enabled.
30/30 public guards pass after deployment (four execution shards, unchanged
assertions/case set); short runtime error scan none. Exact clean-source mobile
report and production evidence under quality/mobile/consumption-adapter/.
No OPS source/claim/publication or real-customer session achieved. The unused
private initial source plan is paused and must not be executed unchanged as if
it covers the full newly identified query-schema/publication scope. Next actual
boundary: authenticated normal OPS source reservation/publication by a capable
producer, then Web API sync and actual customer verification. Consumer code and
independent OPS-free exports are delivered; full packages1–2 are still not done.
