import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

function includes(path, needle, message) {
  assert.ok(read(path).includes(needle), `${path}: ${message}`)
}

function excludes(path, needle, message) {
  assert.ok(!read(path).includes(needle), `${path}: ${message}`)
}

const previewRoute = read('app/api/v1/website/pricing/preview/route.ts')
assert.ok(previewRoute.includes('loadVerifiedWebsitePricingPreview'), 'pricing preview must use verified OPS pricing')
assert.ok(previewRoute.includes('issueWebsitePricingQuote'), 'pricing preview must issue a signed quote')
assert.ok(previewRoute.includes("Cache-Control': 'private, no-store'"), 'signed price quotes must not be publicly cached')
assert.ok(previewRoute.includes('estimated_monthly_kwh'), 'pricing preview must require an explicit kWh value')
assert.ok(!previewRoute.includes('contractFallbackPreview'), 'pricing preview must not contain a local fallback calculation')
assert.ok(previewRoute.includes("item.offer_reference === offerReference"), 'pricing preview must resolve the selected public offer by offer reference')
assert.ok(previewRoute.includes('suppliedIdentifiers'), 'pricing preview must reject mismatched client identifiers')

const quote = read('lib/website/pricingQuote.ts')
assert.ok(quote.includes('createHmac'), 'pricing quote must be HMAC signed')
assert.ok(quote.includes('location_fingerprint'), 'pricing quote must bind the quote to the final address without putting it in the URL')
assert.ok(quote.includes('QUOTE_TTL_MS = 15 * 60 * 1000'), 'pricing quote must have a short validity period')
assert.ok(quote.includes('timingSafeEqual'), 'pricing quote signature validation must use timing-safe comparison')

const pricingPreview = read('lib/website/pricingPreview.ts')
assert.ok(pricingPreview.includes('assertCompletePreview'), 'OPS pricing must be checked for completeness')
assert.ok(pricingPreview.includes('totalMonthlyCostInclVatSek'), 'OPS pricing must include a total including VAT')
assert.ok(pricingPreview.includes('fallback_preview === true'), 'fallback pricing responses must be rejected')
assert.ok(pricingPreview.includes('fakturaavgiften ingår i prisberäkningen'), 'invoice fee treatment must be explicit when it affects the offer')
assert.ok(pricingPreview.includes('PREVIEW_CACHE_TTL_MS = 60_000'), 'identical preview reads must be short-lived cached')

const signup = read('app/(public)/teckna-avtal/page.tsx')
assert.ok(signup.includes('validatePricingPreviewSnapshot'), 'signup must validate the displayed price snapshot')
assert.ok(signup.includes('validateWebsitePricingQuote'), 'signup must validate the signed quote against final details')
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
assert.ok(cards.includes('Räkna pris och ansök'), 'contract card CTA must lead to price calculation before signup')
assert.ok(cards.includes('Din uppskattade månadskostnad beräknas först'), 'contract cards must not imply a complete price before kWh and area are provided')
assert.ok(cards.includes('Mixavtal'), 'contract list must explain mix products')
assert.ok(!cards.includes('Allmänna villkor: version'), 'contract cards must not expose legal version identifiers to customers')

const display = read('lib/website/publicContractDisplay.ts')
assert.ok(display.includes("'prisplan saknas'"), 'public contract cards must block missing price plans')
assert.ok(display.includes("'prisplansversion saknas'"), 'public contract cards must block missing price plan versions')
assert.ok(display.includes("contract.is_public !== true"), 'public contract cards must require explicit publication')
assert.ok(display.includes("contract.is_active !== true"), 'public contract cards must require explicit activation')
assert.ok(display.includes("'mixfördelning måste vara 100 %'"), 'mix contracts must validate a complete split')

const ops = read('lib/ops/client.ts')
assert.ok(ops.includes('unstable_cache'), 'public contract catalogue must be cached')
assert.ok(ops.includes("tags: [\"ops-public-contracts\"]"), 'public contract cache must support explicit invalidation')
assert.ok(ops.includes('"mix"'), 'OPS contract mapping must preserve mix products')

const webhook = read('app/api/ops/webhooks/route.ts')
assert.ok(webhook.includes("revalidateTag('ops-public-contracts', 'max')"), 'relevant OPS changes must invalidate public contract cache')

console.log('Signup pricing regression checks passed')
