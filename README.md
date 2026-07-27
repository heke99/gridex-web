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


## Gridex OPS website- och kundportal-API

Gridex Web använder OPS server-side. Canonical produktion kräver endast:

```env
GRIDEX_API_KEY=gridex_live_xxxxxxxxx
```

`GRIDEX_API_BASE_URL` är valfri och standardvärdet är `https://app.gridex.se/api/v1`. Den används endast när en godkänd stagingmiljö har en annan bas-URL. API-nyckeln identifierar tenant, bolag och scopes via integration context; inga tenant-/companyvariabler eller quote-lägen krävs.

Kontraktsversion: `2026-07-27.1`.

Canonical checkout är publicerade avtal → OPS energy-area resolution → OPS quote → strikt quote validation → idempotent customer application. `energy_direction` och produktionsprissättning bevaras genom hela flödet. Market price är separat information och Mina sidor använder POST portal bundle som huvudflöde. Se `docs/website-integration.md`.

Verifiera före deploy:

```bash
rm -rf node_modules .next tsconfig.tsbuildinfo
npm ci
npm run api:sync
npm run api:check
npm run api:contract
npm run typecheck
npm run lint
npm test
npm run build
```

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

## Allmän marknadsinformation

Generiska SE1–SE4-, dags- och historiksidor använder en separat informationskälla genom `lib/website/marketInformationAdapter.ts`. Den informationen är inte en personlig offert, exkluderar avtalsavgifter/moms/skatter/elnät och får aldrig användas som avtals- eller faktureringspris.

Checkout använder inte denna källa. Kundens aktuella marknadsreferens hämtas från OPS med `resolution_id`, och OPS quote är ensam source of truth för teckning.

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
- `GRIDEX_API_KEY`
- `GRIDEX_INTEGRATION_API_KEY`
- `CRON_SECRET`
- optional `SPOT_PRICE_API_URL_TEMPLATE`

## Useful scripts

```bash
npm run lint
npm run typecheck
npm run test:launch
npm run build
npm audit --audit-level=moderate
```


## Canonical OPS deployment

Kör samma verifieringskedja före deploy. `api:sync` uppdaterar båda live-OpenAPI-filerna och genererar typer; `api:check` är read-only och stoppar drift.

```bash
rm -rf node_modules .next tsconfig.tsbuildinfo
npm ci
npm run api:sync
npm run api:check
npm run api:contract
npm run typecheck
npm run lint
npm test
npm run build
npx vercel --prod
```

Denna API-klienträttning kräver ingen ny Supabase-migration. Kör inte `supabase db push` enbart på grund av denna leverans.

Se `IMPLEMENTATION.md`, `VERIFICATION.md` och `DELIVERY_REPORT.md` för exakt status.

```bash
# Kräver giltig testnyckel och godkänd fixture
npm run test:staging:ops
```

Staging-fixture: `tests/fixtures/staging-ops-flow.example.json`. Kopiera den till en git-ignorerad fil och använd endast godkända testidentiteter.
