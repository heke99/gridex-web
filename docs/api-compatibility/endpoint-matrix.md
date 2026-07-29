# Endpointmatris – Gridex Web mot Gridex OPS

Kontraktsversion: `2026-07-28.2`  
Statusvärden: `compatible`, `partially_compatible`, `blocked_by_web`, `blocked_by_ops`, `not_implemented`.

## Website Integration

| Endpoint | Metod | Scope | Requesttyp | Responstyp | Runtimevalidering | Idempotens | Tenantkontroll | Användande kod | Status | Kvarvarande blockerare |
|---|---|---|---|---|---|---|---|---|---|---|
| `/api/v1/integration/context` | GET | `integration_context.read` | Ingen body | Integration context | Operation + named context + version | N/A | API-nyckel och returnerad `tenant_reference` | `lib/ops/client.ts`, readiness | compatible | Live staging krävs. |
| `/api/v1/website/public-contracts` | GET | `website_contracts.read` | Query `customer_type` | Public contract envelope | Operation, version header, tenant, DTO | N/A | Context + response tenant | public contract cache/BFF | compatible | Live OpenAPI-synk och staging. |
| `/api/v1/website/public-contracts/diagnostics` | GET | `website_contracts.diagnostics` | Query `customer_type` | Diagnostics envelope | Operation + tenant | N/A | Context + response tenant | readiness/admin | compatible | Live probe krävs. |
| `/api/v1/contracts` | GET | Legacy/API channel | Query `customer_type` | Public contract envelope | Operation | N/A | API-nyckel | Endast legacykontrakt | partially_compatible | Ska inte användas som website source of truth. |
| `/api/v1/website/energy-area/resolve` | POST | `website_energy_area.resolve` | `WebsiteEnergyAreaResolveRequest` | `WebsiteEnergyAreaResolveResponse` | Request, response, tenant och canonical resolution | N/A | Context + response tenant | teckna-avtal | compatible | Live staging krävs. |
| `/api/v1/website/quote` | POST | `website_quotes.write` | `WebsiteQuoteRequest` | `WebsiteQuoteResponse` | Request, response, tenant, offer/resolution/quote-binding | Stabil operation key | Context + response tenant | teckna-avtal | compatible | Live staging/idempotency retry. |
| `/api/v1/website/quote/validate` | POST | `website_quotes.validate` | `WebsiteQuoteValidationRequest` | Öppet envelope | Operation + bindningskontroller | Stabil operation key där tillämpligt | Context + response tenant | teckna-avtal | blocked_by_ops | Response är `additionalProperties: true`. |
| `/api/v1/website/legal-bundle` | GET | `website_legal.read` | Query `offer_reference` | `WebsiteLegalBundleResponse` | Operation + named schema + tenant | N/A | Context + response tenant | teckna-avtal | partially_compatible | Kundansökans acceptansmodell är inte dynamisk. |
| `/api/v1/website/customer-applications` | POST | `website_applications.write` | `CustomerApplicationRequest` | `WebsiteCustomerApplicationResponse` | Request, response, tenant, quote, legal evidence, idempotency | Obligatorisk stabil key + payloadbindning | Context + response tenant | teckna-avtal | blocked_by_ops | Portal-ID-fälten saknas i slutet requestschema. |
| `/api/v1/website/customer-applications/{application_id}` | GET | `website_switch_status.read` | UUID path | Status envelope | Path, response, tenant och application-ID | N/A | Context + response tenant | statusflöde | compatible | Live staging krävs. |
| `/api/v1/website/switch-status` | GET | `website_switch_status.read` | `application_number` query | Switch status | Query, response, tenant och application number | N/A | Context + response tenant | publikt statusflöde/readiness | compatible | Portal använder inte en odokumenterad separat route. |
| `/api/v1/website/market-price/current` | POST | `website_market_prices.read` | `CurrentMarketPriceRequest` | `CurrentMarketPriceResponse` | Helt slutet schema, resolution/version, stale fail-closed | N/A | Context + response tenant | market-price BFF | compatible | Live datakälla/staging krävs. |
| `/api/v1/website/portfolio-prices` | GET | `website_contracts.read` | Query offer/area | Fritt objekt i OpenAPI | Guidebaserad strikt parser, intern-ID-skydd | N/A | Context + response tenant | portfolio BFF | blocked_by_ops | Maskinschema saknas. |
| `/api/v1/website/customer-events` | POST | `website_events.write` | Fritt objekt | Fritt objekt | Operation körs, men schemat kan inte ge strict proof | Obligatorisk canonical key i klienten | Portal-ID + API-nyckel | events BFF/outbox | blocked_by_ops | Request/response måste typas. |
| `/webhooks/contracts.publication.changed` | POST | HMAC | `PublicationChangedWebhook` | 2xx ack | Header, HMAC, timestamp, tenant, schema, dedupe | Event + delivery + payload hash | Tenant mot integration context | webhook route | compatible | Staging + applicerad migration krävs. |
| `/api/v1/openapi/website-integration-v1.json` | GET | Publik | Ingen | OpenAPI JSON | Syncscript, version och hash | N/A | N/A | `scripts/sync-openapi.mjs` | partially_compatible | Bundlad snapshot är inte liveverifierad i denna miljö. |
| `/api/v1/openapi/customer-portal-v1.json` | GET | Publik | Ingen | OpenAPI JSON | Syncscript, version och hash | N/A | N/A | `scripts/sync-openapi.mjs` | partially_compatible | Bundlad snapshot är inte liveverifierad i denna miljö. |

## Customer Portal

Samtliga anrop går server-side genom `opsCustomerFetch`, använder samma canonical transport och skickar serververifierad portalidentitet. Maskinspecifikationens öppna/otydliga schemas gör ändå att flera operationer inte kan klassas som fullt kompatibla.

| Endpoint | Metod | Scope | Requesttyp | Responstyp | Runtimevalidering | Idempotens | Tenantkontroll | Användande kod | Status | Kvarvarande blockerare |
|---|---|---|---|---|---|---|---|---|---|---|
| `/api/v1/customer-portal/sync` | POST | `customer_sync.write` | Fritt objekt | Felaktigt `CustomerInvoice[]` | Operationvalidering failar enligt nuvarande kontrakt | Obligatorisk key | API-nyckel + serveridentitet | portal linking/reparation | blocked_by_ops | Både request och response måste rättas. |
| `/api/v1/customer/portal-bundle` | GET/POST | Portal read scopes | Query/headers eller fritt JSON | Tomt objekt | Operationvalidering + read-only fallback endast vid retrybart transportfel | N/A | API-nyckel + auth-ID + stabil kundnyckel | Mina sidor overview | blocked_by_ops | Slutna bundle- och identityschemas saknas. |
| `/api/v1/customer/me` | GET | `customer_profile.read` | Headers | Tomt objekt | Operationvalidering | N/A | Serveridentitet | granular profile | blocked_by_ops | Responsschema saknar fält. |
| `/api/v1/customer/contracts` | GET | `customer_contracts.read` | Headers | Delvis typad lista | Operationvalidering | N/A | Serveridentitet | granular contracts | partially_compatible | Envelope/pagination behöver stängas. |
| `/api/v1/customer/sites` | GET | `customer_sites.read` | Headers | Tomt objekt | Operationvalidering | N/A | Serveridentitet | granular sites | blocked_by_ops | Responsschema saknar fält. |
| `/api/v1/customer/invoices` | GET | `customer_invoices.read` | Headers | Tomt objekt | Operationvalidering | N/A | Serveridentitet | granular invoices | blocked_by_ops | Lista och pagination saknar schema. |
| `/api/v1/customer/invoices/{id}` | GET | `customer_invoices.read` | UUID path + headers | Tomt objekt | Path + operation | N/A | Serveridentitet; endast opaque canonical ID | invoice detail | blocked_by_ops | Responsschema saknas. |
| `/api/v1/customer/metering-values` | GET | `customer_metering.read` | Headers | Tomt objekt | Operationvalidering | N/A | Serveridentitet | metering route | blocked_by_ops | Schema/pagination saknas. |
| `/api/v1/customer/events` | GET | `customer_events.read` | Headers | Tomt objekt | Operationvalidering | N/A | Serveridentitet | portal events | blocked_by_ops | Schema/pagination saknas. |
| `/api/v1/customer/documents` | GET | `customer_documents.read` | Headers | Tomt objekt | Operationvalidering | N/A | Serveridentitet | documents route | blocked_by_ops | Schema/pagination saknas. |
| `/api/v1/customer/legal-acceptances` | GET | `customer_legal.read` | Headers | Tomt objekt | Operationvalidering | N/A | Serveridentitet | legal route | blocked_by_ops | Schema/pagination saknas. |
| `/api/v1/customer/powers-of-attorney` | GET | `customer_power_of_attorney.read` | Headers | Tomt objekt | Operationvalidering | N/A | Serveridentitet | POA route | blocked_by_ops | Schema/pagination saknas. |
| `/api/v1/customer/notifications` | GET | `customer_notifications.read` | Headers | Tomt objekt | Operationvalidering | N/A | Serveridentitet | notifications route | blocked_by_ops | Schema/pagination saknas. |
| `/api/v1/customer/notifications/read` | POST | `customer_notifications.write` | Fritt objekt | Tomt objekt | Operation + canonical client operation ID | Obligatorisk key | Serveridentitet | notification write | blocked_by_ops | Request/response måste typas. |
| `/api/v1/customer/profile-update` | POST | contact/facility write | Fritt objekt | Tomt objekt | Operation + canonical client operation ID | Obligatorisk key | Serveridentitet | profile route | blocked_by_ops | Request/response måste typas. |
| `/api/v1/customer/move-out` | POST | `customer_facility_data.write` | Fritt objekt | Tomt objekt | Operation + calendar validation + operation ID | Obligatorisk key | Serveridentitet | move-out route | blocked_by_ops | Request/response måste typas. |
| `/api/v1/customer/sync` | POST | `customer_sync.write` | Fritt objekt | Tomt objekt | Operation + operation ID | Obligatorisk key | Serveridentitet | document/legal/facility sync | blocked_by_ops | Request/response måste typas. |
| `/api/v1/events` | GET | `events.read` | Inga dokumenterade queryfilter | Tomt objekt | Operation; legacyfilter skickas inte | N/A | API-nyckel | tenant events | blocked_by_ops | Response/pagination/filterkontrakt saknas. |
| `/api/v1/events` | POST | `website_events.write` | Fritt objekt | Tomt objekt | Operation + idempotency header | Obligatorisk key | API-nyckel + identitypayload | event alias | blocked_by_ops | Typade eventscheman saknas. |

## Lokala BFF-routes

- Alla kundspecifika responses ska vara `private, no-store` eller dynamiska.
- `/api/web/customer/switch-status` anropar inte längre den odokumenterade OPS-routen `/api/v1/customer/switch-status`; den returnerar 501 och hänvisar till portal bundle/events.
- Granular kundroutes använder canonical OPS-resurser och får inte falla tillbaka till en tom framgångsresponse vid schemafel.
