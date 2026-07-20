import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  annualToMonthlyKwh,
  buildCustomerEnteredConsumptionProfile,
  buildEstimatedConsumptionProfile,
  consumptionProfileMatchesMonthlyKwh,
  estimateAnnualConsumptionKwh,
  normalizeWebsiteConsumptionProfile,
} from '../lib/website/consumptionEstimator.ts'

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

const apartment = estimateAnnualConsumptionKwh({
  housingType: 'apartment',
  areaSqm: 70,
  heatingType: 'district_heating',
  householdSize: 2,
  extras: [],
})
assert.equal(apartment, 3100)

const villaDistrict = estimateAnnualConsumptionKwh({
  housingType: 'villa',
  areaSqm: 140,
  heatingType: 'district_heating',
  householdSize: 4,
  extras: [],
})
const villaElectric = estimateAnnualConsumptionKwh({
  housingType: 'villa',
  areaSqm: 140,
  heatingType: 'direct_electric',
  householdSize: 4,
  extras: [],
})
assert.ok(villaElectric > villaDistrict + 10_000, 'electric heating must materially affect the estimate')

const withEv = estimateAnnualConsumptionKwh({
  housingType: 'villa',
  areaSqm: 140,
  heatingType: 'district_heating',
  householdSize: 4,
  extras: ['electric_vehicle'],
})
assert.equal(withEv - villaDistrict, 3000)

const entered = buildCustomerEnteredConsumptionProfile(5000)
assert.equal(entered.annual_kwh, 5000)
assert.equal(entered.monthly_kwh, 416.67)
assert.equal(annualToMonthlyKwh(5000), 416.67)
assert.ok(consumptionProfileMatchesMonthlyKwh(entered, 416.67))

const estimated = buildEstimatedConsumptionProfile({
  housingType: 'row_house',
  areaSqm: 110,
  heatingType: 'air_heat_pump',
  householdSize: 3,
  extras: ['electric_vehicle'],
  annualKwh: 12_000,
})
assert.equal(estimated.source, 'estimated')
assert.equal(estimated.customer_adjusted, true)
assert.equal(normalizeWebsiteConsumptionProfile(estimated)?.annual_kwh, 12_000)
assert.equal(
  normalizeWebsiteConsumptionProfile({ ...estimated, monthly_kwh: 999 }),
  null,
  'a client profile with mismatched annual/monthly usage must be rejected',
)

const calculator = read('components/ElectricityCalculator.tsx')
assert.ok(!calculator.includes('initialPricingPreview?.kwh ?? 2000'))
assert.ok(!calculator.includes('String(initialPricingPreview?.kwh ?? 2000)'))
assert.ok(calculator.includes('Ingen standardförbrukning används'))
assert.ok(calculator.includes('Bostadstyp'))
assert.ok(calculator.includes('Uppvärmning'))
assert.ok(calculator.includes('Personer i hushållet'))
assert.ok(calculator.includes('Större elanvändare'))

const faq = read('lib/content/faq.ts')
assert.ok(!faq.includes('Varför kan priset ändras innan jag tecknar?'))
assert.ok(!faq.includes('Hur länge gäller min prisberäkning?'))

const checkoutRoute = read('app/api/v1/website/checkout-context/route.ts')
assert.ok(checkoutRoute.includes('consumptionProfileMatchesMonthlyKwh'))

const signup = read('app/(public)/teckna-avtal/page.tsx')
assert.ok(signup.includes('consumption_profile: consumptionProfile'))
assert.ok(signup.includes('consumptionProfileMatchesMonthlyKwh'))

const legacyOffer = read('lib/gridex/offers.ts')
assert.ok(!legacyOffer.includes('safeNumber(value, 2000)'))
assert.ok(legacyOffer.includes('Ange en giltig månadsförbrukning.'))

const opsClient = read('lib/ops/client.ts')
assert.ok(opsClient.includes('isSafeOpsCanonicalRedirect'))
assert.ok(opsClient.includes('status !== 307 && status !== 308'))
assert.ok(opsClient.includes('opsFetch("/api/v1/website/quote"'))
assert.ok(!opsClient.includes('opsFetch("/api/v1/website/pricing/preview"'))

console.log('consumption estimator tests passed')
