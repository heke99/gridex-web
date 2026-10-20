import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Real catalogue client, transport, schema parser and snapshot query builder.
// Only remote OPS/PostgREST I/O and time are synthetic; no live service is used.
process.env.GRIDEX_API_KEY = 'gridex_cold_catalogue_synthetic'
process.env.GRIDEX_OPS_API_URL = 'https://app.gridex.se/api/v1'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://snapshot-cold.invalid'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-cold-snapshot-key'
process.env.VERCEL_ENV = 'production'
// This cache lifecycle test uses the current store version. Frozen-release
// compatibility remains covered independently by public-contract-v4-runtime.
const { GRIDEX_WEBSITE_API_CONTRACT_VERSION } = await import('../lib/ops/contract.ts')
const fixture = JSON.parse(readFileSync(new URL('./fixtures/public-contracts.ops-2026-10-04.1.json', import.meta.url), 'utf8').replaceAll('2026-10-04.1', GRIDEX_WEBSITE_API_CONTRACT_VERSION))
const version = fixture.meta.contract_schema_version
const organization = fixture.meta.organization_reference
const OriginalDate = Date, nativeFetch = globalThis.fetch
let clock = OriginalDate.now(), durable = null, upstreamStatus = 200, requestAdvanceMs = 0
let notModifiedEtag = '"cold-catalogue"'
const calls = [], reads = []
globalThis.Date = class extends OriginalDate {
  constructor(...args) { super(...(args.length ? args : [clock])) }
  static now() { return clock }
}
const context = { data: {
  organization_reference: organization, api_client_reference: 'api_client_cold_fixture', api_version: 'v1',
  authoritative_identity: 'api_key', contract_version: version, active_scopes: ['integration_context.read', 'website_public_contracts.read'],
  configuration: { required_environment_variables: ['GRIDEX_API_KEY'], api_base_url: process.env.GRIDEX_OPS_API_URL,
    authentication: { header: 'Authorization', scheme: 'Bearer', server_side_only: true },
    openapi_url: process.env.GRIDEX_OPS_API_URL + '/openapi/website-integration-v1.json',
    customer_portal_openapi_url: process.env.GRIDEX_OPS_API_URL + '/openapi/customer-portal-v1.json', application_reference_location: 'top_level' },
  capabilities: { website_checkout_ready: true, customer_portal_ready: false, complete_integration_ready: false,
    missing_website_scopes: [], missing_customer_portal_scopes: ['customer_profile.read'], missing_recommended_scopes: [] },
}, request_id: fixture.request_id, contract_schema_version: version }
function json(value, status = 200, extra = {}) {
  return Response.json(value, { status, headers: { 'X-Gridex-Contract-Version': version, ...extra } })
}
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(String(input))
  if (url.origin === 'https://snapshot-cold.invalid') {
    if (url.pathname.endsWith('/rpc/store_website_public_contract_snapshot_v2')) {
      const args = JSON.parse(init.body)
      durable = { cache_key: args.p_cache_key, snapshot: structuredClone(args.p_snapshot) }
      return json([{ stored: true, result: 'stored', empty_authorized: false, stored_revision: args.p_publication_revision }])
    }
    assert.equal(url.pathname, '/rest/v1/website_public_contract_snapshots')
    reads.push(url)
    assert.equal(url.searchParams.get('select'), 'snapshot')
    let eligible = Boolean(durable)
    for (const [key, value] of url.searchParams) {
      if (key === 'select') continue
      const [operation, ...parts] = value.split('.'), expected = parts.join('.')
      const actual = key === 'cache_key' ? durable?.cache_key : durable?.snapshot[key]
      assert.ok(['eq', 'gte'].includes(operation))
      eligible &&= operation === 'gte' ? Date.parse(actual) >= Date.parse(expected) : actual === expected
    }
    return json(eligible ? [{ snapshot: durable.snapshot }] : [])
  }
  assert.equal(url.origin, 'https://app.gridex.se', 'real network access is forbidden')
  if (url.pathname === '/api/v1/integration/context') return json(context)
  assert.equal(url.pathname, '/api/v1/website/public-contracts')
  calls.push(new Headers(init.headers).get('If-None-Match'))
  clock += requestAdvanceMs
  requestAdvanceMs = 0
  if (upstreamStatus === 503) return json({ error: { code: 'PUBLIC_CONTRACTS_TEMPORARILY_UNAVAILABLE', message: 'Synthetic outage', retryable: true }, request_id: fixture.request_id, contract_schema_version: version }, 503, { 'Retry-After': '120' })
  if (calls.at(-1)) return new Response(null, { status: 304, headers: { ETag: notModifiedEtag, 'X-Gridex-Contract-Version': version } })
  return json(fixture, 200, { ETag: '"cold-catalogue"' })
}
try {
  const { fetchOpsPublicContractsSnapshot } = await import('../lib/ops/client.ts')
  const { publicContractsCache } = await import('../lib/ops/client/core.ts')
  const first = await fetchOpsPublicContractsSnapshot(null, { forceFresh: true })
  assert.equal(first.upstream_status, 200)
  const revalidated = await fetchOpsPublicContractsSnapshot(null, { allowStaleFallback: false })
  assert.equal(revalidated.upstream_status, 304, 'strict quote checks can use an actual live conditional response')
  assert.equal(revalidated.stale, false)
  notModifiedEtag = '"unexpected-validator"'
  await assert.rejects(fetchOpsPublicContractsSnapshot(null, { allowStaleFallback: false }),
    error => error.code === 'ops_public_contracts_304_validator_mismatch',
    'strict checks reject a304 that does not confirm the sent validator')
  notModifiedEtag = '"cold-catalogue"'
  // A CDN may weaken a200 ETag after compression while the origin returns
  // its strong form on304. If-None-Match uses weak comparison (RFC9110).
  for (const [candidate, received] of [['W/"cold-catalogue"', '"cold-catalogue"'], ['"cold-catalogue"', 'W/"cold-catalogue"']]) {
    for (const cached of (await import('../lib/ops/client/core.ts')).publicContractsCache.values()) cached.etag = candidate
    notModifiedEtag = received
    const weakRevalidated = await fetchOpsPublicContractsSnapshot(null, { allowStaleFallback: false })
    assert.equal(weakRevalidated.upstream_status, 304, 'strong and weak forms with the same opaque tag confirm the representation')
  }
  for (const cached of (await import('../lib/ops/client/core.ts')).publicContractsCache.values()) cached.etag = '"cold-catalogue"'
  notModifiedEtag = '"cold-catalogue"'
  upstreamStatus = 503
  await assert.rejects(fetchOpsPublicContractsSnapshot(null, { allowStaleFallback: false }),
    error => error.status === 503,
    'strict quote checks must reject an outage even when a fresh cached snapshot exists')
  const initialClock = clock
  clock += 60_000
  upstreamStatus = 503
  const fallback = await fetchOpsPublicContractsSnapshot(null)
  assert.equal(fallback.stale, true, 'a still-eligible last-known-good fallback remains available')
  assert.equal(fallback.source, 'stale-cache')

  upstreamStatus = 200
  publicContractsCache.clear() // Model a different cold server instance.
  clock = initialClock + 16 * 60_000
  const confirmed = await fetchOpsPublicContractsSnapshot(null)
  assert.equal(confirmed.upstream_status, 304, 'expired display data can retain its ETag for live upstream verification')
  assert.equal(calls.at(-1), '\"cold-catalogue\"')
  assert.equal(confirmed.stale, false)
  assert.deepEqual(confirmed.contracts, first.contracts)
  assert.ok(Date.parse(reads.at(-1).searchParams.get('fetched_at').slice(4)) < Date.parse(first.fetched_at))
  const strictExpired = await fetchOpsPublicContractsSnapshot(null, { allowStaleFallback: false })
  assert.equal(strictExpired.upstream_status, 304, 'an older compatible candidate still requires live confirmation')
  assert.equal(strictExpired.stale, false)

  upstreamStatus = 503
  await assert.rejects(fetchOpsPublicContractsSnapshot(null), error => error.status === 503,
    'expired data is a revalidation candidate, never an outage fallback')
  publicContractsCache.clear()
  await assert.rejects(fetchOpsPublicContractsSnapshot(null), error => error.status === 503,
    'a cold instance must not serve an unconfirmed expired durable snapshot either')

  // Exercise the same real durable store used by background304 renewal. Its
  // success must remain usable even while process memory retains the old age.
  const { storeWebsitePublicContractSnapshot } = await import('../lib/website/publicContractSnapshotStore.ts')
  const renewed = { ...confirmed, fetched_at: new Date().toISOString() }
  await storeWebsitePublicContractSnapshot({ cacheKey: durable.cache_key, customerType: 'all', snapshot: renewed })
  const afterRenewal = await fetchOpsPublicContractsSnapshot(null)
  assert.equal(afterRenewal.stale, true)
  assert.equal(afterRenewal.fetched_at, renewed.fetched_at, 'a successful durable renewal is reread before denying fallback')

  clock += 899_000
  requestAdvanceMs = 2_000
  await assert.rejects(fetchOpsPublicContractsSnapshot(null), error => error.status === 503,
    'a snapshot that expires while waiting for OPS cannot cross the fallback return boundary')

  upstreamStatus = 200
  const before = reads.length
  const finalFresh = await fetchOpsPublicContractsSnapshot(null, { forceFresh: true })
  assert.equal(finalFresh.upstream_status, 200)
  assert.equal(calls.at(-1), null, 'final verification bypasses conditional cache')
  assert.equal(reads.length, before, 'final verification does not use the durable revalidation candidate')

  publicContractsCache.clear()
  clock += 86_400_001
  upstreamStatus = 503
  await assert.rejects(fetchOpsPublicContractsSnapshot(null), error => error.status === 503)
  assert.equal(calls.at(-1), null, 'a candidate older than24 hours is discarded')
  upstreamStatus = 200
  await fetchOpsPublicContractsSnapshot(null)

  publicContractsCache.clear()
  durable.snapshot.organization_reference = 'organization_other_0123456789abcdef'
  await fetchOpsPublicContractsSnapshot(null)
  assert.equal(calls.at(-1), null, 'wrong-organization candidates cannot supply a conditional validator')
  console.log('Cold catalogue: expired ETag304, expired outage denial, fresh fallback, final200 and organization isolation passed')
} finally {
  globalThis.Date = OriginalDate
  globalThis.fetch = nativeFetch
}
