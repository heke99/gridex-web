import assert from 'node:assert/strict'
import { getVerifiedOpsIntegrationContext } from '../lib/ops/client.ts'
import { GRIDEX_WEBSITE_API_CONTRACT_VERSION as version } from '../lib/ops/contract.ts'

const names = ['GRIDEX_API_KEY', 'GRIDEX_OPS_API_URL', 'VERCEL_ENV']
const previous = names.map(name => process.env[name])
const originalFetch = globalThis.fetch
const originalNow = Date.now
const baseUrl = 'https://app.gridex.se/api/v1'
let clock = originalNow()
let calls = 0
let responseFor
Date.now = () => clock
process.env.GRIDEX_OPS_API_URL = baseUrl
process.env.VERCEL_ENV = 'production'

function context(organization = 'organization_cache_fixture_0123456789', client = 'api_client_cache_fixture') {
  return {
    data: {
      organization_reference: organization,
      api_client_reference: client,
      api_version: 'v1',
      authoritative_identity: 'api_key',
      contract_version: version,
      active_scopes: ['integration_context.read', 'website_public_contracts.read'],
      configuration: {
        required_environment_variables: ['GRIDEX_API_KEY'],
        api_base_url: baseUrl,
        authentication: { header: 'Authorization', scheme: 'Bearer', server_side_only: true },
        openapi_url: `${baseUrl}/openapi/website-integration-v1.json`,
        customer_portal_openapi_url: `${baseUrl}/openapi/customer-portal-v1.json`,
        application_reference_location: 'top_level',
      },
      capabilities: {
        website_checkout_ready: true,
        customer_portal_ready: false,
        complete_integration_ready: false,
        missing_website_scopes: [],
        missing_customer_portal_scopes: ['customer_profile.read'],
        missing_recommended_scopes: [],
      },
    },
    request_id: '00000000-0000-4000-8000-000000000099',
    contract_schema_version: version,
  }
}

function response(payload = context(), status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: {
    'Content-Type': 'application/json', 'X-Gridex-Contract-Version': version,
  } })
}

function deferred() {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

function selectApiKey(suffix) {
  process.env.GRIDEX_API_KEY = `gridex_context_cache_fixture_${suffix}`
}

globalThis.fetch = async (url, init) => {
  assert.equal(new URL(String(url)).pathname, '/api/v1/integration/context')
  assert.equal(init.cache, 'no-store')
  const index = ++calls
  return responseFor(new Headers(init.headers).get('Authorization'), index)
}

const evidence = {}
try {
  selectApiKey('burst')
  let gate = deferred()
  responseFor = async () => { await gate.promise; return response() }
  let before = calls
  const burst = Array.from({ length: 20 }, () => getVerifiedOpsIntegrationContext())
  await new Promise(resolve => setImmediate(resolve))
  gate.resolve()
  const values = await Promise.all(burst)
  evidence.simultaneous_readers = values.length
  evidence.upstream_requests = calls - before
  assert.equal(calls - before, 1, 'concurrent reads for one API identity share a single OPS request')
  assert.ok(values.every(value => value.organization_reference === 'organization_cache_fixture_0123456789'))
  await getVerifiedOpsIntegrationContext()
  assert.equal(calls - before, 1, 'successful context keeps the existing 60-second cache')

  clock += 60_001
  gate = deferred()
  before = calls
  const expired = Array.from({ length: 8 }, () => getVerifiedOpsIntegrationContext())
  await new Promise(resolve => setImmediate(resolve))
  gate.resolve()
  await Promise.all(expired)
  assert.equal(calls - before, 1, 'expired context is revalidated once for the burst')

  selectApiKey('isolation_a')
  gate = deferred()
  responseFor = async authorization => {
    await gate.promise
    return response(context(authorization.endsWith('isolation_a') ? 'organization_a_01234567890123456789' : 'organization_b_01234567890123456789'))
  }
  before = calls
  const identityA = getVerifiedOpsIntegrationContext()
  selectApiKey('isolation_b')
  const identityB = getVerifiedOpsIntegrationContext()
  await new Promise(resolve => setImmediate(resolve))
  gate.resolve()
  assert.equal((await identityA).organization_reference, 'organization_a_01234567890123456789')
  assert.equal((await identityB).organization_reference, 'organization_b_01234567890123456789')
  assert.equal(calls - before, 2, 'different API keys never share a request')

  selectApiKey('base_isolation')
  gate = deferred()
  responseFor = async () => { await gate.promise; return response() }
  before = calls
  const baseA = getVerifiedOpsIntegrationContext()
  process.env.GRIDEX_OPS_API_URL = 'https://app.gridex.se/api/v1/'
  // Normalized equivalent URL is the same authority and should coalesce.
  const baseB = getVerifiedOpsIntegrationContext()
  await new Promise(resolve => setImmediate(resolve))
  gate.resolve()
  await Promise.all([baseA, baseB])
  assert.equal(calls - before, 1)
  process.env.GRIDEX_OPS_API_URL = baseUrl

  selectApiKey('failure')
  gate = deferred()
  responseFor = async () => {
    await gate.promise
    return response({ error: { code: 'forbidden', message: 'Fixture scope missing' } }, 403)
  }
  before = calls
  const failed = Promise.allSettled(Array.from({ length: 6 }, () => getVerifiedOpsIntegrationContext()))
  await new Promise(resolve => setImmediate(resolve))
  gate.resolve()
  assert.ok((await failed).every(result => result.status === 'rejected' && result.reason.status === 403))
  assert.equal(calls - before, 1, 'failed requests are shared only while pending')
  responseFor = async () => response()
  await getVerifiedOpsIntegrationContext()
  assert.equal(calls - before, 2, 'a failure is never kept as a cached result')

  selectApiKey('invalid')
  responseFor = async () => response({ data: {}, contract_schema_version: version })
  await assert.rejects(getVerifiedOpsIntegrationContext())
  responseFor = async () => response()
  assert.equal((await getVerifiedOpsIntegrationContext()).organization_reference, 'organization_cache_fixture_0123456789')

  selectApiKey('force_fresh')
  const olderGate = deferred()
  const newerGate = deferred()
  before = calls
  responseFor = async (_authorization, index) => {
    const older = index === before + 1
    await (older ? olderGate.promise : newerGate.promise)
    return response(context('organization_cache_fixture_0123456789', older ? 'api_client_old' : 'api_client_new'))
  }
  const olderRead = getVerifiedOpsIntegrationContext()
  const freshRead = getVerifiedOpsIntegrationContext(true)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(calls - before, 2, 'forceFresh always makes its own OPS request')
  newerGate.resolve()
  assert.equal((await freshRead).api_client_reference, 'api_client_new')
  olderGate.resolve()
  assert.equal((await olderRead).api_client_reference, 'api_client_old')
  assert.equal((await getVerifiedOpsIntegrationContext()).api_client_reference, 'api_client_new',
    'a delayed older read cannot overwrite a newer completed verification')
  evidence.expiry_revalidation = true
  evidence.api_key_isolation = true
  evidence.error_and_invalid_payload_recovery = true
  evidence.force_fresh_bypass_and_ordering = true
  console.log('OPS integration-context cache checks passed:', JSON.stringify(evidence))
} finally {
  globalThis.fetch = originalFetch
  Date.now = originalNow
  names.forEach((name, index) => {
    if (previous[index] === undefined) delete process.env[name]
    else process.env[name] = previous[index]
  })
}
