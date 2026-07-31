import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { normalizePublicContractApiPayload } from '../lib/website/publicContractContract.ts'
import { buildPublicContractDisplay } from '../lib/website/publicContractDisplay.ts'


const TEST_PRICE_OPTION = {
  price_option_reference: 'price_option_test',
  option_code: 'standard',
  customer_name: 'Standard',
  contract_type: 'variable_monthly',
  customer_type: 'both',
  binding_months: 0,
  notice_months: 1,
  auto_renew_enabled: false,
  renewal_term_months: null,
  default: true,
  selection_required: false,
  valid_from: null,
  valid_to: null,
  earliest_start_date: null,
  latest_start_date: null,
  area_prices: [{ area_price_reference: 'area_price_test_se3', price_area: 'SE3', energy_price_ore_per_kwh: 100, unit: 'ore_per_kwh', valid_from: null, valid_to: null }],
}

const fixture = JSON.parse(readFileSync(new URL('./fixtures/public-contracts.documented.json', import.meta.url), 'utf8'))
const contract = normalizePublicContractApiPayload(fixture.data[0])


const emptyLegalRequirementsContract = normalizePublicContractApiPayload({
  offer_reference: 'offer_empty_legal_requirements',
  name: 'Publicerat avtal utan checkboxkrav',
  energy_direction: 'consumption',
  price_options: [TEST_PRICE_OPTION],
  contract_type: 'variable_monthly',
  legal: { requirements: [] },
})
assert.ok(emptyLegalRequirementsContract)
assert.equal(
  buildPublicContractDisplay(emptyLegalRequirementsContract).ready,
  true,
  'OPS legal.requirements=[] must remain a valid published contract',
)

const malformedRequiredLegalContract = normalizePublicContractApiPayload({
  offer_reference: 'offer_malformed_required_legal',
  name: 'Avtal med trasigt obligatoriskt krav',
  energy_direction: 'consumption',
  price_options: [TEST_PRICE_OPTION],
  contract_type: 'variable_monthly',
  legal: {
    requirements: [{
      requirement_code: 'terms',
      acceptance_type: 'checkbox',
      required: true,
      label: 'Jag godkänner villkoren',
      document_version: null,
      public_url: null,
    }],
  },
})
assert.ok(malformedRequiredLegalContract)
assert.equal(
  buildPublicContractDisplay(malformedRequiredLegalContract).ready,
  false,
  'a malformed required legal requirement must still fail closed',
)

assert.ok(contract, 'the documented public-contracts payload must normalize')
assert.equal(contract.offer_reference, 'offer_variable_202606')
assert.equal(contract.product_code, 'RORLIGT-ELPRIS')
assert.equal(contract.monthly_fee_sek, 68)
assert.equal(contract.markup_ore_per_kwh, 4)
assert.equal(contract.terms_version, '2026-06')
assert.equal(contract.withdrawal_version, '2026-06')
assert.equal(contract.price_plan_id, undefined)
assert.equal(contract.price_plan_version_id, undefined)
assert.equal(contract.id, undefined)
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
  energy_direction: 'consumption',
  price_options: [TEST_PRICE_OPTION],
  contract_type: 'variable_monthly',
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
  energy_direction: 'consumption',
  price_options: [TEST_PRICE_OPTION],
  contract_type: 'variable_monthly',
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
  energy_direction: 'consumption',
  price_options: [TEST_PRICE_OPTION],
  contract_type: 'variable_monthly',
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
  energy_direction: 'consumption',
  price_options: [TEST_PRICE_OPTION],
  contract_type: 'variable_monthly',
  pricing_components: [
    { key: 'admin_a', title: 'Administrationsavgift', amount: 29, unit: 'kr/faktura', show_on_website: true },
    { key: 'admin_b', title: 'Grundavgift', amount: 59, unit: 'kr per månad', show_on_website: true },
  ],
})

assert.ok(unitOnlyContract, 'top-level pricing_components must normalize')
assert.equal(unitOnlyContract.invoice_fee_sek, 29)
assert.equal(unitOnlyContract.monthly_fee_sek, 59)

const canonicalLifecycleContract = normalizePublicContractApiPayload({
  offer_reference: 'offer_canonical_lifecycle',
  code: 'RORLIGT-CANONICAL',
  name: 'Rörligt canonical',
  energy_direction: 'consumption',
  price_options: [TEST_PRICE_OPTION],
  contract_type: 'variable_monthly',
  customer_type: 'both',
  binding_months: 0,
  notice_months: 1,
  automatic_renewal: true,
  pricing: {
    monthly_fee: 49,
    invoice_fee: 0,
    markup: 4,
    vat_rate: 0.25,
  },
  legal: {
    terms_version: '2026-07',
    privacy_policy_version: '2026-07',
    withdrawal_version: '2026-07',
  },
})

assert.ok(canonicalLifecycleContract, 'canonical lifecycle contract must normalize')
assert.equal(canonicalLifecycleContract.type, 'variable_monthly')
assert.equal(canonicalLifecycleContract.binding_months, 0)
assert.equal(canonicalLifecycleContract.notice_months, 1)
assert.equal(canonicalLifecycleContract.automatic_renewal, true)
assert.equal(canonicalLifecycleContract.invoice_fee_sek, 0)
assert.equal(canonicalLifecycleContract.vat_rate, 0.25)


const canonicalAreaContract = normalizePublicContractApiPayload({
  offer_reference: 'offer_fixed_area_canonical',
  product_code: 'FAST-AREA',
  name: 'Fastpris per område',
  energy_direction: 'consumption',
  price_options: [TEST_PRICE_OPTION],
  contract_type: 'fixed',
  customer_types: ['private', 'business'],
  price_areas: ['SE1', 'SE2', 'SE3', 'SE4'],
  area_pricing: [
    { price_area_code: 'SE1', fixed_price: { amount: 95, unit: 'ore_per_kwh', vat_included: false, vat_rate: 0.25 } },
    { price_area_code: 'SE4', fixed_price: { amount: 140, unit: 'ore_per_kwh', vat_included: false, vat_rate: 0.25 } },
  ],
  pricing: {
    calculation_components: [
      { component_code: 'monthly_fee', name: 'Månadsavgift', amount: 49, unit: 'sek_month', calculation_inclusion: 'included', website_visibility: 'visible', vat_included: false, vat_rate: 0.25 },
      { component_code: 'invoice_fee', name: 'Fakturaavgift', amount: 19, unit: 'sek_invoice', calculation_inclusion: 'included', website_visibility: 'hidden', invoices_per_year: 12, vat_included: false, vat_rate: 0.25 },
    ],
    display_components: [
      { component_code: 'monthly_fee', name: 'Månadsavgift', amount: 49, unit: 'sek_month', website_visibility: 'visible' },
    ],
    summary_components: [
      { component_code: 'terms_summary', name: 'Prissammanställning', amount: 0, unit: 'sek', website_visibility: 'summary_only' },
    ],
  },
  legal: {
    requirements: [
      {
        requirement_code: 'terms',
        acceptance_type: 'checkbox',
        required: true,
        label: 'Jag godkänner villkoren.',
        document_id: 'doc_terms',
        legal_bundle_version_document_id: 'bundle_doc_terms',
        document_version: '2026-07-24.2',
        document_hash: 'b'.repeat(64),
        public_url: 'https://app.gridex.se/legal/terms',
      },
    ],
  },
})

assert.ok(canonicalAreaContract, 'canonical current contract must normalize')
assert.equal(canonicalAreaContract.contract_type, 'fixed')
assert.deepEqual(canonicalAreaContract.price_areas, ['SE1', 'SE2', 'SE3', 'SE4'])
assert.equal(canonicalAreaContract.area_pricing.find((row) => row.price_area_code === 'SE4')?.fixed_price_ore_per_kwh, 140)
assert.equal(canonicalAreaContract.calculation_components.length, 2)
assert.equal(canonicalAreaContract.display_components.length, 1)
assert.equal(canonicalAreaContract.summary_components[0].website_visibility, 'summary_only')
assert.equal(canonicalAreaContract.calculation_components.find((row) => row.component_code === 'invoice_fee')?.website_visibility, 'hidden')
assert.equal(canonicalAreaContract.legal_requirements[0]?.document_reference, 'doc_terms')
assert.equal(canonicalAreaContract.calculation_components.find((row) => row.component_code === 'invoice_fee')?.invoices_per_year, 12)
assert.equal(canonicalAreaContract.legal_requirements[0].document_hash, 'b'.repeat(64))
