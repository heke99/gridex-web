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

console.log('Public contract DTO compatibility checks passed')
