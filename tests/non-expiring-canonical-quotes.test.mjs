import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { issueWebsitePricingQuote, verifyWebsitePricingQuote } from '../lib/website/pricingQuote.ts'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
process.env.GRIDEX_WEBSITE_STATE_SIGNING_SECRET = 'canonical-non-expiring-quote-test-secret-more-than-32-bytes'
process.env.GRIDEX_WEBSITE_STATE_SIGNING_KID = 'canonical-non-expiring-test-key'

const contract = { offer_reference: 'offer_non_expiring', product_code: 'GRIDEX-TEST', name: 'Gridex test', contract_type: 'variable_monthly', type: 'variable_monthly', energy_direction: 'consumption' }
const preview = {
  resolution_id: 'resolution_non_expiring', energy_direction: 'consumption', production_pricing: null,
  start_date: '2026-08-01', requested_start_mode: 'earliest_possible', customer_type: 'private',
  contract: { slug: contract.offer_reference, offer_reference: contract.offer_reference, contract_reference: 'contract_test', product_code: contract.product_code, name: contract.name, contractType: 'spot_monthly' },
  priceArea: 'SE3', price_area_code: 'SE3', kwh: 500, annual_consumption_kwh: 6000, pricePerKwhOre: 99, totalMonthlyCostSek: 544, totalMonthlyCostInclVatSek: 680, totalYearlyCostSek: 8160,
  pricing_snapshot_reference: 'wps_non_expiring', ops_quote_reference: 'quote_non_expiring', pricing_interval: 'monthly', estimate_method: 'canonical_monthly_preview', source_period: '2026-07', source_window: null, market_data_timestamp: '2026-07-31T12:00:00.000Z',
  is_binding: false,
  settlement: {
    model: 'market_monthly',
    customer_accepts: 'pricing_model',
    energy_price_locked_at_signup: false,
    uses_actual_metered_consumption: true,
    market_data_role: 'indicative_preview_only',
    settlement_resolution: 'month',
  },
  assumptions: [], market_sources: [], market_reference: null, pricing_snapshot_schema_version: 'gridex_contract_pricing_v6_selection',
  valid_until: '2026-08-02T12:30:00.000Z', price_option_reference: 'price_option_test', area_price_reference: 'area_price_test', invoice_delivery_method: 'email', selected_component_references: [], mandatory_component_references: [], conditional_component_references: [], site_count: 1,
}
const issued = issueWebsitePricingQuote({ preview, contract, customerType: 'private', requestedStartMode: 'earliest_possible', quoteAttemptId: '33333333-3333-4333-8333-333333333333', location: { postalCode: '58222', city: 'Linköping', address: 'Storgatan 1' }, now: new Date('2026-08-05T12:00:00.000Z') })
assert.ok(issued, 'a quote remains signable even when compatibility valid_until is in the past')
assert.equal(verifyWebsitePricingQuote(issued.token, new Date('2030-01-01T00:00:00.000Z')).ok, true)
assert.deepEqual(issued.quote.settlement, preview.settlement, 'the signed non-expiring quote must retain settlement evidence')
const quoteSource = read('lib/website/pricingQuote.ts')
assert.equal(quoteSource.includes('validUntilTimestamp > now.getTime()'), false)
assert.equal(quoteSource.includes('Date.parse(parsed.valid_until) <= now.getTime()'), false)
const canonical = read('lib/website/canonicalQuoteValidation.ts')
assert.equal(canonical.includes('refreshCanonicalQuote'), false)
assert.equal(canonical.includes('quoteExpired'), false)
assert.equal(canonical.includes("reason: 'quote_expired'"), false)
assert.ok(canonical.includes('exact signed quote is the accepted commercial evidence'))
assert.ok(
  canonical.includes('resolutionId: effectiveQuote.resolution_id'),
  'an address-resolution refresh must not replace the immutable quote-bound resolution id used by the application',
)
assert.equal(
  canonical.includes('resolutionId: area.resolution_id'),
  false,
  'the refreshed technical resolution id must not become the application tuple resolution id',
)
const snapshotStore = read('lib/website/pricingSnapshotStore.ts')
assert.equal(snapshotStore.includes('requires a future canonical valid_until'), false)
console.log('Non-expiring canonical quote tests passed')