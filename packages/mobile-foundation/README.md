# Portable energy app foundation

This package contains public brand configuration and provider-neutral integration
contracts. It has no dependency on the parent website, OPS internals, Supabase or
hosting-specific libraries. Gridex configuration stays outside this package.

Run `npm test` in this directory. No dependency install is needed for these tests.

The ports are contracts, not implemented authentication or database access.
Identity and persistence adapters must verify the trusted issuer, current account
and tenant/customer binding. A public brand id is presentation data only.

The Gridex implementation must reuse its existing tenant Supabase project/accounts.
Canonical energy data remains in OPS behind the API. A future customer provides
their own identity and persistence adapters/configuration, with a separate OPS
tenant or compatible gateway. Copying this package does not copy any customer data.

Export with `node scripts/export-mobile-foundation.mjs /absolute/new/directory`
from the parent repository. The result is a standalone, testable foundation; the
native app and its full layout are later implementation work and are not included
in this foundation export yet.
