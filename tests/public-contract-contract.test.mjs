import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { normalizePublicContractApiPayload } from '../lib/website/publicContractContract.ts'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/public-contracts.documented.json', import.meta.url), 'utf8'))
const contract = normalizePublicContractApiPayload(fixture.data[0])

assert.ok(contract, 'the documented public-contracts payload must normalize')
assert.equal(contract.offer_reference, 'offer_variable_202606')
assert.equal(contract.product_code, 'RORLIGT-ELPRIS')
assert.equal(contract.monthly_fee_sek, 68)
assert.equal(contract.markup_ore_per_kwh, 4)
assert.equal(contract.terms_version, '2026-06')
assert.equal(contract.withdrawal_version, '2026-06')
assert.equal(contract.price_plan_id, undefined)
assert.equal(contract.price_plan_version_id, undefined)
assert.equal(contract.power_of_attorney_required, true)
assert.equal(contract.power_of_attorney_version, '2026-06-poa')
assert.equal(contract.power_of_attorney_version_id, '44444444-4444-4444-8444-444444444444')
assert.equal(contract.terms_version_id, '11111111-1111-4111-8111-111111111111')
assert.equal(contract.terms_url, 'https://app.gridex.se/legal/gridex/terms/11111111-1111-4111-8111-111111111111')
assert.equal(contract.power_of_attorney_url, 'https://app.gridex.se/legal/gridex/power-of-attorney/44444444-4444-4444-8444-444444444444')

console.log('Public contract DTO compatibility checks passed')


const camelCaseContract = normalizePublicContractApiPayload({
  offerReference: 'offer_camel_poa',
  code: 'RORLIGT-POA',
  name: 'Rörligt med fullmakt',
  type: 'variable_spot',
  legal: {
    termsVersion: '2026-06',
    privacyPolicyVersion: '2026-06',
    withdrawalVersion: '2026-06',
    powerOfAttorneyRequired: true,
    powerOfAttorneyTextVersion: '2026-06-poa-camel',
    powerOfAttorneyVersionId: '66666666-6666-4666-8666-666666666666',
    powerOfAttorneyUrl: 'https://app.gridex.se/legal/gridex/power-of-attorney/66666666-6666-4666-8666-666666666666',
    priceTermsVersion: '2026-06',
    priceTermsVersionId: '77777777-7777-4777-8777-777777777777',
    priceTermsUrl: 'https://app.gridex.se/legal/gridex/price-terms/77777777-7777-4777-8777-777777777777',
  },
})

assert.ok(camelCaseContract, 'camelCase public-contract legal payload must normalize')
assert.equal(camelCaseContract.power_of_attorney_version, '2026-06-poa-camel')
assert.equal(camelCaseContract.power_of_attorney_version_id, '66666666-6666-4666-8666-666666666666')
assert.equal(camelCaseContract.price_terms_version_id, '77777777-7777-4777-8777-777777777777')
assert.equal(camelCaseContract.power_of_attorney_url, 'https://app.gridex.se/legal/gridex/power-of-attorney/66666666-6666-4666-8666-666666666666')
assert.equal(camelCaseContract.price_terms_url, 'https://app.gridex.se/legal/gridex/price-terms/77777777-7777-4777-8777-777777777777')

const componentOnlyContract = normalizePublicContractApiPayload({
  offer_reference: 'offer_component_only',
  code: 'MANAD-API',
  name: 'Månadspris från komponenter',
  type: 'variable_spot',
  pricing: {
    invoice_fee: null,
    components: [
      { component_code: 'supplier_markup', name: 'Påslag', amount: { amount: 4 }, unit: 'ore_per_kwh', website_card_visible: true },
      { component_code: 'monthly_fee', name: 'Månadsavgift', amount: { amount: 49 }, unit: 'month', website_card_visible: true },
      { component_code: 'paper_invoice_fee', name: 'Fakturaavgift', amount: { amount: 0 }, unit: 'invoice', website_card_visible: true },
    ],
  },
})

assert.ok(componentOnlyContract, 'component-only public pricing must normalize')
assert.equal(componentOnlyContract.pricing_components.length, 3)
assert.equal(componentOnlyContract.pricing_components[2].amount, 0, 'zero invoice fee must survive component normalization')

const aliasComponentContract = normalizePublicContractApiPayload({
  offer_reference: 'offer_component_aliases',
  code: 'ALIAS-API',
  name: 'Prisdelar med OPS-aliaser',
  type: 'variable_spot',
  pricing: {
    price_components: [
      { code: 'charge_a', label: 'Elhandelspåslag', value: { amount: '4,5' }, unit_code: 'öre/kWh', visible_on_website: true },
      { code: 'charge_b', label: 'Balansavgift', value: { value: 1.25 }, unit_code: 'ore_per_kwh', visible_on_website: true },
      { code: 'charge_c', label: 'Elcertifikatsavgift', price: { amount: 0.5, unit: 'ore_per_kwh' }, visible_on_website: true },
      { code: 'charge_d', label: 'Fast avgift', amount: 39, unit: 'SEK/månad', visible_on_website: true },
      { code: 'charge_e', label: 'Faktureringsavgift', amount: { value: { amount: 19 } }, unit: 'SEK', visible_on_website: true },
      { code: 'hidden_invoice', label: 'Fakturaavgift gammal', amount: 99, unit: 'SEK/faktura', visible_on_website: false },
    ],
  },
})

assert.ok(aliasComponentContract, 'OPS pricing component aliases must normalize')
assert.equal(aliasComponentContract.pricing_components.length, 6)
assert.equal(aliasComponentContract.markup_ore_per_kwh, 4.5)
assert.equal(aliasComponentContract.variable_markup_ore_per_kwh, 1.25)
assert.equal(aliasComponentContract.elcert_ore_per_kwh, 0.5)
assert.equal(aliasComponentContract.monthly_fee_sek, 39)
assert.equal(aliasComponentContract.invoice_fee_sek, 19, 'Faktureringsavgift must map to invoice fee')

const unitOnlyContract = normalizePublicContractApiPayload({
  offer_reference: 'offer_unit_only',
  name: 'Prisdelar med enhetsstyrning',
  type: 'variable_spot',
  pricing_components: [
    { key: 'admin_a', title: 'Administrationsavgift', amount: 29, unit: 'kr/faktura', show_on_website: true },
    { key: 'admin_b', title: 'Grundavgift', amount: 59, unit: 'kr per månad', show_on_website: true },
  ],
})

assert.ok(unitOnlyContract, 'top-level pricing_components must normalize')
assert.equal(unitOnlyContract.invoice_fee_sek, 29)
assert.equal(unitOnlyContract.monthly_fee_sek, 59)
