# Portable energy customer app

This source template contains the Expo native application and its shared foundation.
It includes a provider-neutral reference backend with a synthetic read-only example.
It has no Gridex database, customer records, server credentials or deployed service.
Copying the UI does not grant access to any tenant. Do not ship the demo application
identifier: choose your own bundle/package identifier and URL scheme before signing.

## Run

From apps/mobile run `npm ci --workspaces=false`, then `npm run typecheck` and
`npm run start`. Android: `npm run export:android`. iOS: `npx expo export --platform ios
--output-dir dist-ios`. The exported lockfile matches the native application's lockfile.
Node 22 is used in CI. Bundling is not a signed device build or store release.

Configure these public build variables for your own environment:

- EXPO_PUBLIC_SUPABASE_URL: your HTTPS Auth project URL.
- EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: your publishable key or legacy anon key.
- EXPO_PUBLIC_CUSTOMER_API_URL: your own HTTPS backend origin.

Never put service-role keys, OPS credentials or customer data in public build variables.
The app is usable as a shell without configuration; customer login remains unavailable.
Set EXPO_PUBLIC_CUSTOMER_API_PATH=/customer/v1 for your own provider-neutral adapter
(default /api/mobile/customer for Gridex). Customer screens require the API contract
in backend-contract.md. Provision your own
Auth/database/backend and validate tenant isolation before accepting real users.

## Branding

Edit apps/mobile/brands/active.mjs and apps/mobile/app.config.ts. Branding controls
presentation, not authorization. Use different application identifiers and secure
storage brand IDs for different customer installations. The existing export can be
recreated with scripts/export-mobile-app.mjs in the source repository, optionally
passing a JSON file with brand, applicationId and scheme. No existing destination
is overwritten. source-manifest.json lists hashes of all transferred source files.

## Current capabilities and limits

Read contracts, sites, invoices/details, notifications, profile, documents, powers
and acceptance history; create/reply to support cases and continue case pages.
Document links are opened by the OS after fresh backend checks. Password recovery
uses /login/forgot-password on the configured backend origin. Support web fallback
uses /dashboard/support on that origin; provide those web routes in your installation.
Support retry keys survive uncertain requests only within the current app process.
Do not treat export success as verification of an external provider, a migrated
database, live Auth/SecureStore, legal signing or store eligibility. Consumption,
price series, contract signing/switching and attachment upload remain future work.

Example export configuration (save as a local JSON file and pass as the second
argument after the destination):

```json
{
  "brand": {
    "id": "your-energy",
    "displayName": "Your Energy",
    "supportUrl": "https://example.com/support",
    "theme": {
      "canvas": "#08090b", "surface": "#0f1115", "text": "#f4f6f7",
      "muted": "#a7afb8", "accent": "#35c9d7", "accentText": "#041113"
    }
  },
  "applicationId": "com.example.yourenergy",
  "scheme": "your-energy"
}
```

From the source repository: `npm run mobile:export -- /absolute/new-directory
/absolute/brand-config.json`. The destination's parent must already exist. Keep
this configuration public; unknown properties and privileged keys are rejected.

The included packages/customer-backend adapter can use a buyer’s own data provider
without OPS API. See its README for verified identity, canonical read rows, optional
support writes and deployment requirements. The synthetic backend demo is not a
production login or database. Supabase Auth remains the current native identity
adapter; OPS is not required. Replace the identity adapter separately if needed.

Optional EXPO_PUBLIC_CONTRACT_WEB_ORIGIN enables the web contract actions, pointing
to /teckna, /dashboard/contracts and /dashboard/support on that HTTPS origin. Leave
it unset if the purchaser has no corresponding web flows. These actions hand off
to the browser without bearer tokens; native signing/switching remains future work.
