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


const TEST_PRICE_OPTION = {
  price_option_reference: 'price_option_runtime', option_code: 'standard', customer_name: 'Standard',
  contract_type: 'variable_monthly', customer_type: 'both', binding_months: 0, notice_months: 1,
  auto_renew_enabled: false, renewal_term_months: null, default: true, selection_required: false,
  valid_from: null, valid_to: null, earliest_start_date: null, latest_start_date: null,
  area_prices: [{ area_price_reference: 'area_price_test_se3', price_area: 'SE3', energy_price_ore_per_kwh: 100, unit: 'ore_per_kwh', valid_from: null, valid_to: null }],
}
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const modern = normalizePublicContractApiPayload({
  offer_reference: 'offer-modern',
  code: 'MODERN',
  name: 'Modern mix',
  contract_type: 'mixed', energy_direction: 'consumption',
    price_options: [TEST_PRICE_OPTION],
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
  offer_reference: 'offer-both', name: 'Båda', contract_type: 'variable_monthly', energy_direction: 'consumption', customer_type: 'both', channel: 'website', price_options: [TEST_PRICE_OPTION], pricing: {}, legal: {},
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
assert.ok(form.includes('name="metering_point_id"'))
assert.ok(!form.includes('?? "/allmanna-villkor"'))

const signup = read('app/(public)/teckna-avtal/page.tsx')
assert.ok(signup.includes('signerIdentityNumber: personalNumber'))
assert.ok(signup.includes('type OpsWebsitePowerOfAttorneyInput'))
assert.ok(signup.includes('let powerOfAttorney: OpsWebsitePowerOfAttorneyInput | null = null'))
assert.ok(signup.includes('const signerName = signerNameForApplication({ firstName, lastName })'))
assert.ok(signup.includes('if (!signerName)'))
assert.ok(signup.includes('if (!powerOfAttorneyTextVersionId)'))
assert.ok(signup.includes('signerName,'))
assert.ok(signup.includes('isPublicContractReady'))
assert.ok(signup.includes('checkoutContextUsable'))
assert.ok(signup.includes('requestedOfferExists'))
assert.ok(!signup.includes('fetchOpsPublicContractsFresh().catch(() => [])'))
assert.ok(signup.includes('idempotency_key_payload_mismatch'))
assert.ok(signup.includes('application_business_in_progress'))
assert.ok(signup.includes('duplicate_application'))
assert.ok(signup.includes('fetchOpsWebsiteLegalBundle'))

const publicDto = read('lib/website/publicDtos.ts')
assert.ok(publicDto.includes('Never spread an OPS object'))
assert.ok(!publicDto.includes('contract.raw'))
assert.ok(!publicDto.includes('price_plan_id'))
assert.ok(!publicDto.includes('contract_id'))
assert.ok(read('app/api/checkout/legal-bundle/route.ts').includes('toBrowserLegalBundle'))
assert.ok(!publicDto.includes('company_id'))

const checkoutStore = read('lib/website/checkoutContextStore.ts')
assert.ok(checkoutStore.includes('tokenHash(token)'))
assert.ok(checkoutStore.includes('pricing_expires_at'))
assert.ok(checkoutStore.includes(".lt('expires_at'"))

const calculator = read('components/ElectricityCalculator.tsx')
assert.ok(!calculator.includes('manualArea'))
assert.ok(calculator.includes('/api/checkout/context'))
assert.ok(calculator.includes('sessionStorage'))
assert.ok(!calculator.includes('personal_number'))

const quoteValidation = read('app/api/checkout/quote/validate/route.ts')
assert.ok(quoteValidation.includes('validateCanonicalWebsiteQuote'))
assert.ok(read('lib/website/canonicalQuoteValidation.ts').includes('validateOpsWebsiteQuote'))
assert.ok(!quoteValidation.includes('resolveWebsitePriceAreaForPricing'))
const pricingPreviewRoute = read('app/api/checkout/quote/route.ts')
assert.ok(pricingPreviewRoute.includes('quoteToWebsitePricingPreview'))
assert.ok(!pricingPreviewRoute.includes('const safe = { ...preview }'))
assert.ok(read('app/api/checkout/energy-area/resolve/route.ts').includes('fetchOpsWebsiteEnergyArea'))

const readiness = read('lib/ops/readiness.ts')
assert.ok(readiness.includes("'integration_context.read'"))
assert.ok(readiness.includes("'website_quotes.validate'"))
assert.ok(readiness.includes("'website_energy_area.resolve'"))

const faq = read('lib/content/faq.ts')
assert.ok(faq.includes('foretag-undertecknare'))
assert.ok(read('app/(public)/vanliga-fragor/page.tsx').includes('FaqExplorer'))
assert.ok(read('lib/seo/content.ts').includes("'/vanliga-fragor'"))


const opsClient = read('lib/ops/client.ts')
assert.ok(opsClient.includes('toOpsCustomerType(input.customer.customer_type)'))
assert.ok(opsClient.includes('org_number: normalizeText(input.customer.organization_number)!'))
assert.ok(opsClient.includes('assertTenantReference'))
assert.ok(opsClient.includes('ops_tenant_binding_unverified'))
assert.ok(!opsClient.includes('GRIDEX_EXPECTED_TENANT_REFERENCE'))
assert.ok(opsClient.includes('"/api/v1/website/public-contracts/diagnostics"'))
assert.ok(opsClient.includes('If-None-Match'))
assert.ok(opsClient.includes('response.status === 304'))
assert.ok(opsClient.includes('stale_reason'))
assert.ok(opsClient.includes('revalidateSeconds'))
assert.ok(opsClient.includes('cache: options.forceFresh ? "no-store" : "force-cache"'))
assert.ok(opsClient.includes('isTransientOpsError(error)'))

const publicContractFeed = read('lib/website/publicContractFeed.ts')
assert.ok(publicContractFeed.includes('fetchOpsPublicContractDiagnostics'))
assert.ok(publicContractFeed.includes('serving cached public contracts'))
assert.ok(read('app/(public)/page.tsx').includes('loadWebsitePublicContractFeed'))
assert.ok(read('app/(public)/elavtal/page.tsx').includes('loadWebsitePublicContractFeed'))
assert.ok(read('lib/website/publicContractsEndpoint.ts').includes('stale-if-error=86400'))

const contractDisplay = read('lib/website/publicContractDisplay.ts')
assert.ok(contractDisplay.includes("case 'variable_monthly':"))
assert.ok(contractDisplay.includes("case 'variable_hourly':"))
assert.ok(contractDisplay.includes("'notice_period_months'"))
assert.ok(contractDisplay.includes("'automatic_renewal'"))

assert.ok(!signup.includes('source: "gridex_web"'))
assert.ok(signup.includes('quote_reference: verifiedQuote.value.quote.ops_quote_reference'))

console.log('Website signup hardening checks passed')
