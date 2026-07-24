# Gridex web

Next.js customer portal and admin surface for Gridex. The app uses Supabase for
auth, portal data, RBAC, invoices, integration status and pricing data.

## Getting Started

Install dependencies and run the development server:

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Copy `env.example` to your local env file and fill in the Supabase and
integration secrets.

## Customer portal and auth

- `/dashboard` requires a Supabase session and shows contracts, invoices,
  support tickets, notifications and integration status.
- `/admin` requires admin access through the legacy `admin_users` table or the
  `admin.access` permission.
- Customer invoice visibility is protected by RLS on `customer_invoices`; import
  routes use the Supabase service role server-side.


## Gridex OPS Customer Portal API

The website integrates with `https://app.gridex.se` only from server-side code. The authenticated Supabase user and the server-side `customer_profiles` row determine portal identity; browser requests cannot select an OPS customer or company.

Before production deployment:

1. Apply all Supabase migrations in filename order, including `20260710090000_customer_portal_api_hardening.sql` and `20260718160000_website_checkout_contexts.sql`.
2. Configure `GRIDEX_WEBSITE_API_KEY`. The API key selects the tenant; `GRIDEX_OPS_API_URL` is only an optional override. Configure a webhook signing secret only when webhook reception is enabled.
3. Configure `CRON_SECRET` or `CUSTOMER_PORTAL_OUTBOX_CRON_SECRET` so the customer write outbox and notification reconciliation routes can run.
4. Run lint, TypeScript, launch tests and a production build.

The hardening migrations add immutable website-application attempts, an OPS write outbox for customer events, notification state and profile updates, webhook retry/reconciliation state, distributed rate limiting and a short-lived server-only checkout handoff. Checkout tokens are stored hashed; the browser URL never contains address data. The canonical website flow uses OPS energy-area resolution, OPS quote and OPS quote validation without local tenant selection or price recomputation.

## External invoice import

CIS/factoring systems can push invoices into the customer portal:

```http
POST /api/integrations/invoices
Authorization: Bearer <GRIDEX_INTEGRATION_API_KEY>
Content-Type: application/json
```

Minimal payload:

```json
{
  "providerKey": "cis_invoice_webhook",
  "externalInvoiceRef": "INV-10001",
  "invoiceNumber": "10001",
  "customer": {
    "billingCustomerRef": "CUST-123",
    "email": "kund@example.se"
  },
  "currencyCode": "SEK",
  "invoicePeriodStart": "2026-05-01",
  "invoicePeriodEnd": "2026-05-31",
  "issuedAt": "2026-06-01",
  "dueAt": "2026-06-30",
  "status": "issued",
  "totalAmount": 1250.5,
  "vatAmount": 250.1,
  "pdfUrl": "https://example.se/invoices/10001.pdf",
  "lineItems": []
}
```

The import is idempotent on `providerKey + externalInvoiceRef`. The invoice must
match an existing portal customer by `userId`, `billingCustomerRef`,
`contractCustomerRef`, `externalIdentityRef` or `email`; unmatched invoices are
written as `dead_letter` sync jobs for investigation.

## Market electricity prices

Monthly spot prices are imported from the public elprisetjustnu.se API by
default:

```http
POST /api/integrations/spot-prices/import
Authorization: Bearer <GRIDEX_INTEGRATION_API_KEY>
Content-Type: application/json
```

Example:

```json
{
  "year": 2026,
  "month": 5,
  "areas": ["SE1", "SE2", "SE3", "SE4"],
  "publish": false
}
```

The importer reads daily JSON files for SE1-SE4, calculates monthly averages in
öre/kWh and upserts `gridex_monthly_spot_prices`, which is already used by the
pricing engine. Set `publish: true` to call
`gridex_spot_publish_active_basis` after a complete import.

## Admin integrations

`/admin/integrations` shows:

- provider catalog and capabilities
- external connection status
- latest sync jobs
- required Vercel/Supabase environment variable status
- endpoint contracts for invoice and spot imports

## Supabase migrations

Run the migrations in `supabase/migrations` in order. The integration migration
adds:

- `gridex_monthly_spot_prices`
- `gridex_spot_basis_config`
- `gridex_spot_basis_publish_log`
- publish/rollback functions for active monthly spot basis
- provider catalog entries for elprisetjustnu and CIS invoice webhooks

## Deploy on Vercel

The repository includes `vercel.json` with `npm ci`, `npm run build`, the monthly spot-price cron and hourly customer-portal outbox/reconciliation crons:

```text
/api/integrations/spot-prices/import?publish=false
/api/internal/customer-portal/outbox/process
/api/internal/customer-portal/notifications/reconcile
```

Configure these environment variables in Vercel:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GRIDEX_INTEGRATION_API_KEY`
- `CRON_SECRET`
- optional `SPOT_PRICE_API_URL_TEMPLATE`

## Useful scripts

```bash
npm run lint
npx tsc --noEmit --pretty false
npm run test:launch
npm run build
npm audit --audit-level=moderate
```
