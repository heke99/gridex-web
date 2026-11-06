# Native backend integration contract

All customer endpoints are relative to EXPO_PUBLIC_CUSTOMER_API_URL. Requests send
Authorization: Bearer <Supabase access token>. Validate that token server-side,
require a confirmed user, resolve that user's customer identity within the tenant,
and perform every OPS operation under that identity. Do not accept a customer ID,
company ID or tenant authorization from branding, headers or query strings. Use
private, no-store responses and avoid reflecting upstream errors or credentials.
The source server implementation lives in lib/mobile and app/api/mobile in Gridex
Web and is not bundled here: it depends on that backend's own RLS, OPS integration,
rate limiting and deployment configuration. Implement or deploy an equivalent
adapter in your own environment. Customer rows are not copied during export.

| Method | Path under /api/mobile/customer | Response data key |
| --- | --- | --- |
| GET | contracts, sites, invoices, support | same as path |
| GET | profile, notifications, documents, powers, acceptances | same as path |
| GET | invoices/{reference} | invoiceDetail |
| GET | support/{reference} | supportDetail |
| GET | invoices/{reference}/documents/{documentReference} | invoiceDocument |
| GET | documents/{reference}/open | customerDocument |
| POST | support | confirmed 2xx result |
| POST | support/{reference}/messages | confirmed 2xx result |

GET data keys contain arrays. Row reference is a nonempty canonical string.
Exact field whitelists/validation: apps/mobile/src/customerData.ts and detailData.ts;
detail types: packages/mobile-foundation/src/customerDetails.ts. Null values mean
unknown, never invented defaults. List all projected fields explicitly, including
nulls. A normal list has shape {"data":{"profile":[{"reference":"...", ...}]}}.
Support GET accepts only a bounded cursor and returns page.hasMore (boolean or null)
and page.nextCursor (string or null). hasMore=true requires a nonempty nextCursor.
Other list routes currently reject query parameters. Document results contain
reference and HTTPS url; recheck unique ownership and an approved provider origin
when clicked. The OS receives the URL only, never the session bearer header.

Support POST body is {title,message}; reply body is {message}. The client sends
Content-Type application/json and a stable Idempotency-Key for an uncertain attempt.
The backend must bound/validate input, prevent private author/visibility overrides,
enforce customer ownership and delegate idempotency to its authoritative service.
Do not send success before the write is confirmed. Native parsing, lifecycle tests
and fake-provider route tests are included in the source repository; real-provider
contract qualification is a separate requirement for every installation.

## Alternative to OPS

The exported packages/customer-backend handler is a separate provider-neutral
implementation. It requires authenticate(token) and provider.read(binding,operation),
and optionally provider.write. It can connect directly to a buyer’s own database
or ERP without OPS. Set the native EXPO_PUBLIC_CUSTOMER_API_PATH=/customer/v1
and configure the handler under that prefix. Reference code validates requests,
projects public fields and document origins; production auth, durable storage,
provider ownership checks, rate limits and deployment are installation-specific.
The included demo has synthetic fixed tokens and no write implementation.

## Customer account writes

POST profile accepts only {phone:string}; it does not change login email or roles.
Require a confirmed customer change before responding {data:{accepted:true}}.
POST notifications/read accepts only {reference:string}. Resolve ownership in the
verified tenant/customer scope and respond {data:{accepted:true,readAt:ISO8601}}
only after the canonical record is confirmed read. Missing/invalid readAt is not
native success and preserves retry identity. Both routes require JSON, a bearer
and Idempotency-Key and prohibit query identities/unexpected fields. Gridex adds
canonical public-reference validation and a read-after-write ownership check.
The provider-neutral adapter delegates writes as kind phone / notificationRead;
its provider must implement the same confirmation and durable idempotency rules.

## Consumption (optional provider capability)

`GET /consumption?facility=<owned reference>&from=<UTC ISO instant>&to=<UTC ISO instant>`
uses the same verified bearer identity. Only these three query keys, exactly once,
are accepted; periods must be positive and at most32 days. Instants use canonical
millisecond UTC ISO format. The native screen selects7/30 Stockholm calendar days,
including DST transitions. A facility selection is never an ownership grant.

The provider-neutral adapter invokes `provider.read(verifiedBinding,
{kind:'consumption',facility,from,to})`. Return `{deliveryWindows,items,complete}`.
Every window has `{facility,from,to}` and MUST come from authoritative delivery
rights for this authenticated tenant/customer/facility. Clip open-ended rights to
the requested period on the provider side. Move-in, installation, an unrelated
contract or request parameters are not proof. Recheck ownership on every call.
Items use `{reference,facility,from,to,kwh}` with nonnegative finite consumption.
Negative production/export quantities need a separate explicit energy direction
contract and must not be disguised as consumption.

The adapter requires verified windows, strips raw fields and excludes any whole
interval crossing a rights/selection boundary. It rejects mixed facilities,
duplicate references, overlapping revisions, invalid dates/quantities and more
than4000 rows. Resolve authoritative revisions before returning data. Never mark
`complete:true` after a truncated page; `complete` means the available authorized
readings were fully fetched, not that every expected meter interval exists.
Gaps are not synthesized as zero. Returned data is
`{data:{consumption:{facility,from,to,items,totalKwh,complete}}}`; rights are not
returned to the device. The demo has no authoritative consumption capability.

Gridex currently returns503 for authenticated consumption requests without
fetching raw meter values. The reviewed OPS route does not enforce delivery
windows, and its public DTO has no authoritative facility delivery rights. This
is an explicit integration blocker, not a completed live consumption feature.

### Multiple meter series

Consumption items and delivery windows may carry an optional public opaque
`series` reference. If present, a reading must be wholly within a delivery window
with the SAME series. Separate meter series may overlap in time and contribute to
the facility total; overlapping current readings within one series remain an
error. Omit `series` on both windows and readings for a pre-aggregated single
series. Native parsing validates the same per-series overlap rule.
