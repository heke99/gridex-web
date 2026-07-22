# Gridex Web API 2026-07-22.1 implementation

Implemented in this patch:

- API-key-derived integration context with optional tenant pinning.
- Canonical 2026-07-22.1 website scopes and capability readiness.
- Tenant verification against integration context for OPS responses.
- Canonical OPS energy-area resolver in the BFF, checkout and submit flow.
- Canonical OPS quote validation, including validation immediately before application submission.
- Top-level `quote_reference` in customer applications.
- Canonical quote request fields; legacy address/city/metering-point quote fields removed.
- `source_window` preservation through OPS mapping and signed browser quote state.
- Undocumented portal header removed.
- Process-local ISR removed from public-contract routes; legacy alias emits deprecation headers.
- Webhook header/body checks, dynamic tenant verification, canonical webhook columns and shared publication state.
- Planned document-open/download events removed from active event allowlist.
- Documentation and launch tests aligned to API version 2026-07-22.1.

External/live prerequisites not executable from this source archive:

- Assign the required scopes and tenant binding to the API client in OPS.
- Apply the included Supabase migration.
- Verify OPS publication graph, market-data providers and webhook subscription in the live OPS database.
- Run live smoke tests with production/preview secrets.

Verification performed:

- `npm run test:launch` passed.
- Node syntax checks passed for modified TypeScript server modules.
- A full Next.js build could not be run in the sandbox because npm dependencies could not be installed and the archive contained no `node_modules`.
