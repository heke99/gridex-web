import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

const previewRoute = read('app/api/v1/website/pricing/preview/route.ts')
assert.ok(previewRoute.includes('loadVerifiedWebsitePricingPreview'), 'pricing preview must use verified OPS pricing')
assert.ok(previewRoute.includes('issueWebsitePricingQuote'), 'pricing preview must issue a signed quote')
assert.ok(previewRoute.includes("Cache-Control': 'private, no-store'"), 'signed price quotes must not be publicly cached')
assert.ok(previewRoute.includes('estimated_monthly_kwh'), 'pricing preview must require an explicit kWh value')
assert.ok(!previewRoute.includes('contractFallbackPreview'), 'pricing preview must not contain a local fallback calculation')
assert.ok(previewRoute.includes("item.offer_reference === offerReference"), 'pricing preview must resolve the selected public offer by offer reference')
assert.ok(!previewRoute.includes('price_plan_id'), 'pricing preview must not accept internal price-plan identifiers from the browser')
assert.ok(previewRoute.includes('offer_reference'), 'pricing preview must use the public offer reference')
assert.ok(previewRoute.includes("quote_source: opsQuote ? 'ops' : 'website'"), 'pricing preview must disclose the quote authority')
assert.ok(previewRoute.includes('GRIDEX_REQUIRE_OPS_PRICING_QUOTE'), 'pricing preview must allow production to require OPS quote tokens')

const quote = read('lib/website/pricingQuote.ts')
assert.ok(quote.includes('createHmac'), 'pricing quote must be HMAC signed')
assert.ok(quote.includes('location_fingerprint'), 'pricing quote must bind the quote to the final address without putting it in the URL')
assert.ok(quote.includes('QUOTE_TTL_MS = 15 * 60 * 1000'), 'compatibility quote must remain short-lived internally')
assert.ok(quote.includes('timingSafeEqual'), 'pricing quote signature validation must use timing-safe comparison')
assert.ok(quote.includes('GRIDEX_WEBSITE_PRICING_QUOTE_SECRET'), 'compatibility quote must use its own secret')
assert.ok(!quote.includes('GRIDEX_WEBSITE_API_KEY'), 'quote signing must not reuse the OPS API key')
assert.ok(!quote.includes('GRIDEX_WEBSITE_HASH_PEPPER'), 'quote signing must not reuse the PII hash pepper')


assert.ok(!read('components/ElectricityCalculator.tsx').includes('En offert gäller i 15 minuter'), 'calculator must not show a misleading 15-minute offer message')
assert.ok(read('components/ElectricityCalculator.tsx').includes('Rörligt pris följer marknaden'), 'calculator must explain market-based variable pricing')
assert.ok(!read('components/signup/CustomerApplicationForm.tsx').includes('prisoffert'), 'signup form must use prisberäkning instead of prisoffert')

const pricingPreview = read('lib/website/pricingPreview.ts')
assert.ok(pricingPreview.includes('assertCompletePreview'), 'OPS pricing must be checked for completeness')
assert.ok(pricingPreview.includes('totalMonthlyCostInclVatSek'), 'OPS pricing must include a total including VAT')
assert.ok(pricingPreview.includes('fallback_preview === true'), 'fallback pricing responses must be rejected')
assert.ok(pricingPreview.includes('Fakturaavgiftens inkluderingsflagga är kundinformation'), 'missing invoice-fee inclusion flag must not block a complete price preview')
assert.ok(pricingPreview.includes('PREVIEW_CACHE_TTL_MS = 60_000'), 'identical preview reads must be short-lived cached')

const signup = read('app/(public)/teckna-avtal/page.tsx')
assert.ok(signup.includes('validatePricingPreviewSnapshot'), 'signup must validate the displayed price snapshot')
assert.ok(signup.includes('validateOpsWebsitePricingQuote'), 'signup must validate an OPS-issued quote against final details')
assert.ok(signup.includes('validateWebsitePricingQuote'), 'signup must validate a compatibility quote against final details')
assert.ok(signup.includes('loadVerifiedWebsitePricingPreview'), 'signup must obtain a fresh verified OPS calculation before submit')
assert.ok(signup.includes('fetchOpsPublicContractsFresh'), 'signup must verify the offer against fresh OPS contract data')
assert.ok(signup.includes('contractSupportsCustomerType'), 'signup must enforce customer type on the server')
assert.ok(signup.includes('useActionState') === false, 'server page must not depend on client action state')
assert.ok(signup.includes('pricing_preview_snapshot: canonicalPricingPreviewSnapshot'), 'OPS must receive the canonical verified price snapshot')
assert.ok(signup.includes('return fail('), 'server action errors must return to the form without discarding entered fields')

const form = read('components/signup/CustomerApplicationForm.tsx')
assert.ok(form.includes('useActionState'), 'client form must preserve values after a server validation error')
assert.ok(form.includes('pricing_quote_token'), 'form must post the signed pricing quote token')
assert.ok(form.includes('Räkna priset ovan innan du går vidare'), 'customer must calculate a price before progressing')
assert.ok(form.includes('customer_type'), 'form must let customer type control offer eligibility')
assert.ok(form.includes('quoteContext'), 'form must prefill final address from the client-side quote context')

const cards = read('app/(public)/elavtal/page.tsx')
assert.ok(cards.includes('Räkna pris och teckna'), 'contract card CTA must lead to price calculation before signing')
assert.ok(cards.includes('Din uppskattade månadskostnad beräknas först'), 'contract cards must not imply a complete price before kWh and area are provided')
assert.ok(cards.includes('Mixavtal'), 'contract list must explain mix products')
assert.ok(!cards.includes('Allmänna villkor: version'), 'contract cards must not expose legal version identifiers to customers')

const display = read('lib/website/publicContractDisplay.ts')
assert.ok(!display.includes("'prisplan saknas'"), 'public contract cards must not require internal price plans')
assert.ok(!display.includes("contract.is_public !== true"), 'public contract cards must trust OPS publication filtering')
assert.ok(display.includes('never OPS-internal IDs'), 'public contract display must document the public API boundary')

const ops = read('lib/ops/client.ts')
assert.ok(ops.includes('unstable_cache'), 'public contract catalogue must be cached')
assert.ok(ops.includes("tags: [\"ops-public-contracts\"]"), 'public contract cache must support explicit invalidation')
assert.ok(ops.includes('"mix"'), 'OPS contract mapping must preserve mix products')

assert.ok(ops.includes('total_monthly_cost_incl_vat_sek'), 'OPS pricing mapper must accept incl_vat snake_case total aliases')
assert.ok(ops.includes('estimatedMonthlyKwh'), 'OPS pricing mapper must accept camelCase monthly kWh aliases')
assert.ok(ops.includes('pricingQuoteToken'), 'OPS pricing mapper must accept quote token aliases')
assert.ok(read('lib/website/snapshotValidation.ts').includes('total_monthly_cost_incl_vat_sek'), 'snapshot validation must accept incl_vat aliases')

const webhook = read('app/api/ops/webhooks/route.ts')
assert.ok(webhook.includes("revalidateTag('ops-public-contracts', 'max')"), 'relevant OPS changes must invalidate public contract cache')

console.log('Signup pricing regression checks passed')

const portalRoute = read('app/api/v1/customer/portal-bundle/route.ts')
assert.ok(portalRoute.includes('CustomerPortalAccessError'), 'portal route must return a typed authentication error')
assert.ok(portalRoute.includes('status: error.status'), 'portal route must return 401 for a missing customer session')
assert.ok(portalRoute.includes('status: 503'), 'portal route must return 503 when the portal is unavailable')

const docs = read('docs/external-website-api-integration-guide.md')
assert.ok(docs.includes('only contract reference that the website may use'), 'API guide must define the public offer reference boundary')
assert.ok(docs.includes('price_plan_id'), 'API guide must prohibit browser-supplied internal price-plan identifiers')
