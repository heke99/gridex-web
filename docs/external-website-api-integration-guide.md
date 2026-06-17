# External website API integration guide

This document mirrors the production contract published in Gridex OPS and is kept in this repo so tenant website changes are reviewed against the same rules.

## Customer Portal External Auth Linking

Tenant websites use their own Supabase Auth for Mina sidor. Server-side website code must send the website Supabase `session.user.id` to OPS as both `x-gridex-customer-portal-user-id` and `x-gridex-auth-user-id`.

The API key decides tenant/company. Website code must not send a free `company_id` or a free OPS `customer_id` from the frontend.

The main Mina sidor endpoint is:

```http
POST /api/v1/customer/portal-bundle
Authorization: Bearer YOUR_GRIDEX_API_TOKEN
Content-Type: application/json
```

Recommended payload:

```json
{
  "email": "kund@example.se",
  "customer_number": "DX-100023",
  "external_customer_id": "GRIDEX-WEB-20260616-..."
}
```

Use `external_customer_id` only for the stable website/customer reference from signup. Do not copy the OPS customer number into `external_customer_id`; send customer numbers in `customer_number`.

## Customer sync

Signed powers of attorney, legal acceptances, customer documents, facility completions and profile changes are synced to OPS through:

```http
POST /api/v1/customer/sync
Authorization: Bearer YOUR_GRIDEX_API_TOKEN
Idempotency-Key: tenant-sync-...
Content-Type: application/json
```

Payloads must include the same customer identifiers used for Mina sidor linking. OPS stores the records under the tenant resolved from the API key.

## Customer events

Customer portal actions are sent with an allowlisted event type and an `Idempotency-Key`. Support cases are outside the OPS API and must not be sent as website events.

## Webhooks

OPS webhooks are signed with HMAC SHA-256 over:

```text
X-Gridex-Timestamp + "." + rawBody
```

The receiver must reject missing timestamps, stale timestamps and signatures that only match the raw body. The website stores `company_id`, `customer_number`, `external_customer_id`, `customer_email`, payload hash and raw payload for audit/debugging.
