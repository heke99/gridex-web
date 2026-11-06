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
