import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

function assertIncludes(path, needle, message) {
  assert.ok(read(path).includes(needle), `${path}: ${message}`)
}

function assertNotIncludes(path, needle, message) {
  assert.ok(!read(path).includes(needle), `${path}: ${message}`)
}

const display = read('lib/website/publicContractDisplay.ts')
assert.ok(display.includes('hasNumberValue(value)'), 'publicContractDisplay must use explicit number presence checks')
assert.ok(display.includes('value === \'number\' && Number.isFinite(value)'), 'publicContractDisplay must preserve real 0 values')
assert.ok(!/\|\|\s*0/.test(display), 'publicContractDisplay must not coerce missing values to 0 with || 0')

assertIncludes(
  'app/api/admin/agreements/export/route.ts',
  'requireAdminActionAccess',
  'admin agreement export must require admin permissions',
)
assertNotIncludes(
  'app/api/admin/agreements/export/route.ts',
  "from '@/lib/supabase/service'",
  'admin agreement export must not query with unguarded service role',
)
assertIncludes(
  'app/api/admin/agreements/export/route.ts',
  'logPermissionAudit',
  'admin agreement export must write audit',
)

assertIncludes('app/api/legal/accept/route.ts', 'checkRateLimit', 'legal accept route must rate limit')
assertIncludes('app/api/legal/accept/route.ts', 'email_sign_token', 'legal accept route must verify agreement token')
assertIncludes('app/api/legal/accept/route.ts', 'document_hash', 'legal accept route must hash accepted document')
assertIncludes('app/api/legal/accept/route.ts', 'idempotent', 'legal accept route must be idempotent')

for (const path of ['app/api/price/route.ts', 'app/api/offers/calculate/route.ts']) {
  assertIncludes(path, 'status: 410', 'legacy public price route must be closed')
  assertIncludes(path, '/api/v1/website/pricing/preview', 'legacy public price route must point to OPS preview')
}

const signup = read('app/(public)/teckna-avtal/page.tsx')
assert.ok(signup.includes('validateContractDisplaySnapshot'), 'submit must validate contract display snapshot')
assert.ok(signup.includes('offer_reference'), 'submit must use OPS offer_reference as the binding contract reference')
assert.ok(signup.includes('Idempotency-Key') || read('lib/ops/client.ts').includes('Idempotency-Key'), 'customer application writes must use Idempotency-Key header')
assert.ok(!signup.includes('validatePricingPreviewSnapshot'), 'submit must not require pricing preview snapshot')
assert.ok(!signup.includes('fetchOpsWebsitePricingPreview'), 'submit must not block on live pricing preview')

const form = read('components/signup/CustomerApplicationForm.tsx')
assert.ok(form.includes('pricing_preview_snapshot'), 'form may post optional pricing preview snapshot as metadata')
assert.ok(form.includes('contract_display_snapshot'), 'form must post contract display snapshot')
assert.ok(!form.includes('Räkna priset innan du skickar ansökan'), 'form must not require a price preview before submit')
assert.ok(form.includes('accept_price_terms'), 'form must require separate price terms consent')
assert.ok(form.includes('/fullmakt'), 'form must link to the public power of attorney page')
assert.ok(!form.includes('Allmänna villkor: version'), 'form must not show technical legal version labels to customers')
assertIncludes('app/(public)/fullmakt/page.tsx', 'Fullmakt för anläggningsuppgifter', 'public power of attorney page must exist')

const envExample = read('env.example')
for (const variable of [
  'GRIDEX_ENABLE_LOCAL_PRICE_FALLBACK',
  'GRIDEX_ALLOW_UNSAFE_OPS_URL',
  'GRIDEX_ENABLE_OPS_WEBHOOKS',
  'GRIDEX_OPS_WEBHOOK_SECRET',
  'GRIDEX_OPS_WEBHOOK_TOLERANCE_SECONDS',
  'NEXT_PUBLIC_SITE_URL',
  'CONTRACTS_BUCKET',
  'PAPILITE_API_KEY',
  'PAPILITE_BASE_URL',
  'WEBSITE_ARCGIS_GRID_AREAS_QUERY_URL',
]) {
  assert.ok(envExample.includes(variable), `env.example must document ${variable}`)
}

console.log('Launch-readiness checks passed')
