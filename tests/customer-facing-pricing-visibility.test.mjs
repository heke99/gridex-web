import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { issueWebsitePricingQuote, verifyWebsitePricingQuote } from '../lib/website/pricingQuote.ts'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

process.env.GRIDEX_WEBSITE_STATE_SIGNING_SECRET = 'customer-facing-pricing-visibility-test-secret-more-than-32-bytes'
process.env.GRIDEX_WEBSITE_STATE_SIGNING_KID = 'customer-facing-pricing-test-key'

const fixedContract = {
  offer_reference: 'offer_fixed_se_area',
  product_code: 'FAST-SE',
  name: 'Fast elpris',
  contract_type: 'fixed',
  type: 'fixed',
  energy_direction: 'consumption',
}

const issued = issueWebsitePricingQuote({
  preview: {
    resolution_id: 'resolution_visibility_test',
    energy_direction: 'consumption',
    production_pricing: null,
    start_date: '2026-09-01',
    requested_start_mode: 'specific_date',
    customer_type: 'private',
    contract: {
      slug: fixedContract.offer_reference,
      offer_reference: fixedContract.offer_reference,
      contract_reference: null,
      product_code: fixedContract.product_code,
      name: fixedContract.name,
      contractType: 'fixed',
    },
    priceArea: 'SE3',
    price_area_code: 'SE3',
    kwh: 100,
    annual_consumption_kwh: 1200,
    pricePerKwhOre: 140,
    totalMonthlyCostSek: 208,
    totalMonthlyCostInclVatSek: 260,
    totalYearlyCostSek: 3120,
    pricing_snapshot_reference: 'wps_visibility_test',
    ops_quote_reference: 'quote_visibility_test',
    pricing_interval: 'month',
    estimate_method: 'ops_canonical_quote',
    source_period: null,
    source_window: null,
    market_data_timestamp: new Date().toISOString(),
    specification: {
      basis: {
        market_ore_per_kwh: 140,
        source_period: null,
        price_area_code: 'SE3',
      },
      fees: {
        monthlyFeeSek: 49,
        invoiceFeeSek: 19,
        invoiceFeeIncludedInMonthlyEstimate: true,
        billingIntervalMonths: 1,
      },
    },
    market_reference: null,
    market_sources: [],
    assumptions: [],
    valid_until: '2030-01-01T00:00:00.000Z',
    pricing_snapshot_schema_version: '2026-08-02.1',
    price_option_reference: 'price_option_visibility',
    area_price_reference: 'area_price_visibility_se3',
    invoice_delivery_method: 'email',
    selected_component_references: [],
    mandatory_component_references: [],
    conditional_component_references: [],
    site_count: 1,
    is_binding: true,
    public_contract_etag: '"visibility-etag"',
    publication_revision: 42,
    contract_payload_sha256: 'a'.repeat(64),
    legal_bundle_version: 'legal_visibility_test',
    legal_document_hashes: {},
  },
  contract: fixedContract,
  customerType: 'private',
  requestedStartMode: 'specific_date',
  quoteAttemptId: '11111111-1111-4111-8111-111111111111',
  location: { postalCode: '58222', city: 'Linköping', address: 'Storgatan 1' },
})
assert.ok(issued, 'a signed website quote must be issued')
assert.equal(verifyWebsitePricingQuote(issued.token, new Date('2029-12-31T23:59:59.000Z')).ok, true, 'canonical quote must remain valid before compatibility valid_until')
assert.equal(verifyWebsitePricingQuote(issued.token, new Date('2030-01-01T00:00:00.000Z')).ok, true, 'compatibility valid_until must not expire the customer-visible quote')
assert.equal(verifyWebsitePricingQuote(issued.token, new Date('2040-01-01T00:00:00.000Z')).ok, true, 'wall-clock time alone must never invalidate the accepted quote')
const tokenPayload = JSON.parse(Buffer.from(issued.token.split('.')[2], 'base64url').toString('utf8'))
assert.equal(tokenPayload.specification?.fees?.invoiceFeeSek, 19, 'canonical signed audit state must retain hidden fees')
assert.equal(tokenPayload.total_monthly_cost_sek, 208, 'the browser total must still include the hidden invoice fee')
assert.equal(tokenPayload.area_price_reference, 'area_price_visibility_se3', 'signed quote must retain canonical area price reference')

const resultCard = read('components/PriceResultCard.tsx')
assert.equal(resultCard.includes('OPS-offert'), false)
assert.equal(resultCard.includes('kommer från OPS'), false)
assert.equal(resultCard.includes('fees.invoiceFeeSek'), false)
assert.equal(resultCard.includes('• inräknad'), false)
assert.equal(resultCard.includes('CUSTOMER_NETWORK_FEE_NOTICE'), true)
