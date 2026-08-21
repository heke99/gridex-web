import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { portalOnboardingCandidateHasStableIdentity } from '../lib/customerPortal/onboardingResume.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function payload({ externalCustomerId = 'customer-ops-1', customerNumber = 'C-1001' } = {}) {
  return {
    application: {
      external_customer_id: externalCustomerId,
      customer_number: customerNumber,
    },
  }
}

const matchingProfile = {
  user_id: 'auth-user-1',
  email: 'customer@example.com',
  customer_number: 'C-1001',
  contract_customer_ref: 'C-1001',
  external_customer_id: 'customer-ops-1',
}

assert.equal(
  portalOnboardingCandidateHasStableIdentity(
    { auth_user_id: 'auth-user-1', payload: payload() },
    null,
    'auth-user-1',
  ),
  true,
  'a job already bound to the trusted Auth UUID must be resumable',
)

assert.equal(
  portalOnboardingCandidateHasStableIdentity(
    { auth_user_id: null, payload: payload() },
    matchingProfile,
    'auth-user-1',
  ),
  true,
  'an unbound job may resume when a stable OPS identity matches the authenticated profile',
)

assert.equal(
  portalOnboardingCandidateHasStableIdentity(
    { auth_user_id: null, payload: payload({ externalCustomerId: 'other', customerNumber: 'other' }) },
    matchingProfile,
    'auth-user-1',
  ),
  false,
  'same email without a stable customer identity match must never auto-link',
)

assert.equal(
  portalOnboardingCandidateHasStableIdentity(
    { auth_user_id: 'different-auth-user', payload: payload() },
    matchingProfile,
    'auth-user-1',
  ),
  false,
  'a job already bound to another Auth UUID must never be stolen by a later login',
)

assert.equal(
  portalOnboardingCandidateHasStableIdentity(
    { auth_user_id: null, payload: payload() },
    null,
    'auth-user-1',
  ),
  false,
  'email-only discovery is insufficient identity proof',
)

const loginSource = fs.readFileSync(path.join(root, 'app/login/actions.ts'), 'utf8')
assert.match(loginSource, /resumePortalOnboardingForConfirmedUserSafely/)

const confirmSource = fs.readFileSync(path.join(root, 'app/auth/confirm/route.ts'), 'utf8')
assert.match(confirmSource, /resumePortalOnboardingForConfirmedUserSafely/)

const registerSource = fs.readFileSync(path.join(root, 'app/register/page.tsx'), 'utf8')
assert.match(registerSource, /strength < 4/)
assert.match(registerSource, /auth\.resend\(/)
assert.match(registerSource, /RESEND_COOLDOWN_MS/)

const resetSource = fs.readFileSync(path.join(root, 'app/login/reset-password/page.tsx'), 'utf8')
assert.match(resetSource, /strength < 4/)

const headerSource = fs.readFileSync(path.join(root, 'components/layout/PublicHeader.tsx'), 'utf8')
assert.match(headerSource, /Inloggad som/)
assert.match(headerSource, /Logga ut och fortsätt med annan e-post/)

console.log('auth onboarding hardening regression tests passed')
