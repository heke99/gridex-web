import assert from 'node:assert/strict'
import {
  resolveWebsitePricingModel,
  usesDirectPublishedPricing,
  usesElprisetJustNu,
} from '../lib/website/contractPricingModel.ts'

const base = {
  offer_reference: 'offer',
  name: 'Elavtal',
  type: 'variable_spot',
}

assert.equal(resolveWebsitePricingModel(base), 'spot_monthly')
assert.equal(
  resolveWebsitePricingModel({ ...base, type: 'spot_hourly', name: 'Timpris' }),
  'spot_hourly',
)
assert.equal(
  resolveWebsitePricingModel({ ...base, type: 'variable_spot', pricing_model: 'quarter_hourly', name: 'Kvartspris' }),
  'spot_quarterly',
)
assert.equal(
  resolveWebsitePricingModel({ ...base, type: 'variable_spot', name: 'Rörligt månadspris' }),
  'spot_monthly',
  'generic månadspris must not be mistaken for a fixed monthly subscription',
)
assert.equal(
  resolveWebsitePricingModel({ ...base, type: 'fixed', fixed_price_ore_per_kwh: 89.5 }),
  'fixed_kwh_price',
)
assert.equal(
  resolveWebsitePricingModel({ ...base, type: 'monthly_fixed', monthly_fixed_price_sek: 699 }),
  'monthly_fixed',
)
assert.equal(usesElprisetJustNu('spot_monthly'), true)
assert.equal(usesElprisetJustNu('spot_hourly'), true)
assert.equal(usesElprisetJustNu('spot_quarterly'), true)
assert.equal(usesElprisetJustNu('fixed_kwh_price'), false)
assert.equal(usesDirectPublishedPricing('fixed_kwh_price'), true)
assert.equal(usesDirectPublishedPricing('portfolio'), false)

console.log('contract pricing model tests passed')
