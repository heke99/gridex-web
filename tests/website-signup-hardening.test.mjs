import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { normalizePublicContractApiPayload } from '../lib/website/publicContractContract.ts'
import {
  isValidRequestedStartDate,
  isValidSwedishOrganizationNumber,
  isValidSwedishPersonalNumber,
  normalizePhoneToE164,
  stockholmToday,
} from '../lib/website/signupValidation.ts'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const modern = normalizePublicContractApiPayload({
  offer_reference: 'offer-modern',
  code: 'MODERN',
  name: 'Modern mix',
  type: 'mix',
  customer_type: 'both',
  customer_types: ['private', 'business'],
  pricing: {
    visibility: { monthly_fee: false, markup: true },
    spot_share: 50,
    portfolio_share: 0.5,
    components: [
      { component_code: 'management', name: 'Förvaltning', amount: 1.25, unit: 'percent', website_card_visible: true, calculation_base: 'energy_cost' },
      { component_code: 'hidden', name: 'Dold', amount: 9, unit: 'sek_per_month', website_card_visible: false },
    ],
    portfolio_monthly_prices: [
      { year: 2026, month: 6, price_area_code: 'se3', amount: 88.4, unit: 'ore_per_kwh' },
    ],
  },
  legal: {},
})

assert.ok(modern)
assert.deepEqual(modern.customer_types, ['private', 'business'])
assert.equal(modern.spot_share, 0.5)
assert.equal(modern.portfolio_share, 0.5)
assert.equal(modern.pricing_visibility.monthly_fee, false)
assert.equal(modern.pricing_components[0].calculation_base, 'energy_cost')
assert.equal(modern.pricing_components[1].website_card_visible, false)
assert.deepEqual(modern.portfolio_monthly_prices[0], {
  year: 2026,
  month: 6,
  price_area_code: 'SE3',
  amount: 88.4,
  unit: 'ore_per_kwh',
})

const singularBoth = normalizePublicContractApiPayload({
  offer_reference: 'offer-both', name: 'Båda', type: 'variable_spot', customer_type: 'both', pricing: {}, legal: {},
})
assert.deepEqual(singularBoth?.customer_types, ['private', 'business'])

assert.equal(isValidSwedishPersonalNumber('19900101-0017'), true)
assert.equal(isValidSwedishPersonalNumber('19900101-0018'), false)
assert.equal(isValidSwedishOrganizationNumber('556016-0680'), true)
assert.equal(isValidSwedishOrganizationNumber('556016-0681'), false)
assert.equal(normalizePhoneToE164('070-123 45 67'), '+46701234567')
assert.equal(isValidRequestedStartDate('specific_date', stockholmToday()), true)
assert.equal(isValidRequestedStartDate('specific_date', '2020-01-01'), false)

const form = read('components/signup/CustomerApplicationForm.tsx')
assert.ok(form.includes('company_signer_role'))
assert.ok(form.includes('company_signer_authorized'))
assert.ok(!form.includes('name="apartment"'))
assert.ok(!form.includes('name="metering_point_id"'))
assert.ok(!form.includes('?? "/allmanna-villkor"'))

const signup = read('app/(public)/teckna-avtal/page.tsx')
assert.ok(signup.includes('signerIdentityNumber: personalNumber'))
assert.ok(signup.includes('isSignupReadyContract'))
assert.ok(signup.includes('idempotency_key_payload_mismatch'))
assert.ok(signup.includes('application_business_in_progress'))
assert.ok(signup.includes('duplicate_application'))
assert.ok(!signup.includes('fetchOpsWebsiteLegalBundle'))

const publicDto = read('lib/website/publicDtos.ts')
assert.ok(publicDto.includes('Never spread an OPS object'))
assert.ok(!publicDto.includes('contract.raw'))
assert.ok(!publicDto.includes('price_plan_id'))
assert.ok(!publicDto.includes('contract_id'))
assert.ok(read('app/api/v1/website/legal-texts/current/route.ts').includes('map(toBrowserLegalText)'))
assert.ok(!publicDto.includes('company_id'))

const checkoutStore = read('lib/website/checkoutContextStore.ts')
assert.ok(checkoutStore.includes('tokenHash(token)'))
assert.ok(checkoutStore.includes('pricing_expires_at'))
assert.ok(checkoutStore.includes(".lt('expires_at'"))

const calculator = read('components/ElectricityCalculator.tsx')
assert.ok(!calculator.includes('manualArea'))
assert.ok(calculator.includes('/api/v1/website/checkout-context'))
assert.ok(calculator.includes('sessionStorage'))
assert.ok(!calculator.includes('personal_number'))

const quoteValidation = read('app/api/v1/website/pricing/quote/validate/route.ts')
assert.ok(quoteValidation.includes('validateCanonicalWebsiteQuote'))
assert.ok(read('lib/website/canonicalQuoteValidation.ts').includes('validateOpsWebsiteQuote'))
assert.ok(!quoteValidation.includes('resolveWebsitePriceAreaForPricing'))
const pricingPreviewRoute = read('app/api/v1/website/pricing/preview/route.ts')
assert.ok(pricingPreviewRoute.includes('quoteToWebsitePricingPreview'))
assert.ok(!pricingPreviewRoute.includes('const safe = { ...preview }'))
assert.ok(read('app/api/v1/website/energy/resolve/route.ts').includes('fetchOpsWebsiteEnergyArea'))

const readiness = read('lib/ops/readiness.ts')
assert.ok(readiness.includes("'integration_context.read'"))
assert.ok(readiness.includes("'website_quotes.validate'"))
assert.ok(readiness.includes("'website_energy_area.resolve'"))

const faq = read('lib/content/faq.ts')
assert.ok(faq.includes('foretag-undertecknare'))
assert.ok(read('app/(public)/vanliga-fragor/page.tsx').includes('FaqExplorer'))
assert.ok(read('lib/seo/content.ts').includes("'/vanliga-fragor'"))


const opsClient = read('lib/ops/client.ts')
assert.ok(opsClient.includes('toOpsCustomerType(input.customer_type)'))
assert.ok(opsClient.includes('{ org_number: input.organization_number }'))
assert.ok(opsClient.includes('assertExpectedTenantReference'))
assert.ok(opsClient.includes('"ops_tenant_mismatch"'))
assert.ok(opsClient.includes('GRIDEX_EXPECTED_TENANT_REFERENCE'))
assert.ok(opsClient.includes('"/api/v1/website/public-contracts/diagnostics"'))
assert.ok(opsClient.includes('If-None-Match'))
assert.ok(opsClient.includes('response.status === 304'))

const contractDisplay = read('lib/website/publicContractDisplay.ts')
assert.ok(contractDisplay.includes("case 'variable_monthly':"))
assert.ok(contractDisplay.includes("case 'variable_hourly':"))
assert.ok(contractDisplay.includes("'notice_period_months'"))
assert.ok(contractDisplay.includes("'automatic_renewal'"))

assert.ok(signup.includes('GRIDEX_WEBSITE_SOURCE'))

console.log('Website signup hardening checks passed')
