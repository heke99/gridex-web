import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const route = read('app/api/checkout/quote/route.ts')
const calculator = read('components/ElectricityCalculator.tsx')
const form = read('components/signup/CustomerApplicationForm.tsx')
const signup = read('app/(public)/teckna-avtal/page.tsx')
const quote = read('lib/website/pricingQuote.ts')

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
  assert.ok(route.includes(selection), `quote route must validate ${selection}`)
  assert.ok(calculator.includes(selection), `calculator must submit ${selection}`)
  assert.ok(quote.includes(selection), `signed quote must lock ${selection}`)
}
assert.ok(route.includes('price_option_invalid'))
assert.ok(route.includes('component_selection_invalid'))
assert.ok(quote.includes('const QUOTE_VERSION = "v5"'))
assert.ok(!signup.includes('server price verification failed'))
console.log('Signup quote binding regression checks passed')
