import assert from 'node:assert/strict'
import { canUsePublishedPricingFallback } from '../lib/website/pricingFallbackPolicy.ts'

const generic = 'Tjänsten kunde inte slutföra åtgärden just nu.'

assert.equal(
  canUsePublishedPricingFallback({ status: 409, message: generic }),
  true,
  'generic OPS 409 must activate the strict published-pricing fallback',
)
assert.equal(
  canUsePublishedPricingFallback({ status: 400, message: generic }),
  true,
  'generic OPS 400 must activate the strict published-pricing fallback',
)
assert.equal(
  canUsePublishedPricingFallback({ status: 422, message: generic }),
  true,
  'generic OPS 422 must activate the strict published-pricing fallback',
)
assert.equal(
  canUsePublishedPricingFallback({ status: 409, message: 'Avtalet är inte publicerat.' }),
  false,
  'a specific business validation must not be bypassed',
)
assert.equal(
  canUsePublishedPricingFallback({ status: 401, message: generic }),
  false,
  'authentication failures must never be bypassed',
)
assert.equal(
  canUsePublishedPricingFallback({ status: 403, message: generic }),
  false,
  'permission failures must never be bypassed',
)
assert.equal(
  canUsePublishedPricingFallback({ status: 500, message: 'Internal server error' }),
  true,
  'server failures must activate the strict published-pricing fallback',
)
assert.equal(
  canUsePublishedPricingFallback({
    status: 409,
    message: 'Conflict',
    details: { content_type: 'text/html; charset=utf-8' },
  }),
  true,
  'HTML returned with a validation-like status is a broken quote response',
)

console.log('pricing fallback policy tests passed')
