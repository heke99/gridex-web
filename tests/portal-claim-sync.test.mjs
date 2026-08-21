import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const claimService = await readFile(new URL('../lib/customerPortal/portalClaim.ts', import.meta.url), 'utf8')
const claimRoute = await readFile(new URL('../app/auth/portal-claim/route.ts', import.meta.url), 'utf8')
const thanksPage = await readFile(new URL('../app/(public)/teckna-avtal/tack/SignupThanksPage.tsx', import.meta.url), 'utf8')
const checkoutPage = await readFile(new URL('../app/(public)/teckna-avtal/page.tsx', import.meta.url), 'utf8')
const headerAuth = await readFile(new URL('../components/layout/PublicHeaderAuth.tsx', import.meta.url), 'utf8')
const header = await readFile(new URL('../components/layout/PublicHeader.tsx', import.meta.url), 'utf8')
const passwordPolicy = await readFile(new URL('../lib/auth/passwordPolicy.ts', import.meta.url), 'utf8')
const registerPage = await readFile(new URL('../app/register/page.tsx', import.meta.url), 'utf8')
const resetPage = await readFile(new URL('../app/login/reset-password/page.tsx', import.meta.url), 'utf8')

test('portal claim requires signed checkout, exact submission, email and stable OPS identities', () => {
  assert.match(claimService, /readWebsiteApplicationResultState\(input\.resultToken\)/)
  assert.match(claimService, /resultState\.userId && resultState\.userId !== input\.userId/)
  assert.match(claimService, /submission\.user_id && submission\.user_id !== input\.userId/)
  assert.match(claimService, /submission\.ops_customer_number !== resultState\.result\.customerNumber/)
  assert.match(claimService, /normalizeEmail\(job\.email\) !== email \|\| payloadEmail !== email/)
  assert.match(claimService, /job\.external_customer_id !== submission\.external_customer_id/)
  assert.match(claimService, /payloadExternal !== submission\.external_customer_id/)
  assert.match(claimService, /job\.customer_number !== submission\.ops_customer_number/)
  assert.match(claimService, /payloadCustomerNumber !== submission\.ops_customer_number/)
})

test('portal claim targets one onboarding job and preserves OPS owner invariant', () => {
  assert.match(claimService, /\.eq\('submission_attempt_id', submissionAttemptId\)/)
  assert.doesNotMatch(claimService, /\.ilike\('email'/)
  assert.match(claimService, /sync\.status !== 'linked' \|\| !accessGranted \|\| portalRole !== 'owner'/)
  assert.match(claimService, /status: 'completed'/)
})

test('repeat customer signings keep one customer identity but create distinct contract and facility projections', () => {
  assert.match(checkoutPage, /currentAuth\?\.externalCustomerId \?\?\s*createExternalCustomerId/)
  assert.match(checkoutPage, /"gridex_website_customer_v2"/)
  assert.match(checkoutPage, /customerType === "business" \? organizationNumber : personalNumber/)
  assert.match(claimService, /onConflict: 'user_id,contract_provider_key,contract_external_ref'/)
  assert.match(claimService, /onConflict: 'user_id,facility_id'/)
  assert.match(thanksPage, /Tack! Din teckning är skickad\./)
  assert.match(thanksPage, /Ett nytt avtal eller en ny anläggning läggs till separat och tidigare avtal och anläggningar ligger kvar\./)
})

test('claim route authenticates before linking and thank-you CTA carries verified result', () => {
  assert.match(claimRoute, /supabase\.auth\.getUser\(\)/)
  assert.match(claimRoute, /status', 'portal-link-required'/)
  assert.match(claimRoute, /resumePortalOnboardingFromResultProof/)
  assert.match(thanksPage, /\/auth\/portal-claim\?result=/)
  assert.match(thanksPage, /Logga in och koppla den här teckningen/)
  assert.match(thanksPage, /Gå till Mina sidor/)
})

test('public header degrades safely and checkout ownership copy is explicit', () => {
  assert.match(headerAuth, /try \{/)
  assert.match(headerAuth, /auth state unavailable/)
  assert.match(header, /kopplas teckningen till detta Mina sidor-konto även om du anger en annan kontaktadress/)
})

test('one shared password policy encodes and powers all four customer password requirements', () => {
  assert.match(passwordPolicy, /password\.length >= 8/)
  assert.match(passwordPolicy, /uppercase:/)
  assert.match(passwordPolicy, /number:/)
  assert.match(passwordPolicy, /special:/)
  assert.match(passwordPolicy, /valid: score === 4/)
  assert.match(registerPage, /passwordMeetsPolicy\(password\)/)
  assert.match(resetPage, /passwordMeetsPolicy\(password\)/)
})
