import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const ops = read('lib/ops/client.ts')
const customerType = read('lib/website/customerType.ts')
const pricing = read('lib/website/pricingPreview.ts')
const quote = read('lib/website/pricingQuote.ts')
const publicContracts = read('lib/website/publicContractsEndpoint.ts')
const signup = read('app/(public)/teckna-avtal/page.tsx')
const webhook = read('app/api/ops/webhooks/route.ts')
const webhookParser = read('lib/webhooks/opsWebhook.ts')
const readiness = read('lib/ops/readiness.ts')
const envExample = read('env.example')

assert.ok(customerType.includes("return value === 'company' ? 'business' : 'private'"))
assert.ok(ops.includes('GRIDEX_EXPECTED_TENANT_REFERENCE'))
assert.ok(ops.includes('/api/v1/integration/context'))
assert.ok(ops.includes('assertExpectedTenantReference'))
assert.ok(!ops.includes('GRIDEX_EXPECTED_COMPANY_ID'))
assert.ok(!ops.includes('assertExpectedOpsCompany'))
assert.ok(!existsSync(new URL('../app/api/v1/website/price-plans/route.ts', import.meta.url)))
assert.ok(!ops.includes('fetchOpsPricePlans'))
assert.ok(!ops.includes('export type OpsPricePlan'))
assert.ok(!ops.includes('price_plan_id: pickString(offerRow'))
assert.ok(!ops.includes('price_plan_version_id: pickString(offerRow'))
assert.ok(!ops.includes('"contract_offer_id"'))
assert.ok(!ops.includes('"public_offer_id"'))
assert.ok(!ops.includes('"price_plans"'))
assert.ok(pricing.includes('data.contract.offer_reference === contract.offer_reference'))

assert.ok(pricing.includes('return fetchOpsWebsiteQuote(input)'))
assert.ok(!pricing.includes('buildLocalWebsitePricingPreview'))
assert.ok(!existsSync(new URL('../lib/website/localPricingPreview.ts', import.meta.url)))
assert.ok(ops.includes('opsFetch("/api/v1/website/quote"'))
assert.ok(ops.includes('annual_consumption_kwh: annualConsumptionKwh'))
assert.ok(ops.includes('toOpsCustomerType(input.customer_type)'))

for (const field of [
  'quote_reference', 'pricing_interval', 'estimate_method', 'source_period', 'source_window',
  'market_data_timestamp', 'is_binding', 'assumptions', 'market_sources',
  'pricing_snapshot_schema_version', 'valid_until',
]) {
  assert.ok(quote.includes(field), `signed quote must preserve ${field}`)
}
assert.ok(signup.includes('quote_reference: verifiedQuote.quote.quote_reference'))
assert.ok(signup.includes('annual_consumption_kwh: annualConsumptionKwh'))
assert.ok(!signup.includes('loadVerifiedWebsitePricingPreview'))
assert.ok(signup.includes('livePreview: signedPreview'))

assert.ok(ops.includes('If-None-Match'))
assert.ok(ops.includes('allowNotModified: true'))
assert.ok(ops.includes('response.status === 304'))
assert.ok(publicContracts.includes('publication_revision'))
assert.ok(publicContracts.includes("headers.set('ETag'"))
assert.ok(publicContracts.includes('status: 304'))

assert.ok(webhookParser.includes("'contracts.publication.changed'"))
assert.ok(webhook.includes('getVerifiedOpsIntegrationContext'))
assert.ok(webhook.includes('event.tenant_reference !== expectedTenantReference'))
assert.ok(webhook.includes('invalidateOpsPublicContractsCache'))
assert.ok(webhook.includes("event.channel !== 'website'"))
assert.ok(webhook.includes('publication_state_updated'))

assert.ok(ops.includes('"/api/v1/website/public-contracts/diagnostics"'))
assert.ok(!ops.includes('query.set("diagnostics", "1")'))
assert.ok(readiness.includes("'website_contracts.diagnostics'"))
assert.ok(readiness.includes("'website_quotes.write'"))
assert.ok(readiness.includes("'website_applications.write'"))
assert.ok(envExample.includes('GRIDEX_EXPECTED_TENANT_REFERENCE='))

assert.ok(ops.includes('/api/v1/website/energy-area/resolve'))
assert.ok(ops.includes('/api/v1/website/quote/validate'))

console.log('Gridex external tenant architecture checks passed')
