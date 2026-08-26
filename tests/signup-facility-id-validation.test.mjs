import assert from 'node:assert/strict'
import {
  isValidSwedishFacilityId,
  normalizeSwedishFacilityId,
} from '../lib/website/signupValidation.ts'

assert.equal(normalizeSwedishFacilityId('735 999 123 456 789 012'), '735999123456789012')
assert.equal(normalizeSwedishFacilityId('735999-123456-789012'), '735999123456789012')
assert.equal(isValidSwedishFacilityId('735999123456789012'), true)
assert.equal(isValidSwedishFacilityId('735 999 123 456 789 012'), true)
assert.equal(isValidSwedishFacilityId('735991123456789012'), false)
assert.equal(isValidSwedishFacilityId('73599912345678901'), false)
assert.equal(isValidSwedishFacilityId('7359991234567890123'), false)

console.log('signup facility ID validation: OK')
