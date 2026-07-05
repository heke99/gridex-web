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
