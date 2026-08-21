import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const card = read('components/PriceResultCard.tsx')
const customerCopy = read('lib/website/customerFacingCopy.ts')
const form = read('components/signup/CustomerApplicationForm.tsx')
const signup = read('app/(public)/teckna-avtal/page.tsx')
const canonical = read('lib/website/canonicalQuoteValidation.ts')
const quoteToken = read('lib/website/pricingQuote.ts')
const areaToken = read('lib/website/energyAreaToken.ts')
const contextRoute = read('app/api/checkout/context/route.ts')
const snapshotStore = read('lib/website/pricingSnapshotStore.ts')

for (const removedCopy of [
  'Marknadskällor:',
  'Ditt pris är hämtat från det publicerade avtalet i OPS och verifieras igen innan avtalet registreras.',
  'bekräftat startdatum',
  'Prisberäkningen behöver hämtas på nytt ovan.',
  'Priset eller avtalet har ändrats. Räkna om priset',
  'Uppgifterna behöver verifieras igen. Hämta priset på nytt.',
  'Bindande pris',
]) {
  assert.equal(
    `${card}\n${form}\n${signup}`.includes(removedCopy),
    false,
    `customer-facing copy must not contain: ${removedCopy}`,
  )
}

assert.ok(card.includes('isInternalSpotPortfolioRule'))
assert.ok(card.includes('isInternalFreshnessRule'))
assert.ok(card.includes('isInternalLockedPortfolioRule'))
assert.ok(card.includes('CUSTOMER_VERIFIED_PRICE_BASIS_LABEL'))
assert.ok(card.includes('CUSTOMER_MARKET_SETTLEMENT_NOTICE'))
assert.ok(card.includes('isMarketSettledContract'))
assert.ok(customerCopy.includes('Verifierat prisunderlag'))
assert.ok(customerCopy.includes('uppmätta förbrukning'))
assert.ok(customerCopy.includes('faktureringsperioden enligt avtalet'))
assert.ok(form.includes("form.includes") === false)
assert.ok(form.includes("'Så snart som möjligt'"))
assert.ok(form.includes('Valt startdatum:'))

assert.ok(canonical.includes('allowExpired: true'))
assert.ok(canonical.includes('refreshCanonicalArea'))
assert.ok(canonical.includes('refreshCanonicalQuote'))
assert.ok(canonical.includes('displayedQuote'))
assert.ok(canonical.includes('const shouldRefresh ='))
assert.ok(canonical.includes('pricingToken: effectivePricingToken'))
assert.ok(canonical.includes('resolutionToken: effectiveResolutionToken'))
assert.ok(canonical.includes('deterministicRenewalAttemptId'))
assert.ok(canonical.includes('displayed_valid_until: input.displayedQuote.valid_until'))
assert.ok(canonical.includes('const deterministicSnapshotReference = `wps_auto_'))
assert.ok(canonical.includes('idempotent: true'))
assert.ok(quoteToken.includes('options: { allowExpired?: boolean }'))
assert.ok(areaToken.includes('allowExpired?: boolean'))
assert.ok(contextRoute.includes('verified.value.pricingToken'))
assert.ok(contextRoute.includes('verified.value.resolutionToken'))
assert.ok(contextRoute.includes('verified.value.displayedQuote.quote_attempt_id !== quoteAttemptId'))
assert.ok(snapshotStore.includes('ignoreDuplicates: true'))

const failedCanonicalStart = signup.indexOf('if (!verifiedQuote.ok)')
const failedCanonicalEnd = signup.indexOf('if (!matchesGridexWebsiteCheckoutPolicy', failedCanonicalStart)
const failedCanonicalBlock = signup.slice(failedCanonicalStart, failedCanonicalEnd)
assert.ok(failedCanonicalBlock.includes('step: 1'))
assert.equal(failedCanonicalBlock.includes('requiresQuoteRefresh'), false)

console.log('Customer pricing copy and automatic renewal checks passed')
