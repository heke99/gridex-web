import assert from 'node:assert/strict'
import { normalizePublicContractApiPayload, selectPublicContractPriceOption } from '../lib/website/publicContractContract.ts'

const base = (reference, overrides = {}) => ({
  price_option_reference: reference,
  option_code: reference,
  customer_name: reference,
  contract_type: 'variable_monthly',
  customer_type: 'private',
  binding_months: 0,
  notice_months: 1,
  auto_renew_enabled: false,
  renewal_term_months: null,
  default: false,
  selection_required: false,
  valid_from: null,
  valid_to: null,
  earliest_start_date: null,
  latest_start_date: null,
  area_prices: [{ price_area_code: 'SE3', fixed_price_ore_per_kwh: 100, vat_included: true, vat_rate: 25 }],
  ...overrides,
})

const options = [base('option_a', { default: true }), base('option_b')]
assert.equal(selectPublicContractPriceOption({ options, customer_type: 'private', price_area_code: 'SE3', start_date: '2026-09-01', current_date: '2026-07-31' }).option?.price_option_reference, 'option_a')
assert.equal(selectPublicContractPriceOption({ options: [base('option_a'), base('option_b')], customer_type: 'private', price_area_code: 'SE3', start_date: '2026-09-01', current_date: '2026-07-31' }).status, 'selection_required')
assert.equal(selectPublicContractPriceOption({ options: [base('option_a', { selection_required: true })], customer_type: 'private', price_area_code: 'SE3', start_date: '2026-09-01', current_date: '2026-07-31' }).status, 'selection_required')
assert.equal(selectPublicContractPriceOption({ options: [base('option_a', { customer_type: 'business' })], customer_type: 'private', price_area_code: 'SE3', start_date: '2026-09-01', current_date: '2026-07-31' }).status, 'unavailable')
assert.equal(selectPublicContractPriceOption({ options: [base('option_a', { valid_to: '2026-07-30' })], customer_type: 'private', price_area_code: 'SE3', start_date: '2026-09-01', current_date: '2026-07-31' }).status, 'unavailable')
assert.equal(selectPublicContractPriceOption({ options: [base('option_a', { earliest_start_date: '2026-10-01' })], customer_type: 'private', price_area_code: 'SE3', start_date: '2026-09-01', current_date: '2026-07-31' }).status, 'unavailable')
assert.equal(selectPublicContractPriceOption({ options: [base('option_a', { area_prices: [{ price_area_code: 'SE4', fixed_price_ore_per_kwh: 100, vat_included: true, vat_rate: 25 }] })], customer_type: 'private', price_area_code: 'SE3', start_date: '2026-09-01', current_date: '2026-07-31' }).status, 'unavailable')

const duplicate = normalizePublicContractApiPayload({ offer_reference: 'offer_duplicate', name: 'Duplicate', contract_type: 'variable_monthly', energy_direction: 'consumption', price_options: [base('option_a'), base('option_a')] })
assert.equal(duplicate, null)
console.log('canonical price option selection tests passed')
