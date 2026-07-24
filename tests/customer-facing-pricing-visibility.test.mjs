import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildPublicContractDisplay } from '../lib/website/publicContractDisplay.ts'
import { toBrowserPublicContract } from '../lib/website/publicDtos.ts'
import { sanitizePricingComponentsBeforeAreaResolution } from '../lib/website/publicPricingVisibility.ts'
import { issueWebsitePricingQuote } from '../lib/website/pricingQuote.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8')

const pricingComponents = [
  { component_code: 'fixed_price_ore_per_kwh', name: 'Fast elpris', amount: 140, unit: 'ore_per_kwh', website_card_visible: true, calculation_base: null },
  { component_code: 'monthly_fee', name: 'Månadsavgift', amount: 49, unit: 'sek_month', website_card_visible: true, calculation_base: null },
  { component_code: 'invoice_fee', name: 'Fakturaavgift', amount: 19, unit: 'sek_invoice', website_card_visible: false, calculation_base: null },
]

const fixedContract = {
  offer_reference: 'offer_fixed_se_area',
  product_code: 'FAST-SE',
  name: 'Fast elpris',
  type: 'fixed',
  fixed_price_ore_per_kwh: 140,
  monthly_fee_sek: 49,
  invoice_fee_sek: 19,
  pricing_components: pricingComponents,
  terms_version: '2026-07',
  terms_version_id: '11111111-1111-4111-8111-111111111111',
  terms_url: 'https://app.gridex.se/legal/terms',
  privacy_policy_version: '2026-07',
  privacy_policy_version_id: '22222222-2222-4222-8222-222222222222',
  privacy_policy_url: 'https://app.gridex.se/legal/privacy',
  withdrawal_version: '2026-07',
  withdrawal_version_id: '33333333-3333-4333-8333-333333333333',
  withdrawal_url: 'https://app.gridex.se/legal/withdrawal',
  price_terms_version: '2026-07',
  price_terms_version_id: '44444444-4444-4444-8444-444444444444',
  price_terms_url: 'https://app.gridex.se/legal/price-terms',
}

const sanitizedComponents = sanitizePricingComponentsBeforeAreaResolution(pricingComponents, 'fixed')
assert.equal(sanitizedComponents.some((component) => component.amount === 140), false, 'fixed price component must not cross the pre-resolution boundary')
assert.equal(sanitizedComponents.some((component) => component.component_code === 'monthly_fee'), true)

const display = buildPublicContractDisplay(fixedContract)
assert.equal(display.rows.some((row) => row.value === 140), false, 'fixed price must not render before SE-area resolution')
assert.equal(display.rows.some((row) => row.key === 'invoice_fee_sek'), false, 'hidden invoice fee must not render')
assert.equal(display.rows.some((row) => row.key === 'area_price_notice'), true, 'fixed contract must instruct the customer to resolve the area')

const browserContract = toBrowserPublicContract(fixedContract)
assert.equal(browserContract.pricing.fixed_price, null)
assert.equal(browserContract.pricing.invoice_fee, null)
assert.equal(browserContract.pricing.components.some((component) => component.component_code === 'fixed_price_ore_per_kwh'), false)
assert.equal(browserContract.pricing.components.some((component) => component.component_code === 'invoice_fee'), false)

const preview = {
  contract: { offerReference: fixedContract.offer_reference, name: fixedContract.name, contractType: 'fixed' },
  kwh: 100,
  annual_consumption_kwh: 1200,
  price_area_code: 'SE3',
  pricePerKwhOre: 140,
  totalMonthlyCostSek: 208,
  totalMonthlyCostInclVatSek: 260,
  totalYearlyCostSek: 3120,
  pricing_interval: 'month',
  estimate_method: 'ops_canonical_quote',
  source_window: null,
  market_data_timestamp: new Date().toISOString(),
  is_binding: true,
  assumptions: [],
  market_sources: [],
  specification: {
    basis: { market_ore_per_kwh: 140, source_period: null, price_area_code: 'SE3' },
    fees: {
      monthlyFeeSek: 49,
      invoiceFeeSek: 19,
      invoiceFeeIncludedInMonthlyEstimate: true,
      billingIntervalMonths: 1,
    },
    contract_display_snapshot: display.snapshot,
  },
}
assert.equal(preview.specification.fees.invoiceFeeSek, 19, 'hidden invoice fee must remain in the server calculation')
assert.equal(preview.totalMonthlyCostSek, 208, 'hidden invoice fee must remain included in the total')

process.env.GRIDEX_WEBSITE_PRICING_QUOTE_SECRET = 'test-secret-that-is-long-enough-for-hmac'
const issued = issueWebsitePricingQuote({
  preview: {
    ...preview,
    pricing_snapshot_reference: 'wps_visibility_test',
    ops_quote_reference: 'quote_visibility_test',
    valid_until: new Date(Date.now() + 10 * 60_000).toISOString(),
    pricing_interval: 'month',
    estimate_method: 'ops_canonical_quote',
    pricing_snapshot_schema_version: '2026-07-23.1',
    is_binding: true,
    public_contract_etag: '"visibility-etag"',
    publication_revision: 'revision_visibility_test',
    contract_payload_sha256: 'a'.repeat(64),
    legal_bundle_version: 'legal_visibility_test',
    legal_document_hashes: {},
  },
  contract: fixedContract,
  location: { postalCode: '58222', city: 'Linköping', address: 'Storgatan 1' },
})
assert.ok(issued, 'a signed website quote must be issued')
const tokenPayload = JSON.parse(Buffer.from(issued.token.split('.')[1], 'base64url').toString('utf8'))
assert.equal(tokenPayload.specification?.fees?.invoiceFeeSek, undefined, 'hidden invoice fee must not be disclosed in the browser token')
assert.equal(tokenPayload.total_monthly_cost_sek, 208, 'the browser total must still include the hidden invoice fee')

const resultCard = read('components/PriceResultCard.tsx')
assert.equal(resultCard.includes('OPS-offert'), false)
assert.equal(resultCard.includes('kommer från OPS'), false)
assert.equal(resultCard.includes('fees.invoiceFeeSek'), false)
assert.equal(resultCard.includes('• inräknad'), false)
assert.equal(resultCard.includes('CUSTOMER_NETWORK_FEE_NOTICE'), true)

const quote = read('lib/website/pricingQuote.ts')
assert.equal(quote.includes('delete fees.invoiceFeeSek'), true, 'signed browser token must not disclose the hidden invoice fee')
assert.equal(quote.includes('delete fees.invoiceFeeIncludedInMonthlyEstimate'), true)

for (const file of [
  'components/signup/CustomerApplicationForm.tsx',
  'components/signup/SignupFlowClient.tsx',
  'app/(public)/teckna-avtal/tack/SignupThanksPage.tsx',
  'lib/content/faq.ts',
]) {
  assert.equal(read(file).includes('OPS'), false, `${file} must not show internal system terminology to customers`)
}

console.log('Customer-facing pricing visibility tests passed')
