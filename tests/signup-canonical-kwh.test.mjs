import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  annualToMonthlyKwh,
  buildCustomerEnteredConsumptionProfile,
  consumptionProfileMatchesMonthlyKwh,
} from '../lib/website/consumptionEstimator.ts'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const opsClient = read('lib/ops/client.ts')
const calculator = read('components/ElectricityCalculator.tsx')
const form = read('components/signup/CustomerApplicationForm.tsx')
const signupFlow = read('components/signup/SignupFlowClient.tsx')

const annualKwh = 5_000
const roundedMonthlyKwh = annualToMonthlyKwh(annualKwh)
const exactMonthlyKwh = annualKwh / 12
const profile = buildCustomerEnteredConsumptionProfile(annualKwh)

assert.equal(roundedMonthlyKwh, 416.67)
assert.ok(consumptionProfileMatchesMonthlyKwh(profile, exactMonthlyKwh))
assert.ok(opsClient.includes("import { annualToMonthlyKwh } from '@/lib/website/consumptionEstimator'"))
assert.ok(opsClient.includes('annualToMonthlyKwh(annualKwh)'))
assert.ok(!opsClient.includes('annualKwh !== null ? annualKwh / 12 : null'))
assert.ok(calculator.includes('estimated_monthly_kwh: preview.kwh'))
assert.ok(form.includes('value={pricingPreview?.kwh ?? quoteContext.estimated_monthly_kwh}'))
assert.ok(!form.includes('estimatedMonthlyKwh ?? pricingPreview?.kwh'))
assert.ok(!signupFlow.includes('const [estimatedMonthlyKwh'))
assert.ok(!signupFlow.includes('estimatedMonthlyKwh={estimatedMonthlyKwh}'))

console.log('Signup canonical monthly kWh regression checks passed')
