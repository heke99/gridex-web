# Gridex customer mobile app

The native app lives in gridex-web alongside the existing website/support app.
Public branding is separate from portable types/layout and provider adapters.
Gridex reuses its existing Supabase project/accounts; canonical energy records
remain in OPS, reached only through the tenant backend. No second mobile
production database or customer copy is created.

## Local development

In apps/mobile run `npm ci --workspaces=false`, `npm run typecheck` and
`npm start`. Native dependencies are isolated from the website's React version.
A native development build is needed to exercise SecureStore on a real device;
Hermes exports alone are not installable signed apps. OTA updates are disabled.

The shell uses SafeAreaProvider/insets and iOS keyboard insets. iOS text fields
share an explicit keyboard-dismiss accessory, including phone-pad and multiline
support input. SecureStore uses the unlocked-device-only keychain class; no app
biometric prompt is implemented, so no unused Face ID permission is requested.

Public build configuration:

- EXPO_PUBLIC_SUPABASE_URL: the existing Gridex tenant Auth project.
- EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishable/anon key only.
- EXPO_PUBLIC_CUSTOMER_API_URL: HTTPS tenant backend origin.
- EXPO_PUBLIC_CONTRACT_WEB_ORIGIN: optional HTTPS customer website origin for
  recovery/contracts/support handoffs when the API is hosted separately.

Never embed OPS credentials, service-role keys, secrets or customer data. The
adapter rejects secret/service-role keys and shares one SDK instance per brand.

## Current customer features

- Login, SecureStore-backed sessions, foreground refresh and background privacy.
  Storage uses Unicode-safe chunks, a generation manifest and serialized writes;
  there is no plaintext fallback. Stored sessions alone never authorize reads.
- Password recovery handoff to the existing tenant website's verified flow.
- Independent contracts, sites and invoice lists, with explicit missing values.
- Invoice details, period/dates and line items from the actual OPS
  data.invoice/data.lines/data.documents envelope. No mobile recalculation of
  authoritative totals; credits and zero amounts are retained.
- Invoice document opening: every click rechecks Auth and rereads that customer's
  invoice. Only a document attached to that invoice can yield an existing approved
  HTTPS provider link. The app opens it externally without forwarding the API
  bearer token. Logout/background invalidates pending external navigation.
- Customer support list, case detail, public messages, new-case form and replies.
  Staff identity/internal notes are not forwarded. Case continuation uses OPS
  cursors, with deduplication when another page is loaded. Uncertain writes retain
  the same attempt key for the same user/content while this app process survives.

Retry and foreground restore preserve the selected invoice/case. Temporary Auth
refresh/network failures retain the encrypted session for recovery while customer
rows/details remain hidden. Definitive invalid/revoked sessions are cleared.
Resource failures are independent, so unavailable invoices do not block site/support views.

Profile phone edits, notification read status, customer documents, powers of
attorney and legal acceptances use the same verified customer boundary.
Consumption remains fail-closed until OPS publishes authoritative delivery windows
and metering revision metadata; its controlled error is not positive consumption
functionality or a release qualification.

## Server configuration and safety

All mobile routes default to disabled. `GRIDEX_MOBILE_API_ENABLED=true` is for a
qualified test environment first. They verify the bearer with the existing Auth,
read only the subject-filtered user-RLS profile, and call the canonical OPS
customer API with that verified identity. No cookie fallback or client-provided
customer-number override is accepted. Responses are private/no-store.

For document opening set `GRIDEX_MOBILE_DOCUMENT_ORIGINS` server-side to a
comma-separated list of explicitly approved HTTPS origins. The default is empty,
so links remain unavailable. Origin entries must have no path, query, fragment or
credentials. Verify the provider's real link access/expiry behavior in staging.
The backend does not fetch or proxy arbitrary URLs and never appends API tokens.

## Remaining qualification and functionality

The core A/B customer flow and Android lifecycle passed against a real isolated
OPS/Auth stack in run42912180714 (OPS81e9e6a, Web2495703). This is version-bound
core evidence; it does not qualify every additional account resource or iOS.
The current cross-platform candidate and receipts are tracked in
quality/mobile-cross-platform/plan.md. Production OpenAPI revision2026-11-10.1
is synchronized; no contract gate is relaxed.

Positive real consumption still needs authoritative delivery windows and current
metering revision fields exposed by OPS. The existing adapter deliberately fails
closed; it never infers supply entitlement from contract/move-in dates or treats
missing readings as zero. Attachments, in-app PDF rendering and native contract
signing remain outside the implemented mobile feature set. Case lists/messages
are bounded API results and do not prove complete historical retrieval.

## Extraction proof

Run `node scripts/export-mobile-foundation.mjs /absolute/new/directory` from the
repo root, then `npm test` in the output. Only reviewed source/types are copied,
not .env files, provider keys, Gridex branding or customer data. This proves the
portable foundation only; complete app extraction remains to be demonstrated.
A buyer needs its own Auth/storage and OPS tenant or compatible adapter. App-owned
schema migrations will be versioned when needed in the same existing database.


Support writes use the existing tenant customer_support.write scope. Only title
and message (new case) or message (reply) cross the mobile boundary; identity,
author and visibility cannot be overridden. The body is bounded while streaming.
Attempt keys are not a durable queue: after process termination, check the
canonical case/message history before intentionally sending again. No test here
sends a real support message or email. Mobile/API activation remains gated.

The frozen local messages OpenAPI operation has no cursor parameter; native
message continuation waits for qualified contract synchronization rather than
adding an undocumented query. Cases already expose a documented cursor.

Customer account now includes five additional read views: profile, notifications,
documents, powers of attorney and legal acceptance history. They use existing
OPS resources through the same verified-user server adapter. General documents
are opened only after a fresh customer ownership check and HTTPS origin validation;
no bearer header is passed to the external reader. These views do not edit profiles,
mark notifications read or sign new agreements. Counts mean loaded rows; pagination
outside support cases is not yet qualified. Production activation requires applicable customer/device evidence and the OPS
manifest release gate; core-flow evidence does not qualify additional resources.

The complete native source can now be extracted from the repository root with
`npm run mobile:export -- /absolute/new-directory [brand-config.json]`.
See docs/mobile/portable-app.md and docs/mobile/backend-contract.md. Extraction
has been checked with isolated install, TypeScript and both Hermes platform exports.
It includes a neutral brand, optional customer identity/theme configuration and a
source hash manifest. It does not provision or migrate the server/database.

OPS is optional for purchasers: the exported packages/customer-backend adapter
accepts a buyer's own authentication verifier and data provider, with a synthetic
read-only standalone demo. EXPO_PUBLIC_CUSTOMER_API_PATH changes the endpoint
prefix (Gridex default /api/mobile/customer; reference server /customer/v1).
Native identity currently uses Supabase Auth independently of the data provider.
EXPO_PUBLIC_CONTRACT_WEB_ORIGIN optionally enables web signup/contracts/support
handoffs in the exported app. Gridex itself defaults these links to gridex.se.
Those handoffs do not implement native signing or automatic contract switching.

Elpriser now renders the native daily market view: SE1–SE4, current interval,
duration-weighted published average, source/disclaimer, retry and interval rows.
Gridex uses its existing public /api/elpris/day API. The exported template only
loads prices when EXPO_PUBLIC_PRICES_ORIGIN is configured; optional
EXPO_PUBLIC_PRICES_PATH defaults to /api/elpris. The provider must return priceArea,
date (Stockholm calendar date), sourceLabel, disclaimer and entries containing
sekPerKwh/timeStart/timeEnd. Explicit timezone offsets are required. Values are
spot prices; do not label them as an all-in customer tariff. No customer bearer
is sent to a public market-data provider.

Profile phone editing and notification read actions now use the authenticated
write pipeline. UI success requires explicit server confirmation; notification
rows require a valid returned readAt before changing local read state. Gridex's
adapter verifies accepted/profile_updated for phone and reads back the notification
under the same customer identity. Unknown outcomes retain the process-local retry
key. No login-email change or new signing flow is introduced. The neutral backend
adapter exposes equivalent optional provider writes without OPS.
