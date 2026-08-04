import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const calculator = read('components/ElectricityCalculator.tsx')
const route = read('app/api/checkout/quote/route.ts')
const policy = read('lib/website/checkoutPolicy.ts')
const contract = read('lib/website/publicContractContract.ts')
const contextRoute = read('app/api/checkout/context/route.ts')
const signup = read('app/(public)/teckna-avtal/page.tsx')

for (const forbiddenLabel of [
  'Offertval',
  'Prisalternativ',
  'Fakturasätt',
  'Antal anläggningar',
  'Valbara pristillägg',
]) {
  assert.equal(calculator.includes(forbiddenLabel), false, `checkout must not render ${forbiddenLabel}`)
}

assert.ok(calculator.includes('Önskad avtalsstart'))
assert.ok(calculator.includes('Så snart som möjligt'))
assert.ok(calculator.includes('Välj ett specifikt datum'))
assert.equal(calculator.includes('calculator-price-option'), false)
assert.equal(calculator.includes('calculator-invoice-method'), false)
assert.equal(calculator.includes('calculator-site-count'), false)

assert.ok(policy.includes("GRIDEX_PRIMARY_INVOICE_CHANNEL = 'kivra'"))
assert.ok(policy.includes("GRIDEX_FALLBACK_INVOICE_DELIVERY_METHOD = 'e_invoice'"))
assert.ok(policy.includes('GRIDEX_WEBSITE_SITE_COUNT = 1'))
assert.ok(route.includes('selectAutomaticPublicContractPriceOption'))
assert.ok(route.includes('GRIDEX_FALLBACK_INVOICE_DELIVERY_METHOD'))
assert.ok(route.includes('gridexWebsiteSelectedComponentReferences()'))
assert.ok(route.includes('GRIDEX_WEBSITE_SITE_COUNT'))
assert.ok(route.includes('Values supplied by the browser are'))
assert.ok(contract.includes('selectAutomaticPublicContractPriceOption'))
assert.ok(contract.includes('Ambiguous OPS configuration fails closed'))
assert.ok(policy.includes('matchesGridexWebsiteCheckoutPolicy'))
assert.ok(contextRoute.includes('matchesGridexWebsiteCheckoutPolicy(verified.value.quote)'))
assert.ok(signup.includes('matchesGridexWebsiteCheckoutPolicy(verifiedQuote.value.quote)'))

console.log('Automatic checkout policy checks passed')
