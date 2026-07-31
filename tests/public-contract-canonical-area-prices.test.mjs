import assert from 'node:assert/strict'
import {
  normalizePublicContractApiPayload,
  publicContractValidationIssues,
  selectPublicContractPriceOption,
} from '../lib/website/publicContractContract.ts'

const area = (reference = 'area_price_canonical_se3', overrides = {}) => ({
  area_price_reference: reference,
  price_area: 'SE3',
  energy_price_ore_per_kwh: 100,
  unit: 'ore_per_kwh',
  valid_from: null,
  valid_to: null,
  ...overrides,
})

const option = (reference = 'price_option_canonical', overrides = {}) => ({
  price_option_reference: reference,
  option_code: 'standard',
  customer_name: 'Standard',
  contract_type: 'fixed',
  customer_type: 'private',
  binding_months: 12,
  notice_months: 1,
  auto_renew_enabled: false,
  renewal_term_months: null,
  default: true,
  selection_required: false,
  valid_from: null,
  valid_to: null,
  earliest_start_date: null,
  latest_start_date: null,
  area_prices: [area()],
  ...overrides,
})

const contract = (overrides = {}) => ({
  offer_reference: 'offer_reproduction',
  name: 'Fast elpris',
  contract_type: 'fixed',
  energy_direction: 'consumption',
  customer_type: 'private',
  channel: 'website',
  price_options: [option()],
  pricing: {
    visibility: {},
    calculation_components: [],
    display_components: [],
    summary_components: [],
    calculation_contract: {},
  },
  legal: { requirements: [] },
  ...overrides,
})

const normalized = normalizePublicContractApiPayload(contract())
assert.ok(normalized, 'live canonical fixed contract must normalize')
assert.deepEqual(normalized.price_options[0].area_prices[0], area())
assert.equal(normalized.channel, 'website')
assert.equal(normalized.customer_type, 'private')
assert.deepEqual(normalized.price_areas, ['SE3'])
assert.equal(normalized.area_pricing[0]?.price_area_code, 'SE3')
assert.equal(normalized.area_pricing[0]?.fixed_price_ore_per_kwh, 100)

const selected = selectPublicContractPriceOption({
  options: normalized.price_options,
  customer_type: 'private',
  price_area_code: 'SE3',
  start_date: '2026-09-01',
})
assert.equal(selected.status, 'selected')
assert.equal(selected.area_price?.area_price_reference, 'area_price_canonical_se3')

const futureAreaOption = option('price_option_future_area', {
  area_prices: [area('area_price_future', { valid_from: '2026-10-01' })],
})
assert.equal(selectPublicContractPriceOption({
  options: [futureAreaOption],
  customer_type: 'private',
  price_area_code: 'SE3',
  start_date: '2026-09-01',
}).status, 'unavailable')
assert.equal(selectPublicContractPriceOption({
  options: [futureAreaOption],
  customer_type: 'private',
  price_area_code: 'SE3',
  start_date: '2026-10-01',
}).status, 'selected')

const expiredAreaOption = option('price_option_expired_area', {
  area_prices: [area('area_price_expired', { valid_to: '2026-08-31' })],
})
assert.equal(selectPublicContractPriceOption({
  options: [expiredAreaOption],
  customer_type: 'private',
  price_area_code: 'SE3',
  start_date: '2026-09-01',
}).status, 'unavailable')

const invalidCases = [
  [contract({ price_options: [option('price_option_missing_ref', { area_prices: [{ ...area(), area_price_reference: undefined }] })] }), 'area_price_reference_missing'],
  [contract({ price_options: [option('price_option_bad_unit', { area_prices: [area('area_price_bad_unit', { unit: 'sek_per_kwh' })] })] }), 'area_price_unit_invalid'],
  [contract({ price_options: [option('price_option_zero', { area_prices: [area('area_price_zero', { energy_price_ore_per_kwh: 0 })] })] }), 'energy_price_ore_per_kwh_invalid'],
  [contract({ price_options: [option('price_option_negative', { area_prices: [area('area_price_negative', { energy_price_ore_per_kwh: -1 })] })] }), 'energy_price_ore_per_kwh_invalid'],
  [contract({ channel: 'api' }), 'channel_not_website'],
  [contract({ price_options: [] }), 'price_options_missing'],
]
for (const [payload, expectedCode] of invalidCases) {
  assert.equal(normalizePublicContractApiPayload(payload), null, expectedCode)
  assert.ok(publicContractValidationIssues(payload, 'data[2]').some((issue) => issue.code === expectedCode), expectedCode)
}

const duplicateReference = contract({
  price_options: [option('price_option_duplicate_area', {
    area_prices: [area('area_price_duplicate'), area('area_price_duplicate', { price_area: 'SE4' })],
  })],
})
assert.equal(normalizePublicContractApiPayload(duplicateReference), null)
assert.ok(publicContractValidationIssues(duplicateReference).some((issue) => issue.code === 'duplicate_area_price_reference'))

const overlap = contract({
  price_options: [option('price_option_overlap', {
    area_prices: [
      area('area_price_overlap_1', { valid_from: '2026-01-01', valid_to: '2026-12-31' }),
      area('area_price_overlap_2', { valid_from: '2026-06-01', valid_to: null }),
    ],
  })],
})
assert.equal(normalizePublicContractApiPayload(overlap), null)
assert.ok(publicContractValidationIssues(overlap).some((issue) => issue.code === 'overlapping_area_price_validity'))

const legacyAlias = contract({
  price_options: [option('price_option_legacy_alias', {
    area_prices: [{
      area_price_reference: 'area_price_legacy_alias',
      price_area_code: 'SE3',
      fixed_price_ore_per_kwh: 101,
      unit: 'ore_per_kwh',
      valid_from: null,
      valid_to: null,
    }],
  })],
})
const legacyNormalized = normalizePublicContractApiPayload(legacyAlias)
assert.equal(legacyNormalized?.price_options[0].area_prices[0].price_area, 'SE3')
assert.equal(legacyNormalized?.price_options[0].area_prices[0].energy_price_ore_per_kwh, 101)

console.log('canonical public-contract area price tests passed')
