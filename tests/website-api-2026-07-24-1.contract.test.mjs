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
const checkout = read('app/api/v1/website/checkout-context/route.ts')
const signup = read('app/(public)/teckna-avtal/page.tsx')
const webhook = read('app/api/ops/webhooks/route.ts')
const migration = read('supabase/migrations/20260724190000_ops_website_contract_20260724_1.sql')
const envExample = read('env.example')

assert.ok(contract.includes("GRIDEX_WEBSITE_API_CONTRACT_VERSION = '2026-07-24.1'"))
assert.ok(ops.includes('?? "https://app.gridex.se"'))
assert.ok(ops.includes('/api/v1/integration/context'))
assert.ok(ops.includes('assertTenantReference'))
assert.ok(!ops.includes('GRIDEX_EXPECTED_TENANT_REFERENCE'))

for (const scope of [
  'website_energy_area.resolve',
  'website_quotes.write',
  'website_quotes.validate',
  'website_switch_status.read',
]) assert.ok(contract.includes(scope), `canonical scope missing: ${scope}`)

assert.ok(area.includes('fetchOpsWebsiteEnergyArea'))
assert.ok(area.includes('resolution_id'))
assert.ok(!area.includes('resolveWebsitePriceAreaForPricing'))
assert.ok(quote.includes('fetchOpsWebsiteQuote'))
assert.ok(quote.includes('resolution_id: verifiedArea.payload.resolution_id'))
assert.ok(!quote.includes('marketPriceService'))
assert.ok(!quote.includes('componentCalculator'))
assert.ok(!quote.includes('market_price:'))
assert.ok(!quote.includes('public_contract_etag: contractsSnapshot.etag'))
assert.ok(ops.includes('market_reference'))
assert.ok(ops.includes("resolution_id: input.resolution_id"))
assert.ok(!ops.includes('market_price: input.market_price'))

assert.ok(validation.includes('validateOpsWebsiteQuote'))
assert.ok(checkout.includes('resolution_id: verified.value.area.resolutionId'))
assert.ok(signup.includes('validateCanonicalWebsiteQuote'))
assert.ok(!signup.includes('quote_reference: verifiedQuote.value.quote.ops_quote_reference'))
assert.ok(!ops.includes('GRIDEX_OPS_APPLICATION_QUOTE_REFERENCE_MODE'))
assert.ok(!ops.includes('GRIDEX_OPS_APPLICATION_LEGAL_ACCEPTANCES_MODE'))
assert.ok(!ops.includes('legal_acceptances: input.legal_acceptances'))
assert.ok(ops.includes('consents: input.consents'))
assert.ok(!ops.includes('...(input.grid_owner_id ? { grid_owner_id: input.grid_owner_id } : {})'))
assert.ok(!ops.includes('...(input.grid_owner_name ? { grid_owner_name: input.grid_owner_name } : {})'))

assert.ok(!readiness.includes('GRIDEX_WEBSITE_API_SCOPES'))
assert.ok(!portalReadiness.includes('GRIDEX_CUSTOMER_PORTAL_API_SCOPES'))
assert.ok(readiness.includes('probeOpsEndpointAuthorization'))
assert.ok(portalReadiness.includes('probeOpsEndpointAuthorization'))
assert.ok(webhook.includes('if (event.tenant_reference)'))
assert.ok(!webhook.includes('if (!event.tenant_reference'))

for (const removed of [
  'GRIDEX_WEBSITE_API_SCOPES',
  'GRIDEX_CUSTOMER_PORTAL_API_SCOPES',
  'GRIDEX_CUSTOMER_PORTAL_REQUIRED_SCOPES',
  'GRIDEX_EXPECTED_TENANT_REFERENCE',
  'GRIDEX_OPS_APPLICATION_QUOTE_REFERENCE_MODE',
  'GRIDEX_OPS_APPLICATION_LEGAL_ACCEPTANCES_MODE',
  'PAPILITE_API_KEY',
]) assert.ok(!envExample.includes(removed), `removed configuration remains: ${removed}`)

assert.ok(migration.includes('ops_resolution_id'))
assert.ok(migration.includes('ops_resolution_reference'))
assert.ok(ops.toLowerCase().includes('retry-after'))
assert.ok(ops.includes('ops_rate_limited'))
assert.ok(ops.includes('ops_rate_limiter_unavailable'))
assert.ok(ops.includes('ops_rate_limit_configuration_error'))


const applicationPayload = buildOpsCustomerApplicationPayload({
  offer_reference: 'offer_test',
  annual_consumption_kwh: 5000,
  customer_type: 'private',
  first_name: 'Test',
  last_name: 'Kund',
  personal_number: '199001011234',
  email: 'test@example.se',
  phone: '0700000000',
  address: 'Testgatan 1',
  postal_code: '58200',
  city: 'Linköping',
  grid_area_code: 'GRID-TEST',
  grid_owner_id: 'must-not-be-sent',
  grid_owner_name: 'Must Not Be Sent',
  requested_start_mode: 'earliest_possible',
  source: 'gridex.se',
  idempotency_key: 'idem_test',
  external_customer_id: 'external_test',
  consents: { terms: true },
})
assert.equal('quote_reference' in applicationPayload, false)
assert.equal('legal_acceptances' in applicationPayload, false)
assert.equal('grid_owner_id' in applicationPayload.site, false)
assert.equal('grid_owner_name' in applicationPayload.site, false)
assert.deepEqual(applicationPayload.consents, { terms: true })

console.log('Website API 2026-07-24.1 contract tests passed')
