# Whole API coverage audit — Gridex Web, 2026-10-03

This is an operation-by-operation review of the independent Web candidate against the complete published Website and Customer Portal contracts and the combined developer guide. It records source coverage and regression evidence. It does not establish that the candidate, its database changes, tenant permissions, assertion keys or support domain are active in production.

## Contract baseline and scope

| Item | Audited baseline |
| --- | --- |
| Website and Customer Portal release | `2026-10-02.4` |
| Minimum supported tenant integration version | `2026-10-02.3` |
| Frozen OPS source/build commit | `472d703e7580fdaa49374f4d7aa202da74751057` |
| Website raw-byte SHA-256 | `10fb2f3051f112990fe4ef63ffa18b24ee5d9b5203b1f4429a2a3d88675c43be` |
| Portal raw-byte SHA-256 | `442ee521e2286a3364de082cce50b68be3085db7855caf151a8999005b790503` |
| Machine sources | `docs/openapi/website-integration-v1.json`, `customer-portal-v1.json`, `release-manifest.json`, generated types under `lib/ops/generated` |
| Human guide | [Gridex API documentation](https://app.gridex.se/developers/customer-portal-api), frozen source `app/developers/customer-portal-api/page.tsx` at the OPS commit above |
| Semantic DTO source | [Frozen OPS public DTOs](https://github.com/heke99/gridex-ops-platform/blob/472d703e7580fdaa49374f4d7aa202da74751057/lib/customer-portal/publicDto.ts) |
| Partner reference in the same guide | `lib/partner-api/openApi.ts` at the frozen OPS commit; version `2026-08-17.1` |
| Complete machine operation inventory | Website: 57; Portal: 49. Their union is **85 distinct method/path operations: 47 current and 38 immutable archive reads**. Shared operations are counted once below. |
| Callback inventory | Three Website webhook operations, five additional documented domain event types, and the separate Partner `resourceChanged` callback. |

The current raw URLs and manifest were checked by `scripts/check-openapi-drift.mjs` during this audit and matched these hashes. The checked-in live-sync record is dated `2026-10-03T18:06:54.205Z`; it is historical evidence, not proof of later runtime business flows. Cached search-page output is not used to establish release identity.

A cache-busted read-only refresh at `2026-10-03T20:14:53Z` again returned both exact specification byte hashes above and the `.4` human guide. The live manifest's only changed field was `build_commit`, now `2c8e283e4fb6b232fe4e249352e33e8baeff14b1` (reconfirmed at 20:17 UTC). The guide, public DTO and invoice/sites route files at that build have identical Git blob hashes to the frozen audit source. This records a later deployed OPS build without changing Web's pinned API contract or implying new pagination/detail parameters.

“Required” below means required by a Web feature that exists in this candidate. Optional general API channels, administrative diagnostics, read aliases, immutable history and Partner operations are accounted for without creating duplicate authoritative writes or asking retail customers to configure integration infrastructure. Bearer scopes are shown; the deprecated legacy API-key header alternative is not used by Web. A space-separated scope group in OpenAPI means AND; separate security entries mean OR. Every active OPS call stays on the server.

## Current Website, integration and documentation operations

| Method and OPS path | Scope | Web requirement | Actual Web entry point | Contract behavior reviewed |
| --- | --- | --- | --- | --- |
| `GET /api/v1/integration/context` | `integration_context.read` | Required | `lib/ops/client/core.ts`; Website/Portal readiness; protected `/api/internal/integrations/gridex/health` | Bind the opaque organization reference and inspect enabled scopes, capabilities and runtime contract version. Never supply an internal OPS company ID. |
| `GET /api/v1/website/public-contracts` | `website_contracts.read` | Required | `fetchOpsPublicContractsSnapshot/Fresh`; `/api/web/contracts`; `/api/checkout/context`; offer pages | Canonical Website publication channel, customer type, ETag/304, immutable offer/legal snapshot, default option and sanitized display rules. |
| `GET /api/v1/website/public-contracts/diagnostics` | `website_contracts.diagnostics` | Optional administration | `fetchOpsPublicContractDiagnostics`; `/admin/integrations`; protected health route | Publication/readiness diagnostics; diagnostic failure does not authorize fabricated offers or general-channel fallback. |
| `GET /api/v1/contracts` | `api_contracts.read` | Deprecated; deliberately unused | No active Web caller | Use Website publication channel. Do not revive the deprecated compatibility alias. |
| `POST /api/v1/website/quote` | `website_quotes.write` | Required | `fetchOpsWebsiteQuote/AutoSelect`; `/api/checkout/quote`; signup pricing flow | Exact offer, selected option/components, resolution and customer input; stable quote-attempt key; OPS supplies authoritative pricing. |
| `POST /api/v1/website/quote/validate` | `website_quotes.validate` | Required | `validateOpsWebsiteQuote`; `/api/checkout/quote/validate`; final signup validation | Validate the complete immutable commercial tuple; elapsed time alone does not expire accepted quotes. |
| `POST /api/v1/website/customer-applications` | `website_applications.write` | Required | `submitOpsCustomerApplication`; `/api/signup/orders`; durable submission store | Submit exact accepted quote/legal/POA evidence with stable operation key. Persist application_number and drive receipt from returned checkout object. |
| `POST /api/v1/website/energy-area/resolve` | `website_energy_area.resolve` | Required | `fetchOpsWebsiteEnergyArea`; `/api/checkout/energy-area/resolve` | Canonical resolver supplies resolution_id, price area and grid-area facts. Browser input does not decide authoritative areas. |
| `GET /api/v1/website/switch-status` | `website_switch_status.read` | Required for lifecycle display | `fetchOpsWebsiteSwitchStatus`; `/api/checkout/switch-status`; `/api/web/customer/switch-status`; `SwitchStatusCard` | Use public application_number with result-token/session authorization; stop when terminal. |
| `GET /api/v1/openapi/website-integration-v1.json` | Public | Required tooling | `scripts/sync-openapi.mjs`; `scripts/check-openapi-drift.mjs` | Fetch current Website bytes and verify release-manifest SHA before updating generated types. |
| `GET /api/v1/openapi/customer-portal-v1.json` | Public | Required tooling | Same sync/drift scripts | Fetch Portal spec from the same release, including support and assertion contracts. |
| `POST /api/v1/website/market-price/current` | `website_market_prices.read` | Enabled price feature | `fetchOpsCurrentMarketPrice`; `/api/web/market-price/current`; staging canonical flow | Canonical normalized market price bound to resolution_id; do not replace authoritative quote with a local price calculation. |
| `GET /api/v1/website/portfolio-prices` | `website_contracts.read` | Enabled portfolio feature | `fetchOpsWebsitePortfolioPrices`; `/api/web/portfolio-prices` | Published offer reference and optional documented price_area; sanitized pricing method and historical final settlements. |
| `GET /api/v1/website/legal-bundle` | `website_legal.read` OR `website_contracts.read` | Required legal capability; standalone helper available | `fetchOpsWebsiteLegalBundle`; `/api/checkout/legal-bundle`; readiness | Exact published references/versions/hashes. Canonical checkout retains its verified immutable legal snapshot through acceptance; it must not silently refresh accepted evidence. |
| `POST /api/v1/website/customer-events` | `website_events.write` | Required for document event feature | `sendOpsCustomerEvent`; `POST /api/web/customer/events`; `EventLink`; durable outbox | Exact event type/resource/occurred_at and stable operation key. Retry preserves original evidence; missing historical occurrence evidence fails closed. |
| `GET /api/v1/openapi/release-manifest.json` | Public | Required tooling | Sync/drift scripts; checked-in `release-manifest.json` | Check current and immutable URLs, minimum tenant version, raw SHA-256 and frozen build commit. |
| `GET /api/v1/public-contracts` | `api_contracts.read` | Optional separate API channel; deliberately unused | No active retail Web caller | General API-channel publication is distinct from Website offers. It is not a fallback source for marketing or checkout. |
| `GET /api/v1/public-contracts/diagnostics` | `api_contracts.diagnostics` | Optional separate API administration | No active retail Web caller | General API publication diagnostics belong to configured API integrations. |
| `GET /api/v1/website/customer-applications/{application_number}` | `website_switch_status.read` | Required for later status | `fetchOpsWebsiteApplicationStatus`; `/api/checkout/applications/[applicationId]`; `ApplicationStatusCard` | Public application number despite legacy local parameter name; signed result token verifies the application. Use after refresh/later visit, not an immediate redundant post-submit request. |

## Current Customer Portal and support operations

All customer operations derive identity from the verified server session through `getOpsPortalIdentityForUser` and the customer transport. Granular resource BFFs are backed by `lib/customerPortal/resourceRoute.ts`/`service.ts`; they do not call the full bundle to hide an endpoint-specific authorization or resource error. “Matching BFF” below means the same suffix under `/api/web/customer/support/cases/[reference]`.

| Method and OPS path | Scope | Web requirement | Actual Web entry point | Contract behavior reviewed |
| --- | --- | --- | --- | --- |
| `POST /api/v1/customer-portal/sync` | `customer_sync.write` | Required | `submitOpsCustomerPortalSync`; `/api/web/customer-portal/sync`; onboarding/claim worker; self-service | Server-verified portal/Auth UUID pair. Only linked plus access_granted:true establishes customer access. |
| `GET /api/v1/customer/contracts` | `customer_contracts.read` | Required | `fetchOpsCustomerResource`; `/api/web/customer/contracts`; `/dashboard/contracts` | Canonical customer contracts; preserve public contract_reference and customer-visible lifecycle fields. |
| `GET /api/v1/customer/documents` | `customer_documents.read` | Required | Granular client; `/api/web/customer/documents`; `/dashboard/documents` | Public document_reference, secure_url and version; no internal storage path. HTTPS links only. |
| `GET /api/v1/customer/events` | `customer_events.read` | Required | Granular client; `GET /api/web/customer/events`; `/dashboard/contracts`; bundle overview | Customer-scoped event read is separate from organization events and event write. |
| `GET /api/v1/customer/invoices` | `customer_invoices.read` | Required | Granular client; `/api/web/customer/invoices`; `/dashboard/invoices` | Public invoice_reference and canonical amounts/dates. Unpublished optional PDF/payment fields do not justify guessed values. |
| `GET /api/v1/customer/invoices/{id}` | `customer_invoices.read` | Optional invoice detail; upstream ID gap | Granular client; `/api/web/customer/invoices/[id]`; no list UI detail call | Spec requires UUID id while frozen public list DTO exposes opaque invoice_reference. Do not derive/guess an internal UUID; see remaining contract gaps. |
| `GET /api/v1/customer/legal-acceptances` | `customer_legal.read` | Required | Granular client; `/api/web/customer/legal-acceptances`; `/dashboard/approvals` | Customer-visible subset: acceptance reference/type, document_version, accepted_at and recorded source. |
| `GET /api/v1/customer/me` | `customer_profile.read` | Required | Granular client; `/api/web/customer/me`; `/dashboard/profile` | Flat canonical customer DTO normalized for UI; own Web Auth profile remains a separate login record. |
| `GET /api/v1/customer/metering-values` | `customer_metering.read` | Required API surface | Granular client; `/api/web/customer/metering-values`; dashboard bundle | Customer-visible subset: metering-value reference, period, quantity and quality. Empty/unavailable data must remain distinct. |
| `POST /api/v1/customer/move-out` | `customer_facility_data.write` | Required self-service | `submitOpsCustomerMoveOut`; `/api/web/customer/move-out`; self-service; outbox | Canonical facility_reference and requested_move_out_date. Action requires a known linked facility; no guessed local ID. |
| `GET /api/v1/customer/notifications` | `customer_notifications.read` | Required | Granular client; `/api/web/customer/notifications`; dashboard bundle | Canonical notification_reference, message/type/severity and read_at/status mapping. |
| `POST /api/v1/customer/notifications/read` | `customer_notifications.write` | Required | `markOpsCustomerNotificationsRead`; `/api/web/customer/notifications/read`; self-service; outbox | Canonical notification references; preserve stable operation on exact retry. Local projection IDs cannot be sent as OPS references. |
| `GET /api/v1/customer/portal-bundle` | `customer_profile.read` AND `customer_sites.read` AND `customer_contracts.read` AND `customer_invoices.read` AND `customer_metering.read` AND `customer_legal.read` AND `customer_events.read` AND `customer_documents.read` AND `customer_notifications.read` AND `customer_power_of_attorney.read` | Required overview | `fetchOpsCustomerPortalBundle`; `/api/web/customer/portal-bundle`; `/dashboard` | All ten read scopes are required together. Preserve unavailable sections and partial-data warning; granular pages call their own endpoints. |
| `POST /api/v1/customer/portal-bundle` | `customer_profile.read` AND `customer_sites.read` AND `customer_contracts.read` AND `customer_invoices.read` AND `customer_metering.read` AND `customer_legal.read` AND `customer_events.read` AND `customer_documents.read` AND `customer_notifications.read` AND `customer_power_of_attorney.read` | Optional equivalent read method | No Web POST caller; Web uses documented GET | A read compatibility variant, not an additional business mutation to implement. |
| `GET /api/v1/customer/powers-of-attorney` | `customer_power_of_attorney.read` | Required | Granular client; `/api/web/customer/powers-of-attorney`; `/dashboard/approvals` | Customer-visible subset: POA reference, scope, status, accepted_at/signed_at and valid_to. |
| `POST /api/v1/customer/profile-update` | `customer_contact.write` OR `customer_facility_data.write` | Required contact/address self-service | `submitOpsCustomerProfileUpdate`; `/api/web/customer/profile-update`; `/dashboard/profile/actions.ts`; address self-service; outbox | Profile and/or facility_data; exact allowlisted address model. Contact scope for profile, facility scope for address; combined payload needs both at runtime. |
| `GET /api/v1/customer/sites` | `customer_sites.read` | Required | Granular client; `/api/web/customer/sites`; `/dashboard/contracts`; bundle overview | facility_reference and nested address are canonical. Bundle metering_points join only through exact facility_reference. |
| `POST /api/v1/customer/sync` | `customer_sync.write` | Required customer completion | `submitOpsCustomerSync`; `/api/web/customer/sync`; self-service; outbox | Closed top-level model and facility_data array. Physical facility/metering input is customer evidence; price/grid area facts are read-only. |
| `GET /api/v1/events` | `events.read` | Optional organization administration | `fetchOpsTenantEvents` helper only; no customer page caller | Organization event read must not replace the verified customer's /customer/events resource. Optional documented filters are not needed by current Web flows. |
| `POST /api/v1/events` | `website_events.write` | Optional equivalent event-write alias | No caller; Web uses /website/customer-events | Do not duplicate a single event through both resources. |
| `GET /api/v1/customer/support/cases` | `customer_support.read` | Required support | `fetchOpsCustomerSupportTickets`; `GET /api/web/customer/support/cases`; `components/support/SupportWorkspace.tsx` | Documented limit/cursor pagination with opaque case references and explicit customer fields. |
| `POST /api/v1/customer/support/cases` | `customer_support.write` | Required support | `createOpsCustomerSupportCase`; `POST /api/web/customer/support/cases`; `components/support/SupportWorkspace.tsx`; dashboard server action | Stable Idempotency-Key and allowlisted business body; reject customer/staff/tenant identity fields. |
| `GET /api/v1/customer/support/cases/{reference}` | `customer_support.read` | Required support | `fetchOpsCustomerSupportCase`; `/api/web/customer/support/cases/[reference]`; `components/support/SupportWorkspace.tsx` | Only authenticated customer's public case detail. |
| `GET /api/v1/customer/support/cases/{reference}/messages` | `customer_support.read` | Required support | `fetchOpsCustomerSupportMessages`; matching BFF messages GET; `components/support/SupportWorkspace.tsx` | Select released customer-visible messages; exclude internal notes and staff identities. |
| `POST /api/v1/customer/support/cases/{reference}/messages` | `customer_support.write` | Required support | `replyOpsCustomerSupportCase`; matching BFF messages POST; `components/support/SupportWorkspace.tsx`; server action | Exact operation key; closed cases remain blocked with structured canonical error. |
| `GET /api/v1/customer/support/cases/{reference}/attachments` | `customer_support.read` | Required support | `fetchOpsCustomerSupportAttachments`; matching BFF attachments GET; `components/support/SupportWorkspace.tsx` | Only released customer-visible attachments and public references. |
| `POST /api/v1/customer/support/cases/{reference}/attachments` | `customer_support.write` | Required support | `uploadOpsCustomerSupportAttachment`; matching BFF attachments POST; `components/support/SupportWorkspace.tsx` | Raw PDF/PNG/JPEG body, maximum 4 MiB, optional sanitized X-File-Name, exact retry key; OPS quarantine controls release. |
| `GET /api/v1/customer/support/cases/{reference}/attachments/{attachmentReference}` | `customer_support.read` | Required support | `downloadOpsCustomerSupportAttachment`; matching BFF download GET; `components/support/SupportWorkspace.tsx` | No redirects; bounded download and SHA-256 verification; private response with attachment disposition and sandbox CSP. |

The bundle's ten read scopes are `customer_profile.read`, `customer_sites.read`, `customer_contracts.read`, `customer_invoices.read`, `customer_metering.read`, `customer_legal.read`, `customer_events.read`, `customer_documents.read`, `customer_notifications.read` and `customer_power_of_attorney.read`. Support requires its own explicit `customer_support.read`/`customer_support.write` grants. A profile-only request uses `customer_contact.write`; a facility-address request uses `customer_facility_data.write`; a request containing both requires both in the frozen runtime.

## Immutable documentation operations

All 38 documented archive reads are included here. They are public, immutable compatibility references. The sync job verifies the current release and its immutable counterpart; customers do not need to fetch every historical release.

| Method and exact OPS path | Scope | Web use |
| --- | --- | --- |
| `GET /api/v1/openapi/2026-08-02.1/customer-portal-v1.json` | Public | Immutable tooling archive; current Web targets `2026-10-02.4`. |
| `GET /api/v1/openapi/2026-08-02.1/website-integration-v1.json` | Public | Immutable tooling archive; current Web targets `2026-10-02.4`. |
| `GET /api/v1/openapi/2026-08-03.1/customer-portal-v1.json` | Public | Immutable tooling archive; current Web targets `2026-10-02.4`. |
| `GET /api/v1/openapi/2026-08-03.1/website-integration-v1.json` | Public | Immutable tooling archive; current Web targets `2026-10-02.4`. |
| `GET /api/v1/openapi/2026-08-04.1/customer-portal-v1.json` | Public | Immutable tooling archive; current Web targets `2026-10-02.4`. |
| `GET /api/v1/openapi/2026-08-04.1/website-integration-v1.json` | Public | Immutable tooling archive; current Web targets `2026-10-02.4`. |
| `GET /api/v1/openapi/2026-08-04.2/customer-portal-v1.json` | Public | Immutable tooling archive; current Web targets `2026-10-02.4`. |
| `GET /api/v1/openapi/2026-08-04.2/website-integration-v1.json` | Public | Immutable tooling archive; current Web targets `2026-10-02.4`. |
| `GET /api/v1/openapi/2026-08-04.3/customer-portal-v1.json` | Public | Immutable tooling archive; current Web targets `2026-10-02.4`. |
| `GET /api/v1/openapi/2026-08-04.3/website-integration-v1.json` | Public | Immutable tooling archive; current Web targets `2026-10-02.4`. |
| `GET /api/v1/openapi/2026-08-05.1/customer-portal-v1.json` | Public | Immutable tooling archive; current Web targets `2026-10-02.4`. |
| `GET /api/v1/openapi/2026-08-05.1/website-integration-v1.json` | Public | Immutable tooling archive; current Web targets `2026-10-02.4`. |
| `GET /api/v1/openapi/2026-08-05.2/customer-portal-v1.json` | Public | Immutable tooling archive; current Web targets `2026-10-02.4`. |
| `GET /api/v1/openapi/2026-08-05.2/website-integration-v1.json` | Public | Immutable tooling archive; current Web targets `2026-10-02.4`. |
| `GET /api/v1/openapi/2026-08-10.1/customer-portal-v1.json` | Public | Immutable tooling archive; current Web targets `2026-10-02.4`. |
| `GET /api/v1/openapi/2026-08-10.1/website-integration-v1.json` | Public | Immutable tooling archive; current Web targets `2026-10-02.4`. |
| `GET /api/v1/openapi/2026-08-14.1/customer-portal-v1.json` | Public | Immutable tooling archive; current Web targets `2026-10-02.4`. |
| `GET /api/v1/openapi/2026-08-14.1/website-integration-v1.json` | Public | Immutable tooling archive; current Web targets `2026-10-02.4`. |
| `GET /api/v1/openapi/2026-08-19.1/customer-portal-v1.json` | Public | Immutable tooling archive; current Web targets `2026-10-02.4`. |
| `GET /api/v1/openapi/2026-08-19.1/website-integration-v1.json` | Public | Immutable tooling archive; current Web targets `2026-10-02.4`. |
| `GET /api/v1/openapi/2026-08-19.2/customer-portal-v1.json` | Public | Immutable tooling archive; current Web targets `2026-10-02.4`. |
| `GET /api/v1/openapi/2026-08-19.2/website-integration-v1.json` | Public | Immutable tooling archive; current Web targets `2026-10-02.4`. |
| `GET /api/v1/openapi/2026-08-20.1/customer-portal-v1.json` | Public | Immutable tooling archive; current Web targets `2026-10-02.4`. |
| `GET /api/v1/openapi/2026-08-20.1/website-integration-v1.json` | Public | Immutable tooling archive; current Web targets `2026-10-02.4`. |
| `GET /api/v1/openapi/2026-08-20.2/customer-portal-v1.json` | Public | Immutable tooling archive; current Web targets `2026-10-02.4`. |
| `GET /api/v1/openapi/2026-08-20.2/website-integration-v1.json` | Public | Immutable tooling archive; current Web targets `2026-10-02.4`. |
| `GET /api/v1/openapi/2026-08-22.2/customer-portal-v1.json` | Public | Immutable tooling archive; current Web targets `2026-10-02.4`. |
| `GET /api/v1/openapi/2026-08-22.2/website-integration-v1.json` | Public | Immutable tooling archive; current Web targets `2026-10-02.4`. |
| `GET /api/v1/openapi/2026-10-01.1/customer-portal-v1.json` | Public | Immutable tooling archive; current Web targets `2026-10-02.4`. |
| `GET /api/v1/openapi/2026-10-01.1/website-integration-v1.json` | Public | Immutable tooling archive; current Web targets `2026-10-02.4`. |
| `GET /api/v1/openapi/2026-10-02.1/customer-portal-v1.json` | Public | Immutable tooling archive; current Web targets `2026-10-02.4`. |
| `GET /api/v1/openapi/2026-10-02.1/website-integration-v1.json` | Public | Immutable tooling archive; current Web targets `2026-10-02.4`. |
| `GET /api/v1/openapi/2026-10-02.2/customer-portal-v1.json` | Public | Immutable tooling archive; current Web targets `2026-10-02.4`. |
| `GET /api/v1/openapi/2026-10-02.2/website-integration-v1.json` | Public | Immutable tooling archive; current Web targets `2026-10-02.4`. |
| `GET /api/v1/openapi/2026-10-02.3/customer-portal-v1.json` | Public | Immutable tooling archive; current Web targets `2026-10-02.4`. |
| `GET /api/v1/openapi/2026-10-02.3/website-integration-v1.json` | Public | Immutable tooling archive; current Web targets `2026-10-02.4`. |
| `GET /api/v1/openapi/2026-10-02.4/customer-portal-v1.json` | Public | Immutable tooling archive; current Web targets `2026-10-02.4`. |
| `GET /api/v1/openapi/2026-10-02.4/website-integration-v1.json` | Public | Immutable tooling archive; current Web targets `2026-10-02.4`. |

## Partner API section of the combined guide

The guide also describes a separately configured backend-to-backend product. Its 13 method/path operations are not required for the independent retail Website/Customer Portal contract. Web already registers customers, facilities, legal evidence and contracts atomically through its canonical customer-application operation; adding Partner registration would create an additional business path. The Partner spec declares server-side Bearer authentication with no granular scope list; organization/product mapping is configured in OPS.

Paths in this table are relative to `https://app.gridex.se/api/partner/v1`. None has an active Web caller in this candidate.

| Method and Partner path | Documented purpose | Classification |
| --- | --- | --- |
| `POST /contract` | Combined customer/site/contract registration, optional POA | Optional separate product; canonical Web application already performs registration. |
| `POST /customer` | Create a customer | Optional separate product. |
| `POST /customer/{customer_id}/site` | Create a site | Optional separate product. |
| `POST /customer/{customer_id}/site/{site_id}/powerofattorney` | Upload a POA | Optional separate product; Website application carries accepted POA evidence. |
| `GET /customer/{customer_id}/site/{site_id}/powerofattorney` | Retrieve a POA | Optional separate product; Portal uses customer-scoped powers-of-attorney. |
| `GET /contract/{contract_id}/state` | Retrieve contract state | Optional separate product; Web uses public application/switch and Portal contract state. |
| `GET /customer/{customer_id}` | Retrieve a customer | Optional separate product; Portal uses verified `/customer/me`. |
| `GET /customer/{customer_id}/site/{site_id}` | Retrieve a site | Optional separate product; Portal uses verified sites. |
| `GET /customer/{customer_id}/site/{site_id}/invoice` | List site invoices | Optional separate product; Portal uses verified invoices. |
| `GET /invoice/{invoice_id}` | Retrieve an invoice | Optional separate product. |
| `GET /invoice/{invoice_id}/pdf` | Retrieve an invoice PDF | Optional separate product; absence of a Portal PDF field is not permission to guess a Partner identifier. |
| `GET /customer/{customer_id}/site/{site_id}/measurement` | Retrieve site measurements | Optional separate product; Portal uses verified metering values. |
| `POST /webhook/subscription` | Configure a Partner change subscription | Optional separate product; requires independently configured Partner integration. |

The Partner `GET /openapi.json` link is the public documentation source exposed by the guide, not a business operation in `partnerOpenApi.paths`. Its `resourceChanged` webhook is a receiver callback, not a fourteenth Partner request endpoint. It declares timestamp, signature, event ID and delivery ID headers and tells the receiver to retrieve current resource state after accepting the signal.

## Webhook coverage

| Published notification | Contract/evidence | Actual Web receiver and handling |
| --- | --- | --- |
| `contracts.publication.changed` | Website webhook `contractsPublicationChanged` / `PublicationChangedWebhook` | `POST /webhooks/contracts.publication.changed`; route-specific schema, raw-body HMAC/timestamp validation, header/body identity match, organization/environment/channel binding, durable deduplication/revision state, cache invalidation/revalidation. |
| `customer_application.status_changed` | Website webhook `customerApplicationStatusChanged` | `POST /webhooks/gridex`; signed envelope parsing, organization binding and durable domain projection. Latest status remains available through canonical application GET. |
| `supplier_switch.updated` | Website webhook `supplierSwitchUpdated` | Same domain receiver and durable projection; canonical switch-status GET remains the read source. |
| `invoice.paid` | Website `OpsDomainWebhookEnvelope` schema | Same domain receiver; canonical subject/customer references reach invoice ownership correlation. |
| `invoice.disputed` | Same domain schema | Same receiver, durable customer-visible notification/projection. |
| `supply.started` | Same domain schema | Same receiver, durable customer-visible notification/projection. |
| `metering_values.updated` | Same domain schema | Same receiver; metering values are retrieved through Portal API. |
| `facility_data.verified` | Same domain schema | Same receiver; facility records are retrieved through Portal API. |
| Partner `resourceChanged` | Separate Partner callback contract | Optional, not subscribed by Web. Do not advertise a Partner subscription as active. |

`/api/ops/webhooks` returns 410 with the canonical publication receiver link; it is not the current domain callback URL. The supported-event set contains additional compatible/forward-looking types. An event name in that set does not prove it is documented, subscribed or delivered in this environment.

The receivers verify the raw body and signed timestamp before processing. They bind the organization to the API credential and retain event/delivery identity and signed payload hash. The durable retry worker verifies stored identity against the signed body before applying it. The new forward SQL rule resolves local ownership by stable canonical/customer/external/verified-Auth identifiers and quarantines contradictions; contact email alone is not an ownership credential. Worker lease changes are conditional on their claimed attempt and original processing timestamp. Secret/subscription/cron configuration and real signed deliveries remain environment evidence.

The exact declared callback headers must be accepted without inventing required undocumented headers. Header `event_type`, when supplied, must agree with the signed body. This exact-doc receiver case is a regression/deployment check in addition to parser-only tests.

## Semantic read-model mapping

The Portal machine schemas allow broad resource objects, so schema success alone cannot prove that customer-visible fields were mapped correctly. The audit compares the frozen public DTO source to the actual Web normalizers. The table lists the canonical fields consumed by the current projections; it does not claim a lossless projection of the full raw DTO. Other available DTO fields are not projected or displayed by these screens.

| Resource | Canonical DTO reviewed / customer-visible subset | Important invariant |
| --- | --- | --- |
| Profile | Customer number/external reference, names/email/phone, customer type/company name/status; flat `/me` data or bundle profile | Verified OPS identity and own Auth profile have distinct purposes. The current profile projection does not retain `customer_reference`. |
| Contracts | `contract_reference`, `contract_number`, `contract_name`, `offer_reference`, status, `signed_at`, `start_date`, `end_date`, `created_at` | No fabricated signed/active state from a queued confirmation email. Pricing facts available in the DTO are not projected into the current contract screen. |
| Sites | `facility_reference`, `facility_id`, nested `address.street/postal_code/city`, canonical price/grid area | Previous `site_reference`/flat-address assumptions are removed from the OPS wire mapping. A UI compatibility alias does not alter the OPS public reference. |
| Metering points | Bundle `metering_points`, exact matching `facility_reference`, physical `metering_point_id`, verification status | Never attach a meter using array position, an internal ID or a guessed relation. |
| Invoices | `invoice_reference`, number, currency, periods, `amount_inc_vat`, `vat_amount`, status and issue/due/paid dates | `total_kwh` and `amount_ex_vat` are available in the DTO but omitted from this projection. Optional OCR/PDF/payment URLs are not inferred when OPS does not return them. |
| Documents | `document_reference`, type/title/status, `secure_url`, `version`, created date | `file_name` is available but omitted from the projection. HTTPS link validation prevents unsafe schemes; private storage paths are excluded. |
| Legal acceptance | `acceptance_reference`, `acceptance_type`, `document_version`, `accepted_at`, source | Display the actual recorded document version. The current projection does not retain document reference/hash. |
| POA | `power_of_attorney_reference`, `scope`, status, `accepted_at` with `signed_at` fallback, `valid_to` | Actual acceptance/signing and expiry fields are mapped. Contract/facility relations and `valid_from` are available but omitted from this projection. |
| Events | `event_reference`, `event_type`, `occurred_at` mapped to display `created_at` | Event version/source are available but omitted from this projection. Display labels may derive from event type. |
| Notifications | `notification_reference`, `type`, title, `message`, `severity`, `status/read_at` | Actual body and read state survive normalization. |
| Metering values | `metering_value_reference`, period start/end, `quantity_kwh`, `quality_status` | The canonical point reference, resolution and status are available but omitted from this projection. No locally manufactured readings. |
| Bundle completeness | `bundle_status.unavailable_sections` plus data-quality/customer-status facts | Partial failure is shown as unavailable, rather than as an authoritative empty section. |

## Cross-cutting documentation requirements and evidence

| Guide or machine rule | Web implementation/evidence | Limit of the evidence |
| --- | --- | --- |
| API key stays on a trusted server; credential selects organization | Server OPS config/transport, verified integration context, exact production origin; `web-boundary-security.test.mjs` and `customer-portal-tenant-runtime.test.mjs` | Does not establish configured production key/scopes. |
| Verify end customer; never trust browser identity headers | Verified Supabase Auth session, stable portal identity, paired portal/Auth UUID headers; BFF body allowlists; `support-bff-runtime.test.mjs`, `portal-durable-identity-runtime.test.mjs` | Real cross-tenant sessions still require live tests. |
| Optional required assertion mode | Server-generated compact RS256/PS256/ES256 JWS, issuer/audience/sub/kid/exp and fresh jti per attempt; `customer-assertion-runtime.test.mjs` | Registration of public keys and enforcement mode is OPS configuration. |
| Linked access, not a merely successful HTTP response | Portal sync response checks `status=linked` and `access_granted=true`; pending/rejected responses do not grant access or display completed sync; actual component regression in `customer-self-service-ui-runtime.test.mjs` | Needs one linked and one denied/pending live customer. |
| Accepted write and applied state are separate | `mapCustomerWriteResult` accepts only accepted/submitted outcomes; rejected or unknown HTTP-200 completions return `ok:false`. Address UI distinguishes `facility_updated:true` from a submitted review. Populated transport/component outcome regressions pass in tenant/self-service runtime tests. The separate profile action must also avoid stamping a non-applied result as current. | Final profile-action and durable business-outcome checks remain part of candidate integration; a nonempty `data` object alone is not success. |
| Exact notification-read receipt | The canonical receipt must echo exactly the requested notification-reference set, a nonnegative count no larger than that set and a read timestamp. An exact receipt with zero newly updated rows is accepted. A mismatched HTTP-200 receipt throws a permanent structured error; `customer-portal-tenant-runtime.test.mjs` exercises both. | Customer ownership and durable replay storage remain authoritative OPS behavior. |
| Same key only for exact same business request | Stable quote/application evidence and canonical payload hash; support operation keys; self-service preserves operation on exact retry; outbox stores original event `occurred_at`; `customer-event-producer-runtime.test.mjs`, `customer-self-service-ui-runtime.test.mjs` and tenant runtime tests | Lost-response/double-click/retry behavior must also be exercised with real OPS idempotency storage. |
| OPS owns pricing and legal evidence | Canonical resolver/quote/validation, immutable acceptance tuple and legal snapshot; non-expiring quote and signup contract tests | Local fixtures do not prove that a published tenant offer has complete canonical evidence. |
| Fixed pricing lock vs variable/portfolio estimates | `non-expiring-canonical-quotes.test.mjs`, customer-facing-pricing/visibility and quote tuple tests; `docs/architecture/non-expiring-canonical-quotes.md` | Required `valid_until` is audit data, not a new wall-clock rejection rule. |
| Feed ETag and If-None-Match | Credential-bound canonical feed cache, verified snapshots, no-store upstream transport and explicit 304 handling; `ops-transport-not-modified.test.mjs`, public-feed/cache tests | A last-known-good snapshot cannot mask authorization/tenant mismatch or authorize changed content. |
| Private customer data must not cross caches | Dynamic BFFs, `private, no-store`, cookie variation where session-specific; render-scoped auth reuse only; performance/boundary tests | CDN and deployed response headers require live verification. |
| Granular history must disclose truncation | `canonicalResourcePage` validates and projects the returned top-level `page`, including grouped `page.sites`. Invoice, document, contract/site/event and approval pages show a notice when OPS says more history exists. `customer-resource-pagination-runtime.test.mjs` executes the actual service, BFF and page components, verifies exact counts and keeps malformed metadata/resource errors isolated. | The notice adds no undocumented `limit`/`cursor` request. Complete navigation still needs the published granular pagination contract. |
| Immediate POST result drives receipt | Canonical `checkout.thank_you_ready` and action state; durable signed receipt/application number; result-token fallback and thank-page tests | No automatic email-delivery or contract-activation claim from acceptance alone. |
| Later lifecycle read/polling | Canonical application/switch BFFs; actual `SwitchStatusCard` regression uses 30/60/120-second exponential delays capped at five minutes, honors Retry-After, resets on progress and stops at terminal status; `customer-self-service-ui-runtime.test.mjs` | Real status progress and downstream lifecycle remain live evidence. |
| Bounded safe transport retries and deadline | GET-only retry policy, operation-wide deadline, fresh assertion per retry; `ops-transport-deadline.test.mjs`, assertion runtime | Business writes are not automatically replayed by transport. Long Retry-After cannot be shortened into an early retry. |
| Structured canonical errors | Preserve code/retryable/field/blockers/request/correlation IDs and Retry-After through OPS transport and BFF, including binary download; support/tenant runtime tests | Do not infer retryability by HTTP status when canonical error explicitly says false. |
| Customer-visible support only | Explicit DTO projection, public opaque references, exact request allowlists, closed-case errors; support contract/BFF/UI runtime tests | Staff-only notes/files must also be tested with real released/quarantined OPS data. |
| Raw attachment contract | PDF/PNG/JPEG up to 4 MiB; bounded download, SHA-256 and no redirects; `support-contract-runtime.test.mjs` | Content quarantine/release is authoritative OPS behavior, not a locally invented success. |
| HMAC, timestamp and deduplication | Publication/domain receivers, exact 64-hex comparison, payload/identity agreement, durable retry and stable owner SQL; durable identity/runtime and native webhook tests | Native PostgreSQL fixtures and real signed callback delivery are separate gates. |
| Support domain/login behavior | Exact `support123.gridex.se` host routing, same-host login/Auth callbacks, noindex; `support-host-routing.test.mjs` | Does not establish DNS ownership, TLS or Supabase redirect allowlist. |
| Staff authority and Web database safety | Explicit global permissions, server-only RPCs/RBAC, stable support ownership SQL; separate RBAC/support and database audits | Apply migrations with their dependent server code. Mocked callers are not proof of production ACL/RLS. |

Regression files above identify the actual executable verification paths; a listed test is not a claim that every gate on the evolving integrated candidate has already passed. Full Node 22 typecheck/lint/launch checks, OpenAPI drift, migration checksum checks and native PostgreSQL 16/17 CI belong to the exact final Web revision.

The profile server action also checks accepted/submitted status and the explicit `profile_updated` flag, retains the original operation/body after a retryable lost response, and never stamps submitted values as a current local OPS projection. Current Auth and local account eligibility are checked before a background job can mint a fresh assertion; disabled, banned, deleted and unconfirmed accounts cannot dispatch queued writes. `profile-action-outcome-runtime.test.mjs`, `portal-outbox-eligibility-runtime.test.mjs` and the durable runtime test cover these paths.

The populated public-DTO assertions and actual transport tests in `customer-portal-tenant-runtime.test.mjs` cover facility references/nested addresses, document URLs/versions, acceptance versions, notifications and POA validity. They also verify facility-only and mixed profile/facility writes. The actual self-service component test covers the canonical payloads, linked-access condition, lost-response replay keys, partial bundle counts and polling. Focused runtime checks and TypeScript passed during integration; final revision CI remains a separate record.

## Remaining contract and live evidence

1. **Invoice detail identity:** the Portal machine contract requires UUID `id` for single-invoice GET, whereas the public list emits an opaque `invoice_reference`. The unchanged frozen/current runtime already resolves that public reference in `getPortalInvoiceByReference`; the gap is the published UUID path schema. The list UI does not attempt detail lookup. OPS must align the machine contract with the canonical reference before Web can link listed invoices to this optional detail endpoint; Web does not guess internal UUIDs or bypass its pinned request validator.
2. **Authenticated API behavior:** use real test customers and separate organization credentials to verify linked/pending/denied identities, explicit support scopes, assertion enforcement, all populated reads and all enabled writes. Include facility-only and mixed contact/address updates and verify returned accepted/submitted status rather than assuming an address was already changed.
3. **Replay behavior:** use the same exact operation and key after a lost response, including event occurrence evidence, support create/reply/raw upload, quote and application. A changed request must not reuse a previous key. Historical event jobs without original occurrence evidence require explicit recovery, not an invented timestamp.
4. **Callback behavior:** submit exact published webhook shapes and declared headers, stale/invalid signatures, wrong-organization and replay/conflict cases. Verify durable apply/retry/dead-letter and stable ownership with real records; ensure latest authoritative API state remains accessible.
5. **Deployment/database state:** verify the exact candidate SHA and migration history, including new coordinated directory/role-resolution/webhook ownership changes and native PostgreSQL 16/17 checks. This document does not imply application of pending production SQL.
6. **Support host:** verify Vercel domain attachment/DNS/TLS, actual same-host session cookies and Auth callback/reset allowlist, then test customers and staff on `support123.gridex.se`.
7. **Receipt and pricing:** complete public offer → resolution → quote → exact validation → application → reload/status/portal flow for each enabled pricing/energy-direction variant. `tests/staging-canonical-ops-flow.mjs` requires an explicit real test fixture and credential; it has not been replaced with an invented production success claim.
8. **Granular list pagination:** unchanged frozen/current handlers return a top-level `page` with a default of 50 and maximum of 100. Invoice data is a public row array; sites data contains `sites` and `metering_points` with its metadata grouped under `page.sites`. Web now preserves the validated advisory metadata and displays the fetched count and additional-history notice rather than silently implying a complete list. Current granular machine operations and the human guide do not document `limit`/`cursor`; Web adds neither request parameter nor navigation based on this unpublished runtime behavior. Support lists do preserve and use their explicitly documented cursor contract. OPS needs to publish the granular pagination contract before Web can retrieve subsequent pages through it.
9. **Metering relation identity:** the frozen site DTO prefers a stored `facility_reference`, whereas the metering-point DTO generates one from the site row ID. A custom stored reference can therefore prevent an exact public-reference join. Web intentionally leaves the meter relation absent instead of guessing through a physical/internal ID. OPS must emit the same canonical facility reference on both resources to guarantee this optional bundle relation.
10. **Separate profile form replay:** the self-service component preserves an exact failed operation's ID, but the separate `/dashboard/profile` server-action form can receive a new ID after its failure redirect/re-render. Its lost-response replay correction is pending and must be verified before claiming stable retries for every profile write. Applied, submitted-for-review and rejected outcomes must also remain distinct in the action's local projection and result message.

The detailed deployment boundary is in `docs/independent-tenant-support.md`; identity/queue/webhook changes are in `docs/audits/2026-10-03-durable-identity-review.md`; RBAC and support boundary changes are in `docs/audits/2026-10-03-rbac-support-review.md`; production observations are recorded separately in `docs/audits/2026-10-03-production-readiness.md`. That production record now includes the separate public-feed hotfix PR #44, merged at `2026-10-03T18:06Z` and verified in production at 18:18 UTC; it does not establish deployment of this independent-tenant candidate. This audit supersedes the older August endpoint matrix for operation inventory, without reclassifying unresolved production gates as completed.
