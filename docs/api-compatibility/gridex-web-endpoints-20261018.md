# Endpointmatris för Gridex Web och Support123

Alla 142 operationer i de tre publicerade specifikationerna är klassificerade nedan. En endpoint kan finnas i flera specifikationer. Mappning och gröna isolerade tester innebär inte att varje operation har körts med produktionsdata.

| Yta | Metod och endpoint | Ansvar i projektet | Bedömning |
| --- | --- | --- | --- |
| website-integration | `GET /api/v1/integration/context` | `lib/ops/client/core.ts` | implemented |
| website-integration | `GET /api/v1/website/public-contracts` | `lib/ops/client/website.ts` | implemented |
| website-integration | `GET /api/v1/website/public-contracts/diagnostics` | `lib/ops/client/website.ts` | implemented |
| website-integration | `GET /api/v1/contracts` | `lib/ops/client/website.ts` | documented_alternative |
| website-integration | `POST /api/v1/website/quote` | `lib/ops/client/website.ts` | implemented |
| website-integration | `POST /api/v1/website/quote/validate` | `lib/ops/client/website.ts` | implemented |
| website-integration | `POST /api/v1/website/customer-applications` | `lib/ops/client/application.ts`, `lib/website/submissionStore.ts` | implemented |
| website-integration | `POST /api/v1/website/energy-area/resolve` | `lib/ops/client/website.ts` | implemented |
| website-integration | `GET /api/v1/website/switch-status` | `lib/ops/client/website.ts` | implemented |
| website-integration | `GET /api/v1/openapi/website-integration-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| website-integration | `GET /api/v1/openapi/customer-portal-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| website-integration | `POST /api/v1/website/market-price/current` | `lib/ops/client/website.ts` | implemented |
| website-integration | `GET /api/v1/website/portfolio-prices` | `lib/ops/client/website.ts` | implemented |
| website-integration | `GET /api/v1/website/legal-bundle` | `lib/ops/client/website.ts` | implemented |
| website-integration | `POST /api/v1/website/customer-events` | `lib/ops/client/portal.ts` | implemented |
| website-integration | `GET /api/v1/openapi/release-manifest.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| website-integration | `GET /api/v1/public-contracts` | `lib/ops/client/website.ts` | documented_alternative |
| website-integration | `GET /api/v1/public-contracts/diagnostics` | `lib/ops/client/website.ts` | documented_alternative |
| website-integration | `GET /api/v1/website/customer-applications/{application_number}` | `lib/ops/client/application.ts`, `lib/website/submissionStore.ts` | implemented |
| website-integration | `GET /api/v1/openapi/2026-08-03.1/website-integration-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| website-integration | `GET /api/v1/openapi/2026-08-03.1/customer-portal-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| website-integration | `GET /api/v1/openapi/2026-08-02.1/website-integration-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| website-integration | `GET /api/v1/openapi/2026-08-02.1/customer-portal-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| website-integration | `GET /api/v1/openapi/2026-08-04.1/website-integration-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| website-integration | `GET /api/v1/openapi/2026-08-04.1/customer-portal-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| website-integration | `GET /api/v1/openapi/2026-08-04.2/website-integration-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| website-integration | `GET /api/v1/openapi/2026-08-04.2/customer-portal-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| website-integration | `GET /api/v1/openapi/2026-08-04.3/website-integration-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| website-integration | `GET /api/v1/openapi/2026-08-04.3/customer-portal-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| website-integration | `GET /api/v1/openapi/2026-08-05.1/website-integration-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| website-integration | `GET /api/v1/openapi/2026-08-05.1/customer-portal-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| website-integration | `GET /api/v1/openapi/2026-08-05.2/website-integration-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| website-integration | `GET /api/v1/openapi/2026-08-05.2/customer-portal-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| website-integration | `GET /api/v1/openapi/2026-08-10.1/website-integration-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| website-integration | `GET /api/v1/openapi/2026-08-10.1/customer-portal-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| website-integration | `GET /api/v1/openapi/2026-08-14.1/website-integration-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| website-integration | `GET /api/v1/openapi/2026-08-14.1/customer-portal-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| website-integration | `GET /api/v1/openapi/2026-08-19.1/website-integration-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| website-integration | `GET /api/v1/openapi/2026-08-19.1/customer-portal-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| website-integration | `GET /api/v1/openapi/2026-08-19.2/website-integration-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| website-integration | `GET /api/v1/openapi/2026-08-19.2/customer-portal-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| website-integration | `GET /api/v1/openapi/2026-08-20.1/website-integration-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| website-integration | `GET /api/v1/openapi/2026-08-20.1/customer-portal-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| website-integration | `GET /api/v1/openapi/2026-08-20.2/website-integration-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| website-integration | `GET /api/v1/openapi/2026-08-20.2/customer-portal-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| website-integration | `GET /api/v1/openapi/2026-08-22.2/website-integration-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| website-integration | `GET /api/v1/openapi/2026-10-01.1/website-integration-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| website-integration | `GET /api/v1/openapi/2026-10-02.1/website-integration-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| website-integration | `GET /api/v1/openapi/2026-10-02.2/website-integration-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| website-integration | `GET /api/v1/openapi/2026-10-02.3/website-integration-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| website-integration | `GET /api/v1/openapi/2026-08-22.2/customer-portal-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| website-integration | `GET /api/v1/openapi/2026-10-01.1/customer-portal-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| website-integration | `GET /api/v1/openapi/2026-10-02.1/customer-portal-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| website-integration | `GET /api/v1/openapi/2026-10-02.2/customer-portal-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| website-integration | `GET /api/v1/openapi/2026-10-02.3/customer-portal-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| website-integration | `GET /api/v1/openapi/2026-10-02.4/website-integration-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| website-integration | `GET /api/v1/openapi/2026-10-02.4/customer-portal-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| website-integration | `GET /api/v1/openapi/2026-10-04.1/website-integration-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| website-integration | `GET /api/v1/openapi/2026-10-04.1/customer-portal-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| website-integration | `GET /api/v1/openapi/2026-10-09.1/website-integration-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| website-integration | `GET /api/v1/openapi/2026-10-09.1/customer-portal-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| website-integration | `GET /api/v1/openapi/2026-10-12.1/website-integration-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| website-integration | `GET /api/v1/openapi/2026-10-12.1/customer-portal-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| customer-portal | `POST /api/v1/customer-portal/sync` | `lib/ops/client/portal.ts`, `lib/customerPortal/service.ts` | implemented |
| customer-portal | `GET /api/v1/customer/contracts` | `lib/ops/client/portal.ts`, `lib/customerPortal/service.ts` | implemented |
| customer-portal | `GET /api/v1/customer/documents` | `lib/ops/client/portal.ts`, `lib/customerPortal/service.ts` | implemented |
| customer-portal | `GET /api/v1/customer/events` | `lib/ops/client/portal.ts`, `lib/customerPortal/service.ts` | implemented |
| customer-portal | `GET /api/v1/customer/invoices` | `lib/ops/client/portal.ts`, `lib/customerPortal/service.ts` | implemented |
| customer-portal | `GET /api/v1/customer/invoices/{id}` | `lib/ops/client/portal.ts`, `lib/customerPortal/service.ts` | implemented |
| customer-portal | `GET /api/v1/customer/legal-acceptances` | `lib/ops/client/portal.ts`, `lib/customerPortal/service.ts` | implemented |
| customer-portal | `GET /api/v1/customer/me` | `lib/ops/client/portal.ts`, `lib/customerPortal/service.ts` | implemented |
| customer-portal | `GET /api/v1/customer/metering-values` | `lib/ops/client/portal.ts`, `lib/customerPortal/service.ts` | implemented |
| customer-portal | `POST /api/v1/customer/move-out` | `lib/ops/client/portal.ts`, `lib/customerPortal/service.ts` | implemented |
| customer-portal | `GET /api/v1/customer/notifications` | `lib/ops/client/portal.ts`, `lib/customerPortal/service.ts` | implemented |
| customer-portal | `POST /api/v1/customer/notifications/read` | `lib/ops/client/portal.ts`, `lib/customerPortal/service.ts` | implemented |
| customer-portal | `GET /api/v1/customer/portal-bundle` | `lib/ops/client/portal.ts`, `lib/customerPortal/service.ts` | implemented |
| customer-portal | `POST /api/v1/customer/portal-bundle` | `lib/ops/client/portal.ts`, `lib/customerPortal/service.ts` | implemented |
| customer-portal | `GET /api/v1/customer/powers-of-attorney` | `lib/ops/client/portal.ts`, `lib/customerPortal/service.ts` | implemented |
| customer-portal | `POST /api/v1/customer/profile-update` | `lib/ops/client/portal.ts`, `lib/customerPortal/service.ts` | implemented |
| customer-portal | `GET /api/v1/customer/sites` | `lib/ops/client/portal.ts`, `lib/customerPortal/service.ts` | implemented |
| customer-portal | `POST /api/v1/customer/sync` | `lib/ops/client/portal.ts`, `lib/customerPortal/service.ts`, `lib/customerPortal/writeValidation.ts`, `lib/customerPortal/syncReceipt.ts` | implemented |
| customer-portal | `GET /api/v1/events` | `lib/ops/client/portal.ts` | implemented |
| customer-portal | `POST /api/v1/events` | `lib/ops/client/portal.ts` | implemented |
| customer-portal | `GET /api/v1/integration/context` | `lib/ops/client/core.ts` | implemented |
| customer-portal | `GET /api/v1/openapi/customer-portal-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| customer-portal | `GET /api/v1/openapi/2026-08-02.1/customer-portal-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| customer-portal | `GET /api/v1/openapi/2026-08-03.1/customer-portal-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| customer-portal | `GET /api/v1/openapi/2026-08-04.1/customer-portal-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| customer-portal | `GET /api/v1/openapi/2026-08-04.3/customer-portal-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| customer-portal | `GET /api/v1/openapi/2026-08-04.2/customer-portal-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| customer-portal | `GET /api/v1/openapi/2026-08-05.1/customer-portal-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| customer-portal | `GET /api/v1/openapi/2026-08-05.2/customer-portal-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| customer-portal | `GET /api/v1/openapi/2026-08-10.1/customer-portal-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| customer-portal | `GET /api/v1/openapi/2026-08-14.1/customer-portal-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| customer-portal | `GET /api/v1/openapi/2026-08-19.1/customer-portal-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| customer-portal | `GET /api/v1/openapi/2026-08-19.2/customer-portal-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| customer-portal | `GET /api/v1/openapi/2026-08-20.1/customer-portal-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| customer-portal | `GET /api/v1/openapi/2026-08-20.2/customer-portal-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| customer-portal | `GET /api/v1/openapi/2026-08-22.2/customer-portal-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| customer-portal | `GET /api/v1/openapi/2026-10-01.1/customer-portal-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| customer-portal | `GET /api/v1/openapi/2026-10-02.1/customer-portal-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| customer-portal | `GET /api/v1/openapi/2026-10-02.2/customer-portal-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| customer-portal | `GET /api/v1/openapi/2026-10-02.3/customer-portal-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| customer-portal | `GET /api/v1/customer/support/cases` | `lib/ops/client/customerSupport.ts`, `app/api/customer-support` | implemented |
| customer-portal | `POST /api/v1/customer/support/cases` | `lib/ops/client/customerSupport.ts`, `app/api/customer-support` | implemented |
| customer-portal | `GET /api/v1/customer/support/cases/{reference}` | `lib/ops/client/customerSupport.ts`, `app/api/customer-support` | implemented |
| customer-portal | `GET /api/v1/customer/support/cases/{reference}/messages` | `lib/ops/client/customerSupport.ts`, `app/api/customer-support` | implemented |
| customer-portal | `POST /api/v1/customer/support/cases/{reference}/messages` | `lib/ops/client/customerSupport.ts`, `app/api/customer-support` | implemented |
| customer-portal | `GET /api/v1/customer/support/cases/{reference}/attachments` | `lib/ops/client/customerSupport.ts`, `app/api/customer-support` | implemented |
| customer-portal | `POST /api/v1/customer/support/cases/{reference}/attachments` | `lib/ops/client/customerSupport.ts`, `app/api/customer-support` | implemented |
| customer-portal | `GET /api/v1/customer/support/cases/{reference}/attachments/{attachmentReference}` | `lib/ops/client/customerSupport.ts`, `app/api/customer-support` | implemented |
| customer-portal | `GET /api/v1/openapi/2026-10-02.4/customer-portal-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| customer-portal | `GET /api/v1/openapi/2026-10-04.1/customer-portal-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| customer-portal | `GET /api/v1/openapi/2026-10-09.1/customer-portal-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| customer-portal | `GET /api/v1/openapi/2026-10-12.1/customer-portal-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| staff | `GET /api/v1/staff/users` | `lib/staff-api/client.ts`, `apps/support` | implemented |
| staff | `POST /api/v1/staff/users` | `lib/staff-api/client.ts`, `apps/support` | implemented |
| staff | `PATCH /api/v1/staff/users/{id}` | `lib/staff-api/client.ts`, `apps/support` | implemented |
| staff | `POST /api/v1/staff/users/{id}/disable` | `lib/staff-api/client.ts`, `apps/support` | implemented |
| staff | `POST /api/v1/staff/users/{id}/enable` | `lib/staff-api/client.ts`, `apps/support` | implemented |
| staff | `GET /api/v1/staff/roles` | `lib/staff-api/client.ts`, `apps/support` | implemented |
| staff | `GET /api/v1/staff/customers` | `lib/staff-api/client.ts`, `apps/support` | implemented |
| staff | `GET /api/v1/staff/customers/{ref}` | `lib/staff-api/client.ts`, `apps/support` | implemented |
| staff | `PATCH /api/v1/staff/customers/{ref}/contact` | `lib/staff-api/client.ts`, `apps/support` | implemented |
| staff | `POST /api/v1/staff/customers/{ref}/identity-change` | `lib/staff-api/client.ts`, `apps/support` | implemented |
| staff | `GET /api/v1/staff/cases` | `lib/staff-api/client.ts`, `apps/support` | implemented |
| staff | `POST /api/v1/staff/cases` | `lib/staff-api/client.ts`, `apps/support` | implemented |
| staff | `GET /api/v1/staff/cases/{reference}` | `lib/staff-api/client.ts`, `apps/support` | implemented |
| staff | `POST /api/v1/staff/cases/{reference}/messages` | `lib/staff-api/client.ts`, `apps/support` | implemented |
| staff | `POST /api/v1/staff/cases/{reference}/notes` | `lib/staff-api/client.ts`, `apps/support` | implemented |
| staff | `POST /api/v1/staff/cases/{reference}/phone-interactions` | `lib/staff-api/client.ts`, `apps/support` | implemented |
| staff | `PATCH /api/v1/staff/cases/{reference}/status` | `lib/staff-api/client.ts`, `apps/support` | implemented |
| staff | `PATCH /api/v1/staff/cases/{reference}/assignee` | `lib/staff-api/client.ts`, `apps/support` | implemented |
| staff | `GET /api/v1/staff/cases/{reference}/attachments` | `lib/staff-api/client.ts`, `apps/support` | implemented |
| staff | `POST /api/v1/staff/cases/{reference}/attachments` | `lib/staff-api/client.ts`, `apps/support` | implemented |
| staff | `GET /api/v1/staff/cases/{reference}/attachments/{attachmentReference}/file` | `lib/staff-api/client.ts`, `apps/support` | implemented |
| staff | `GET /api/v1/openapi/release-manifest.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| staff | `GET /api/v1/openapi/staff-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| staff | `GET /api/v1/openapi/2026-10-04.1/staff-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| staff | `GET /api/v1/staff/cases/{reference}/events` | `lib/staff-api/client.ts`, `apps/support` | implemented |
| staff | `GET /api/v1/openapi/2026-10-09.1/staff-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |
| staff | `GET /api/v1/openapi/2026-10-12.1/staff-v1.json` | `scripts/sync-openapi.mjs`, `scripts/check-openapi-drift.mjs` | documentation_archive |

Scopes, idempotenskrav, testfiler och bedömning per rad finns i `quality/api-compatibility/endpoint-review-20261018.json`.

Staffs separata introduktionsprofil (identity/resolve och invitations/accept) täcks av onboarding- och tenant-delivery-proven. Partner API är en alternativ integrationsprodukt och behövs inte som en andra skrivväg för samma Website-checkout.
