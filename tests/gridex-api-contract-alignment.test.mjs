import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const ops = read('lib/ops/client.ts')
assert.ok(ops.includes('requested_start_mode: "earliest_possible" | "specific_date"'))
assert.ok(ops.includes('"/api/v1/website/quote"'))
assert.ok(ops.includes('"/api/v1/website/legal-bundle"'))
assert.ok(ops.includes('"/api/v1/customer-portal/sync"'))
assert.ok(ops.includes('contract: {\n      offer_reference: input.offer_reference,\n      requested_start_mode: input.requested_start_mode'))
assert.ok(!ops.includes('X-Gridex-Tenant-Id'))
assert.ok(!ops.includes('/api/v1/website/contracts${suffix}'))
assert.ok(ops.includes('GRIDEX_ENABLE_LEGACY_PORTAL_BUNDLE_COMPATIBILITY'))
assert.ok(ops.includes('code === "endpoint_not_found" || code === "method_not_supported"'))
assert.ok(ops.includes('probeOpsEndpointAuthorization'))
assert.ok(ops.includes('GRIDEX_OPS_TIMEOUT_MS'))
assert.ok(ops.includes('ops_request_timeout'))
assert.ok(ops.includes('contract_status: pickString'))
assert.ok(ops.includes('signature_snapshot_sha256'))
assert.ok(ops.includes('can_send_agreement_confirmation'))
assert.ok(ops.includes('communication: mapCustomerApplicationCommunication'))
assert.ok(ops.includes('fetchOpsPublicContractDiagnostics'))
assert.ok(ops.includes('query.set("diagnostics", "1")'))

const readiness = read('lib/ops/readiness.ts')
assert.ok(readiness.includes("'customer_power_of_attorney.write'"))
assert.ok(readiness.includes("'/api/v1/website/customer-applications'"))
assert.ok(readiness.includes("'/api/v1/customer/notifications/read'"))
assert.ok(readiness.includes("'/api/v1/customer/portal-bundle'"))
assert.ok(readiness.includes("'customer_portal.read'"))
assert.ok(readiness.includes('Promise.allSettled'))
assert.ok(readiness.includes("declared?.has(scope) ? 'verified' : 'verified_not_declared'"))

const contractNormalizer = read('lib/website/publicContractContract.ts')
assert.ok(contractNormalizer.includes('row.offer_reference ?? row.offerReference'))
assert.ok(!contractNormalizer.includes('row.offer_reference ?? row.offerReference ?? row.id'))

const pricing = read('lib/website/pricingPreview.ts')
assert.ok(pricing.includes('fetchOpsWebsiteQuote(input)'))
assert.ok(!pricing.includes('buildLocalWebsitePricingPreview'))

const signup = read('app/(public)/teckna-avtal/page.tsx')
assert.ok(!signup.includes('fetchOpsWebsiteLegalBundle'))
assert.ok(signup.includes('isSignupReadyContract'))
assert.ok(signup.includes('current_supplier_name'))
assert.ok(signup.includes('createWebsiteApplicationResult'))
assert.ok(!signup.includes('new URLSearchParams()'))

const resultPage = read('app/(public)/teckna-avtal/tack/SignupThanksPage.tsx')
assert.ok(resultPage.includes('readWebsiteApplicationResult'))
assert.ok(!resultPage.includes('customerNumber?: string'))

const webhook = read('app/api/ops/webhooks/route.ts')
assert.ok(webhook.includes('GRIDEX_EXPECTED_COMPANY_ID'))
assert.ok(webhook.includes('ignored_unknown_type'))
assert.ok(webhook.includes('At least two matching customer attributes'))
assert.ok(!webhook.includes('invalidatesPublicContracts'))

const outbox = read('lib/customerPortal/outbox.ts')
for (const operation of ['customer_sync', 'customer_portal_sync', 'move_out', 'facility_data_update']) {
  assert.ok(outbox.includes(`'${operation}'`), `outbox must support ${operation}`)
}
assert.ok(outbox.includes("status: deadLetter ? 'dead_letter' : 'failed'"))
assert.ok(outbox.includes('replayPortalWriteOutbox'))

const migration = read('supabase/migrations/20260713160000_customer_portal_api_contract_alignment.sql')
assert.ok(migration.includes('website_application_results'))
assert.ok(migration.includes('customer_profiles_external_customer_uidx'))
assert.ok(migration.includes('customer_profiles_customer_number_uidx'))
assert.ok(migration.includes('customer_profiles_portal_identity_uidx'))
assert.ok(migration.includes("'dead_letter'"))

const evidenceMigration = read('supabase/migrations/20260714160000_website_application_ops_result_evidence.sql')
assert.ok(evidenceMigration.includes('ops_result_snapshot jsonb'))
assert.ok(evidenceMigration.includes('signature_snapshot_sha256 text'))
assert.ok(evidenceMigration.includes('communication_snapshot jsonb'))


const selfService = read('components/customer/CustomerPortalSelfService.tsx')
for (const endpoint of ['/api/v1/customer-portal/sync', '/api/v1/customer/sync', '/api/v1/customer/move-out', '/api/v1/customer/notifications/read']) {
  assert.ok(selfService.includes(endpoint), `Mina sidor must use ${endpoint}`)
}
assert.ok(read('app/dashboard/error.tsx').includes('/api/v1/customer-portal/sync'))

const submissionStore = read('lib/website/submissionStore.ts')
assert.ok(submissionStore.includes('pricing_quote_snapshot'))
assert.ok(submissionStore.includes('contract_display_snapshot'))
assert.ok(submissionStore.includes('ops_result_snapshot'))
assert.ok(submissionStore.includes('communication_snapshot'))
assert.ok(!ops.includes('pricing_preview_snapshot?:'))
assert.ok(ops.includes('move_in_date: input.requested_start_date'))

const adminReplay = read('app/api/admin/customer-portal/outbox/route.ts')
assert.ok(adminReplay.includes("status: 403"))
assert.ok(outbox.includes('attempt_count: 0'))

const integrationsPage = read('app/admin/integrations/page.tsx')
assert.ok(integrationsPage.includes('fetchOpsPublicContractDiagnostics'))
assert.ok(integrationsPage.includes('diagnostics=1'))

assert.ok(read('proxy.ts').includes('export async function proxy'))
console.log('Gridex API contract alignment checks passed')
