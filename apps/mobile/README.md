# Gridex customer mobile app

The mobile app lives in the same repository as the website and support app.
The portable foundation is in `packages/mobile-foundation`; public Gridex
presentation is in `brands/gridex.mjs`. The Expo native shell now provides five navigation tabs and a brand-driven layout.
Authentication adapters and OPS-backed customer flows are not implemented yet.

Install with `npm ci --workspaces=false` in apps/mobile, then run `npm start`
or `npm run typecheck`. Dependencies are isolated from the website to avoid
React-version conflicts. Test builds have OTA updates disabled.

## Data boundaries

- Reuse the **existing Gridex Web Supabase project and accounts**. Do not create
  a separate mobile production database or duplicate customers.
- Read canonical contracts, facilities, metering, invoices and support via OPS.
  Do not connect the phone directly to the OPS database.
- Database/identity SDK imports belong in explicit adapters. Portable UI and
  contracts must not import the website's `lib/` or Supabase implementation.
- Future app-owned SQL belongs in a documented logical boundary in the existing
  database. Use normal reviewed migrations and explicit tenant/user ownership.
  Avoid public-schema/FK changes merely to create this foundation.
- A buyer receives code, source assets, adapter contracts and app-owned schema
  migrations. Credentials, Auth signing keys, Gridex users, operational data,
  payment records and provider accounts are not part of a template export.
- A new installation configures its own Auth, storage and OPS tenant/gateway.
  Moving Gridex itself to a different installation is a separate migration with
  account mapping, tenant-scoped data validation and a tested cutover.

## Extraction proof

Run `node scripts/export-mobile-foundation.mjs /absolute/new/directory` from the
repository root. Run `npm test` inside the output directory. The exporter copies
an explicit allowlist and refuses existing destinations, source symlinks and
destinations inside the source repo. It does not export a full app yet.

The next increment is the Expo runtime/native shell, followed by the Supabase
identity adapter and a verified OPS-backed customer overview. All later portable
packages and app assets must be added to the reviewed export manifest and tested
from a clean directory, without importing this repository's web application.


## Customer login and contracts

The app now includes a password login form and a read-only contracts view.
Configure public build values (same project as Gridex Web):

- EXPO_PUBLIC_SUPABASE_URL: existing tenant Auth project URL.
- EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: public publishable/anon key only.
- EXPO_PUBLIC_CUSTOMER_API_URL: HTTPS origin of this app's tenant backend.

Never add OPS API keys or service-role/secret keys to the mobile build. Sessions
are memory-only in this increment; users log in again after app restart. Persistent
SecureStore sessions, renewal and password recovery are separate pending work.

The server GET /api/mobile/customer/contracts verifies the bearer token through
Auth and reads only the verified subject's RLS-scoped customer profile before
calling OPS. The route defaults to disabled. Enable GRIDEX_MOBILE_API_ENABLED
only in the qualified test environment first. No identity or customer-id query
parameters are accepted. No cookie fallback is used on this route.

Code verification does not establish live provider binding, physical-device
behavior or production readiness. Native builds must be configured explicitly;
missing configuration shows an unavailable message without fake customer data.
