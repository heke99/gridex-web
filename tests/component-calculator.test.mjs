import assert from 'node:assert/strict'
import {
  calculatePricingComponents,
  UnsupportedPricingComponentError,
} from '../lib/website/componentCalculator.ts'

const base = {
  currency: 'SEK',
  calculation_inclusion: 'included',
  website_visibility: 'hidden',
  website_card_visible: false,
  calculation_base: null,
  vat_included: false,
  vat_rate: 0.25,
}

const result = calculatePricingComponents([
  { ...base, component_code: 'markup', name: 'Påslag', amount: 4, unit: 'ore_per_kwh' },
  { ...base, component_code: 'monthly_fee', name: 'Månadsavgift', amount: 49, unit: 'sek_month' },
  { ...base, component_code: 'invoice_fee', name: 'Fakturaavgift', amount: 19, unit: 'sek_invoice', invoices_per_year: 4 },
  { ...base, component_code: 'year_fee', name: 'Årsavgift', amount: 120, unit: 'sek_year' },
  { ...base, component_code: 'energy_percent', name: 'Procentavgift', amount: 2, unit: 'percent', calculation_base: 'energy_cost' },
], {
  monthlyKwh: 100,
  annualKwh: 1200,
  baseEnergyPriceOrePerKwh: 100,
})

// 4 + 49 + (19 * 4 / 12) + 10 + 2 = 71.333...
assert.ok(Math.abs(result.total_ex_vat_sek - 71.3333333333) < 0.0001)
assert.ok(Math.abs(result.total_inc_vat_sek - 89.1666666666) < 0.0001)
assert.equal(result.components.find((item) => item.component_code === 'invoice_fee')?.amount_ex_vat_sek, 19 / 3)

assert.throws(() => calculatePricingComponents([
  { ...base, component_code: 'invoice_fee', name: 'Fakturaavgift', amount: 19, unit: 'sek_invoice' },
], { monthlyKwh: 100, annualKwh: 1200, baseEnergyPriceOrePerKwh: 100 }), UnsupportedPricingComponentError)

assert.throws(() => calculatePricingComponents([
  { ...base, component_code: 'future_fee', name: 'Ny obligatorisk avgift', amount: 5, unit: 'sek_fortnight' },
], { monthlyKwh: 100, annualKwh: 1200, baseEnergyPriceOrePerKwh: 100 }), UnsupportedPricingComponentError)

assert.throws(() => calculatePricingComponents([
  { ...base, component_code: 'percent_without_base', name: 'Procentavgift', amount: 2, unit: 'percent' },
], { monthlyKwh: 100, annualKwh: 1200, baseEnergyPriceOrePerKwh: 100 }), UnsupportedPricingComponentError)

console.log('Pricing component calculator tests passed')
