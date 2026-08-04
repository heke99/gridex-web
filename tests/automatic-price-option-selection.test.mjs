import assert from 'node:assert/strict'
import { selectAutomaticPublicContractPriceOption } from '../lib/website/publicContractContract.ts'

const option = (reference, isDefault, selectionRequired = true) => ({
  price_option_reference: reference,
  customer_type: 'private',
  valid_from: null,
  valid_to: null,
  earliest_start_date: null,
  latest_start_date: null,
  area_prices: [],
  selection_required: selectionRequired,
  is_default: isDefault,
  price_type: 'variable_monthly',
  contract_type: 'variable_monthly',
})

let result = selectAutomaticPublicContractPriceOption({
  options: [option('option_a', false), option('option_b', true)],
  customer_type: 'private',
  price_area_code: 'SE3',
  start_date: '2026-09-01',
})
assert.equal(result.status, 'selected')
assert.equal(result.status === 'selected' ? result.option.price_option_reference : null, 'option_b')

result = selectAutomaticPublicContractPriceOption({
  options: [option('option_a', false)],
  customer_type: 'private',
  price_area_code: 'SE3',
  start_date: '2026-09-01',
})
assert.equal(result.status, 'selected')
assert.equal(result.status === 'selected' ? result.option.price_option_reference : null, 'option_a')

result = selectAutomaticPublicContractPriceOption({
  options: [option('option_a', false), option('option_b', false)],
  customer_type: 'private',
  price_area_code: 'SE3',
  start_date: '2026-09-01',
})
assert.equal(result.status, 'selection_required')

console.log('Automatic price option selection runtime checks passed')
