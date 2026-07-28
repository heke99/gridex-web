import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const route = read('app/api/checkout/quote/route.ts')
const calculator = read('components/ElectricityCalculator.tsx')
const form = read('components/signup/CustomerApplicationForm.tsx')
const signup = read('app/(public)/teckna-avtal/page.tsx')

assert.ok(route.includes('issueWebsitePricingQuote'))
assert.ok(route.includes('annual_consumption_kwh: annualKwh'))
assert.ok(calculator.includes('annual_consumption_kwh: consumptionProfile.annual_kwh'))
assert.ok(calculator.includes('pricing_snapshot_reference: preview.pricing_snapshot_reference'))
assert.ok(form.includes('name="pricing_snapshot_reference"'))
assert.ok(form.includes('name="annual_consumption_kwh"'))
assert.ok(signup.includes('pricingSnapshotReference'))
assert.ok(signup.includes('annualConsumptionKwh'))
assert.ok(signup.includes('signedPreview'))
assert.ok(!signup.includes('server price verification failed'))
console.log('Signup quote binding regression checks passed')
