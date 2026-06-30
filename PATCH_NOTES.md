# Gridex Web API production hardening patch

This patch fixes the API/pricing mismatch in the public website integration.

## Main changes

- Price calculator now derives customer preview from OPS `public-contracts.pricing` instead of silently falling back to missing local fee values.
- Missing mandatory published pricing fields now block the calculation with a clear 409 response instead of becoming `0`.
- Homepage calculator options now carry all published pricing fields: markup, monthly fee, invoice fee, fixed price, portfolio price, VAT and mix shares.
- Public contract display now blocks contracts missing mandatory pricing/legal DTO fields and preserves real `0` values.
- Signup submit now preserves grid owner fields from resolver/form data instead of always sending `grid_owner_id/grid_owner_name = null`.
- Facility ID and metering point ID are no longer mixed; `facility_id` is only sent from `facility_id`.
- Local portal-bundle POST now accepts documented identity payload fields: `email`, `customer_number`, `external_customer_id`.
- `/api/v1/events` now supports documented tenant event reads through GET while preserving existing POST customer events.
- API docs now separate official OPS endpoints from website-local wrapper routes and include granular scopes.
- Regression tests now lock the stricter pricing behavior.

## Verified locally

- `npm run test:launch` passed.
- `npm run lint` passed with pre-existing warnings only, no errors.
- `npm run build` passed with dummy build-time env values.

## Required production env check

Ensure Vercel has the full API token in `GRIDEX_WEBSITE_API_KEY` and that the OPS key includes:

```text
website_contracts.read
website_applications.write
customer_portal.read
customer_portal.write
website_events.write
events.read
customer_documents.read
customer_documents.write
customer_notifications.read
customer_notifications.write
customer_contact.write
customer_facility_data.write
customer_power_of_attorney.write
```
