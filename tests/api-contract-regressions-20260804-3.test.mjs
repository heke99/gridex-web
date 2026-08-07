import { readOpsClientImplementation } from './ops-client-source.mjs'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const sha256 = (value) => createHash('sha256').update(value).digest('hex')

const websiteRaw = read('docs/openapi/website-integration-v1.json')
const portalRaw = read('docs/openapi/customer-portal-v1.json')
const website = JSON.parse(websiteRaw)
const portal = JSON.parse(portalRaw)
const release = JSON.parse(read('docs/openapi/release-manifest.json'))
const contract = read('lib/ops/contract.ts')
const client = readOpsClientImplementation()
const tokenSource = read('lib/website/energyAreaToken.ts')
const resolverRoute = read('app/api/checkout/energy-area/resolve/route.ts')
const signup = read('app/(public)/teckna-avtal/page.tsx')
const portalService = read('lib/customerPortal/service.ts')
const auditStore = read('lib/website/energyAreaStore.ts')
const publicApi = read('lib/website/publicApi.ts')
const migration = read('supabase/migrations/20260804190000_price_area_assurance_20260804_2.sql')

assert.equal(website.info.version, release.release_version)
assert.equal(portal.info.version, release.release_version)
assert.equal(release.minimum_tenant_integration_version, release.release_version)
assert.equal(sha256(websiteRaw), release.specifications.website.sha256)
assert.equal(sha256(portalRaw), release.specifications.customer_portal.sha256)
assert.ok(contract.includes(`GRIDEX_API_CONTRACT_VERSION = '${release.release_version}'`))
assert.ok(contract.includes(`GRIDEX_MINIMUM_TENANT_INTEGRATION_VERSION = '${release.minimum_tenant_integration_version}'`))
assert.ok(contract.includes(`GRIDEX_WEBSITE_OPENAPI_SHA256 = '${release.specifications.website.sha256}'`))
assert.ok(contract.includes(`GRIDEX_CUSTOMER_PORTAL_OPENAPI_SHA256 = '${release.specifications.customer_portal.sha256}'`))

const quoteOperation = website.paths['/api/v1/website/quote'].post
const quoteHeader = quoteOperation.parameters.find(
  (parameter) => parameter.in === 'header' && parameter.name === 'Idempotency-Key',
)
assert.equal(quoteOperation['x-idempotency-required'], true)
assert.deepEqual(quoteOperation['x-idempotency-scope'], [
  'company_id',
  'api_client_id',
  'route',
  'idempotency_key',
])
assert.equal(quoteHeader.required, true)
assert.equal(quoteHeader.schema.minLength, 8)
assert.equal(quoteHeader.schema.maxLength, 200)
assert.ok(quoteOperation.responses['503'])
for (const response of Object.values(quoteOperation.responses)) {
  assert.ok(response.headers?.['Idempotency-Replayed'])
}
assert.match(client, /'Idempotency-Key': \['website-quote', input\.quote_attempt_id, canonicalSha256\(requestBody\)\]\.join\(':'\)/)

const resolution = website.components.schemas.WebsiteEnergyAreaResolution
const assurance = website.components.schemas.PriceAreaAssurance
assert.ok(resolution.required.includes('price_area_assurance'))
assert.equal(resolution.properties.price_area_assurance.$ref, '#/components/schemas/PriceAreaAssurance')
assert.deepEqual(assurance.properties.status.enum, ['verified', 'estimated', 'ambiguous', 'unresolved'])
assert.deepEqual(assurance.properties.source.enum, [
  'facility_data',
  'grid_area_master',
  'address_polygon',
  'postal_city_consensus',
  'postal_consensus',
  null,
])

assert.match(client, /mapPriceAreaAssurance\(row\.price_area_assurance/)
assert.match(client, /price_area_assurance: priceAreaAssurance/)
assert.match(client, /!input\.pricingReady \|\|/)
assert.match(client, /value\.unique_price_area_count === 1/)
assert.match(client, /priceArea !== null && !isOpsWebsitePriceArea\(priceArea\)/)

assert.match(tokenSource, /const TOKEN_VERSION = 'ea6'/)
assert.match(tokenSource, /version: 3/)
assert.match(tokenSource, /resolution_status: resolutionStatus/)
assert.match(tokenSource, /price_area_assurance:/)
assert.match(tokenSource, /assuranceCanAuthorizePricing/)
assert.doesNotMatch(resolverRoute, /confidence >= 0\.95/)
assert.match(resolverRoute, /price_area_assurance: issued\.payload\.price_area_assurance/)
assert.match(resolverRoute, /assurance_level: resolution\.price_area_assurance\.status/)
assert.match(publicApi, /export type WebsitePriceAreaAssurance/)
assert.match(publicApi, /price_area_assurance\?: WebsitePriceAreaAssurance/)
assert.doesNotMatch(signup, /energyResolutionStatus: ["']resolved["']/)
assert.match(signup, /energyResolutionStatus: serverResolution\.resolutionStatus/)

assert.match(portalService, /supplierSwitch\.can_dispatch \?\? supplierSwitch\.canDispatch \?\? row\.can_start_switch/)
assert.match(auditStore, /assurance_level: assurance\.status/)
assert.match(auditStore, /assurance_evidence: assurance\.evidence/)
assert.match(migration, /'verified', 'estimated', 'ambiguous', 'unresolved'/)

const syncRequired = portal.paths['/api/v1/customer-portal/sync'].post.requestBody
  .content['application/json'].schema.required
assert.ok(syncRequired.includes('external_customer_id'))
assert.ok(syncRequired.includes('customer_portal_user_id'))
assert.ok(syncRequired.includes('auth_user_id'))
assert.doesNotMatch(client, /external_customer_id:\s*identity\.customerNumber/)

process.env.GRIDEX_WEBSITE_STATE_SIGNING_SECRET = 'gridex-regression-secret-that-is-at-least-thirty-two-bytes'
process.env.GRIDEX_WEBSITE_STATE_SIGNING_KID = 'regression'
const { issueWebsiteEnergyAreaToken, verifyWebsiteEnergyAreaToken } = await import('../lib/website/energyAreaToken.ts')
const now = new Date('2026-08-04T16:00:00.000Z')
const location = { postalCode: '21120', city: 'Malmö', address: 'Testgatan 1' }
const canonicalResolution = {
  status: 'postal_suggested',
  resolution_id: 'b5f0d364-ad29-46a6-b6bc-7f7e81340932',
  resolution_status: 'postal_suggested',
  capabilities: {
    pricing_ready: true,
    quote_ready: true,
    facility_lookup_ready: false,
    switch_request_creatable: false,
    switch_dispatch_ready: false,
  },
  blockers: { pricing: [], quote: [], facility_lookup: [], switch_creation: [], switch_dispatch: [] },
  retryable: false,
  warnings: ['postal_code_multiple_grid_area_candidates'],
  valid_until: '2026-08-04T17:00:00.000Z',
  price_area_code: 'SE3',
  confidence: 0.85,
  contract_version: release.release_version,
  price_area_assurance: {
    status: 'estimated',
    price_area: 'SE3',
    confidence: 0.85,
    source: 'postal_city_consensus',
    candidate_count: 2,
    unique_price_area_count: 1,
    source_version: '2026-08-04T15:00:00.000Z',
    evidence: { price_areas: ['SE3'] },
  },
}
const issued = issueWebsiteEnergyAreaToken({ resolution: canonicalResolution, location, now })
assert.ok(issued)
assert.equal(issued.payload.resolution_status, 'postal_suggested')
assert.equal(issued.payload.price_area_assurance.status, 'estimated')
assert.equal(issued.payload.confidence, 0.85)
assert.deepEqual(verifyWebsiteEnergyAreaToken({ token: issued.token, location, now }), {
  ok: true,
  payload: issued.payload,
})
assert.equal(issueWebsiteEnergyAreaToken({
  resolution: {
    ...canonicalResolution,
    price_area_assurance: { ...canonicalResolution.price_area_assurance, status: 'ambiguous' },
  },
  location,
  now,
}), null)

console.log(`${release.release_version} Gridex price-area API regressions passed`)
