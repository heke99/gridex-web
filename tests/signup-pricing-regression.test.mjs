import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validatePricingPreviewSnapshot } from '../lib/website/snapshotValidation.ts'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const route = read('app/api/checkout/quote/route.ts')
const calculator = read('components/ElectricityCalculator.tsx')
const form = read('components/signup/CustomerApplicationForm.tsx')
const signup = read('app/(public)/teckna-avtal/page.tsx')
const quote = read('lib/website/pricingQuote.ts')
const canonical = read('lib/website/canonicalQuoteValidation.ts')

assert.ok(route.includes('issueWebsitePricingQuote'))
assert.ok(route.includes('annual_consumption_kwh: annualKwh'))
assert.ok(calculator.includes('annual_consumption_kwh: consumptionProfile.annual_kwh'))
assert.ok(calculator.includes('pricing_snapshot_reference: preview.pricing_snapshot_reference'))
assert.ok(form.includes('name="pricing_snapshot_reference"'))
assert.ok(form.includes('name="annual_consumption_kwh"'))
assert.ok(signup.includes('pricingSnapshotReference'))
assert.ok(signup.includes('annualConsumptionKwh'))
assert.ok(signup.includes('signedPreview'))
for (const selection of [
  'price_option_reference',
  'invoice_delivery_method',
  'selected_component_references',
  'site_count',
]) {
  assert.ok(route.includes(selection), `quote route must bind ${selection}`)
  assert.ok(quote.includes(selection), `signed quote must lock ${selection}`)
}
assert.ok(!calculator.includes('price_option_reference: priceOptionReference'))
assert.ok(!calculator.includes('invoice_delivery_method: invoiceDeliveryMethod'))
assert.ok(!calculator.includes('selected_component_references: selectedComponentReferences'))
assert.ok(!calculator.includes('site_count: siteCount'))
assert.ok(route.includes('price_option_invalid'))
assert.ok(route.includes('component_selection_invalid'))
assert.ok(route.includes('selectAutomaticPublicContractPriceOption'))
assert.ok(route.includes('GRIDEX_FALLBACK_INVOICE_DELIVERY_METHOD'))
assert.ok(route.includes('GRIDEX_WEBSITE_SITE_COUNT'))
assert.ok(route.includes('selectedAreaPriceReference'))
assert.ok(route.includes('opsQuote.area_price_reference !== selectedAreaPriceReference'))
assert.ok(quote.includes('area_price_reference: input.preview.area_price_reference'))
assert.ok(quote.includes('area_price_reference: quote.area_price_reference'))
assert.ok(quote.includes('const CURRENT_TOKEN_VERSION = "v7"'))
assert.ok(!quote.includes('Date.parse(parsed.valid_until) <= now.getTime()'))
assert.ok(quote.includes('not invalidated because wall-clock time passes'))
assert.ok(canonical.includes('allowExpired: true'))
assert.ok(!canonical.includes('refreshCanonicalQuote'))
assert.ok(canonical.includes('displayedQuote'))
assert.ok(route.includes('quoteAttemptId'))
assert.ok(calculator.includes('crypto.randomUUID()'))
assert.ok(!signup.includes('server price verification failed'))

const contract = { offer_reference: 'offer_test' }
const livePreview = {
  contract: { offer_reference: 'offer_test' },
  priceArea: 'SE3',
  price_area_code: 'SE3',
  kwh: 350,
  price_option_reference: 'price_option_test',
  area_price_reference: null,
  pricePerKwhOre: 87.25,
  totalMonthlyCostSek: 355.42,
  totalMonthlyCostInclVatSek: 444.28,
}
const baseSnapshot = {
  contract: { offer_reference: 'offer_test' },
  price_area_code: 'SE3',
  kwh: 350,
  price_option_reference: 'price_option_test',
  area_price_reference: null,
  pricePerKwhOre: 87.25,
  totalMonthlyCostSek: 355.42,
  totalMonthlyCostInclVatSek: 444.28,
}
const validateAreaPriceReference = (snapshot, preview = livePreview) => validatePricingPreviewSnapshot({
  contract,
  snapshot,
  livePreview: preview,
  expectedPriceArea: 'SE3',
  expectedMonthlyKwh: 350,
})
const areaPriceMismatchReason = 'områdespris i pricing_preview_snapshot matchar inte den signerade offerten'

assert.equal(validateAreaPriceReference(baseSnapshot).ok, true, 'canonical null must match canonical null')

const missingAreaPriceReference = { ...baseSnapshot }
delete missingAreaPriceReference.area_price_reference
assert.equal(validateAreaPriceReference(missingAreaPriceReference).ok, false, 'missing area_price_reference must fail closed')
assert.ok(validateAreaPriceReference(missingAreaPriceReference).reasons.includes(areaPriceMismatchReason))

assert.equal(
  validateAreaPriceReference({ ...baseSnapshot, area_price_reference: '' }).ok,
  false,
  'blank area_price_reference must fail closed',
)
assert.equal(
  validateAreaPriceReference(baseSnapshot, { ...livePreview, area_price_reference: 'area_price_se3' }).ok,
  false,
  'null snapshot must not match a concrete signed area-price reference',
)
assert.equal(
  validateAreaPriceReference(
    { ...baseSnapshot, area_price_reference: 'area_price_se3' },
    { ...livePreview, area_price_reference: 'area_price_se3' },
  ).ok,
  true,
  'matching concrete area-price references must pass',
)

console.log('Signup quote binding regression checks passed')