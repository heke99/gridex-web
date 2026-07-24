import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildOpsCustomerApplicationPayload } from '../lib/ops/client.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8')

const contract = read('lib/ops/contract.ts')
const ops = read('lib/ops/client.ts')
const readiness = read('lib/ops/readiness.ts')
const portalReadiness = read('lib/ops/portalReadiness.ts')
const area = read('app/api/v1/website/energy/resolve/route.ts')
const quote = read('app/api/v1/website/pricing/preview/route.ts')
const validation = read('lib/website/canonicalQuoteValidation.ts')
const signup = read('app/(public)/teckna-avtal/page.tsx')
const marketPrice = read('app/api/v1/website/market-price/current/route.ts')
const applicationStatus = read('app/api/v1/website/customer-applications/[applicationId]/route.ts')
const migration = read('supabase/migrations/20260724184500_ops_website_contract_20260724_2.sql')
const envExample = read('env.example')
const stagingFlow = read('tests/staging-canonical-ops-flow.mjs')
const websiteOpenApi = JSON.parse(read('docs/openapi/website-integration-v1.json'))
const applicationCustomerSchema = websiteOpenApi.components.schemas.CustomerApplicationRequest.properties.customer

assert.ok(contract.includes("GRIDEX_WEBSITE_API_CONTRACT_VERSION = '2026-07-24.2'"))
assert.ok(contract.includes("GRIDEX_API_BASE_URL = 'https://app.gridex.se/api/v1'"))
assert.ok(contract.includes("GRIDEX_WEBSITE_API_ACCEPT_VERSION_HEADER = 'X-Gridex-Accept-Contract-Version'"))
assert.ok(contract.includes("GRIDEX_WEBSITE_API_VERSION_HEADER = 'X-Gridex-Contract-Version'"))
assert.ok(ops.includes('GRIDEX_WEBSITE_API_ACCEPT_VERSION_HEADER'))
assert.ok(ops.includes('ops_contract_version_mismatch'))
assert.ok(ops.includes('/api/v1/integration/context'))
assert.ok(ops.includes('assertTenantReference'))
assert.ok(!ops.includes('GRIDEX_EXPECTED_TENANT_REFERENCE'))

for (const scope of [
  'website_energy_area.resolve',
  'website_market_prices.read',
  'website_quotes.write',
  'website_quotes.validate',
  'website_applications.write',
  'website_switch_status.read',
]) assert.ok(contract.includes(scope), `canonical scope missing: ${scope}`)

assert.ok(area.includes('fetchOpsWebsiteEnergyArea'))
assert.ok(area.includes('resolution_id'))
assert.ok(quote.includes('fetchOpsWebsiteQuote'))
assert.ok(quote.includes('fetchOpsCurrentMarketPrice'))
assert.ok(quote.includes('currentMarketPrice.is_stale'))
assert.ok(quote.includes('current_market_price: publicCurrentMarketPrice'))
assert.ok(quote.includes("opsCode === 'market_price_stale'"))
assert.ok(quote.includes('resolution_id: verifiedArea.payload.resolution_id'))
assert.ok(quote.includes('canonicalStartDate'))
assert.ok(validation.includes('local.quote.resolution_id !== area.payload.resolution_id'))
assert.ok(validation.includes('resolution_id: area.payload.resolution_id'))
assert.ok(signup.includes('quote_reference: verifiedQuote.value.quote.ops_quote_reference'))
assert.ok(signup.includes('resolution_id: verifiedQuote.value.area.resolutionId'))
assert.ok(signup.includes('start_date: verifiedQuote.value.quote.start_date'))
assert.ok(marketPrice.includes('fetchOpsCurrentMarketPrice'))
assert.ok(marketPrice.includes('const { raw: _raw, ...publicData } = data'))
assert.ok(applicationStatus.includes('fetchOpsWebsiteApplicationStatus'))
assert.ok(applicationStatus.includes('const { raw: _raw, ...publicData } = data'))
for (const step of [
  'fetchOpsIntegrationContext',
  'fetchOpsPublicContractsFresh',
  'fetchOpsWebsiteEnergyArea',
  'fetchOpsCurrentMarketPrice',
  'fetchOpsWebsiteQuote',
  'validateOpsWebsiteQuote',
  'submitOpsCustomerApplication',
  'fetchOpsWebsiteApplicationStatus',
  'fetchOpsCustomerPortalBundle',
]) assert.ok(stagingFlow.includes(step), `staging flow missing: ${step}`)
assert.ok(stagingFlow.includes('const second = await submitOpsCustomerApplication(applicationInput)'))
assert.ok(stagingFlow.includes('assert.equal(second.application_id, first.application_id)'))
assert.ok(ops.includes('fetchOpsWebsiteApplicationStatus'))
assert.ok(ops.includes('fetchOpsCurrentMarketPrice'))
assert.ok(ops.includes('market_reference'))
assert.ok(ops.includes('type GeneratedCustomerApplicationPayload = Omit<'))
assert.ok(ops.includes('satisfies GeneratedCustomerApplicationPayload'))
assert.ok(!ops.includes('satisfies GeneratedCustomerApplicationRequest;'))
assert.ok(applicationCustomerSchema.required.includes('customer_type'))
assert.ok(applicationCustomerSchema.required.includes('email'))
assert.equal(applicationCustomerSchema.properties.customer_type.$ref, '#/components/schemas/CustomerType')
assert.equal(applicationCustomerSchema.additionalProperties, true)
assert.ok(ops.includes('missing_website_scopes'))
assert.ok(ops.includes('time_start'))
assert.ok(ops.includes('source_as_of'))
assert.ok(!ops.includes('GRIDEX_ALLOW_UNSAFE_OPS_URL'))
assert.ok(readiness.includes('website_market_prices.read'))
assert.ok(!readiness.includes('GRIDEX_WEBSITE_API_SCOPES'))
assert.ok(!portalReadiness.includes('GRIDEX_CUSTOMER_PORTAL_API_SCOPES'))

for (const removed of [
  'GRIDEX_WEBSITE_API_SCOPES',
  'GRIDEX_CUSTOMER_PORTAL_API_SCOPES',
  'GRIDEX_CUSTOMER_PORTAL_REQUIRED_SCOPES',
  'GRIDEX_EXPECTED_TENANT_REFERENCE',
  'GRIDEX_EXPECTED_COMPANY_ID',
  'GRIDEX_TENANT_ID',
  'GRIDEX_OPS_APPLICATION_QUOTE_REFERENCE_MODE',
  'GRIDEX_WEBSITE_API_CONTRACT_VERSION=',
  'GRIDEX_OPENAPI_PATH',
  'NEXT_PUBLIC_GRIDEX_API_KEY',
]) assert.ok(!envExample.includes(removed), `removed configuration remains: ${removed}`)

assert.ok(migration.includes('ops_workflow_id'))
assert.ok(migration.includes('ops_supplier_switch_status'))
assert.ok(applicationStatus.includes('syncWebsiteSubmissionStatus'))
assert.ok(migration.includes('submission_idempotency_key'))
assert.ok(migration.includes('website_application_submissions_ops_application_uidx'))

const applicationPayload = buildOpsCustomerApplicationPayload({
  external_customer_id: 'tenant-customer-123',
  source: 'gridex_web',
  offer_reference: 'offer_test',
  quote_reference: 'quote_test',
  resolution_id: 'resolution_test',
  annual_consumption_kwh: 5000,
  start_date: '2026-09-01',
  customer: {
    customer_type: 'private',
    first_name: 'Test',
    last_name: 'Kund',
    personal_number: '199001011234',
    email: 'test@example.se',
    phone: '0700000000',
  },
  site: {
    street: 'Testgatan 1',
    postal_code: '58200',
    city: 'Linköping',
    move_in_date: '2026-09-01',
  },
  contract: {
    requested_start_mode: 'specific_date',
    requested_start_date: '2026-09-01',
  },
  idempotency_key: 'idem_test',
  consents: { terms: true },
})

assert.equal(applicationPayload.offer_reference, 'offer_test')
assert.equal(applicationPayload.quote_reference, 'quote_test')
assert.equal(applicationPayload.resolution_id, 'resolution_test')
assert.equal(applicationPayload.annual_consumption_kwh, 5000)
assert.equal(applicationPayload.start_date, '2026-09-01')
assert.equal('offer_reference' in applicationPayload.contract, false)
assert.equal('quote_reference' in applicationPayload.contract, false)
assert.equal('price_area_code' in applicationPayload.site, false)
assert.equal('annual_consumption_kwh' in applicationPayload.site, false)
assert.deepEqual(applicationPayload.legal_acceptances, { terms: true })
assert.deepEqual(applicationPayload.consents, { terms: true })

console.log('Website API 2026-07-24.2 contract tests passed')
