import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { moveOutPayload } from '../lib/customerPortal/writeValidation.ts'

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

const portalRoute = read('app/api/web/customer/portal-bundle/route.ts')
assert.ok(portalRoute.includes('getCustomerPortalOverview()'))
assert.ok(!portalRoute.includes('customer_number: body'))
assert.ok(!portalRoute.includes('external_customer_id: body'))

const service = read('lib/customerPortal/service.ts')
assert.ok(service.includes('authoritative: true'))
assert.ok(service.includes('readOnly: false'))
assert.ok(service.includes("dataFreshness: 'live'"))
assert.ok(!service.includes("dataFreshness: opsAvailable ? 'live' : 'local_fallback'"))
assert.ok(!service.includes('isTransientOpsError'))
assert.ok(service.includes('if (!bundle.profile)'))
assert.ok(!service.includes('enqueuePortalWrite'))
assert.ok(!service.includes('crypto.randomUUID()'))
assert.equal(moveOutPayload({ move_out_date: '2026-02-30' }), null)
assert.deepEqual(
  moveOutPayload({ move_out_date: '2026-02-28', site_id: 'site_123' }),
  { site_id: 'site_123', requested_move_out_date: '2026-02-28' },
)

const ops = read('lib/ops/client.ts')
assert.ok(ops.includes('fetchOpsCustomerResource'))
assert.ok(ops.includes('`${basePath}/${encodeURIComponent(id)}`'))
assert.ok(ops.includes('notification-read:${identity.userId}:${input.operationId}'))
assert.ok(!ops.includes('GRIDEX_ENABLE_LEGACY_PORTAL_BUNDLE_COMPATIBILITY'))

for (const resource of [
  'contracts',
  'sites',
  'invoices',
  'documents',
  'legal-acceptances',
  'powers-of-attorney',
  'metering-values',
  'notifications',
]) {
  const route = read(`app/api/web/customer/${resource}/route.ts`)
  assert.ok(route.includes('customerResourceResponse'))
  assert.ok(!route.includes('getCustomerPortalOverview'))
}

const switchStatusRoute = read('app/api/web/customer/switch-status/route.ts')
assert.ok(switchStatusRoute.includes('status: 501'))
assert.ok(switchStatusRoute.includes('portal-bundle'))
assert.ok(!switchStatusRoute.includes('customerResourceResponse'))

const invoiceDetail = read('app/api/web/customer/invoices/[id]/route.ts')
assert.ok(invoiceDetail.includes("customerResourceResponse('invoices', id)"))
for (const forbidden of ['invoice_number', 'external_invoice_ref', 'payment_reference', 'pdf_storage_path']) {
  assert.ok(!invoiceDetail.includes(forbidden), `invoice detail must not match ${forbidden}`)
}

for (const routePath of [
  'app/api/web/customer/notifications/read/route.ts',
  'app/api/web/customer/profile-update/route.ts',
  'app/api/web/customer/move-out/route.ts',
  'app/api/web/customer/sync/route.ts',
  'app/api/web/customer-portal/sync/route.ts',
  'app/api/web/customer/events/route.ts',
]) {
  const route = read(routePath)
  assert.ok(route.includes('client_operation_id'), `${routePath} must require client operation ID`)
  assert.ok(!route.includes('randomUUID'), `${routePath} must not create retry identity`)
  assert.ok(!route.includes('enqueuePortalWrite'), `${routePath} must fail closed when OPS is unavailable`)
}

const signingSecret = read('lib/website/serverTokenSecret.ts')
assert.ok(signingSecret.includes('GRIDEX_WEBSITE_STATE_SIGNING_SECRET'))
assert.ok(signingSecret.includes('GRIDEX_WEBSITE_STATE_SIGNING_KID'))
assert.ok(signingSecret.includes('GRIDEX_WEBSITE_STATE_SIGNING_PREVIOUS_SECRET'))
for (const forbidden of [
  'GRIDEX_WEBSITE_HASH_PEPPER',
  'PII_HASH_PEPPER',
  'PII_ENCRYPTION_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
]) assert.ok(!signingSecret.includes(forbidden))

const webhook = read('lib/webhooks/publicationChanged.ts')
for (const header of [
  'x-gridex-event-id',
  'x-gridex-event-type',
  'x-gridex-delivery-id',
  'x-gridex-timestamp',
  'x-gridex-signature',
]) assert.ok(webhook.includes(header))
assert.ok(webhook.includes('assertWebsiteRequest'))
assert.ok(webhook.includes('apply_ops_publication_event'))
assert.ok(existsSync(new URL('../app/webhooks/contracts.publication.changed/route.ts', import.meta.url)))

const webhookMigration = read('supabase/migrations/20260728130000_canonical_publication_webhook_20260728_1.sql')
assert.ok(webhookMigration.includes('publication_revision type bigint'))
assert.ok(webhookMigration.includes('revision_token uuid'))
assert.ok(webhookMigration.includes("'identifier_conflict'"))
assert.ok(webhookMigration.includes("p_channel <> 'website'"))

const contractsRoute = read('app/api/web/contracts/route.ts')
assert.ok(contractsRoute.includes('publicContractsResponse'))
assert.equal(existsSync(new URL('../app/api/v1/website/public-contracts/route.ts', import.meta.url)), false)

const signup = read('app/(public)/teckna-avtal/page.tsx')
assert.ok(signup.includes('legalEvidenceSnapshot'))
assert.ok(signup.includes('buildOpsCustomerApplicationPayload(applicationInput)'))
assert.ok(!signup.includes('current_supplier_id'))

console.log('Customer Portal API hardening checks passed')
