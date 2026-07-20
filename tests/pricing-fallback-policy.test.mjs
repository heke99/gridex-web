import assert from 'node:assert/strict'
import {
  canUsePublishedPricingFallback,
  isUnavailableQuoteResponse,
} from '../lib/website/pricingFallbackPolicy.ts'

const generic = (status, details = undefined) => ({
  status,
  message: 'Tjänsten kunde inte slutföra åtgärden just nu.',
  details,
})

assert.equal(canUsePublishedPricingFallback(generic(401)), false)
assert.equal(canUsePublishedPricingFallback(generic(403)), false)
assert.equal(canUsePublishedPricingFallback(generic(400)), true)
assert.equal(canUsePublishedPricingFallback(generic(409)), true)
assert.equal(canUsePublishedPricingFallback(generic(422)), true)
assert.equal(canUsePublishedPricingFallback({ status: 409, message: 'Avtalet saknar publicerat pris.' }), false)
assert.equal(canUsePublishedPricingFallback({ status: 404, message: 'Not found' }), true)
assert.equal(canUsePublishedPricingFallback({ status: 405, message: 'Method not allowed' }), true)
assert.equal(canUsePublishedPricingFallback({ status: 500, message: 'Server error' }), true)
assert.equal(isUnavailableQuoteResponse({ status: 302, message: 'Redirect', details: { redirected: true } }), true)
assert.equal(isUnavailableQuoteResponse({ status: 200, message: 'HTML', details: { content_type: 'text/html' } }), true)

console.log('pricing fallback policy tests passed')
