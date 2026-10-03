import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  fetchOpsPublicContractsSnapshot,
  integrationContextFromPayload,
} from '../lib/ops/client.ts'
import { assertWebsiteOperationResponse } from '../lib/ops/validators/openapi.ts'
import { GRIDEX_WEBSITE_OPENAPI_SHA256 } from '../lib/ops/contract.ts'
import { buildPublicContractDisplay } from '../lib/website/publicContractDisplay.ts'

// Frozen upstream release, independent of the implementation's local version.
// Before the hotfix, the production validator rejects /data/contract_version
// with canonical_response_schema_invalid before processing these offers.
const version = '2026-10-02.4'
const baseUrl = 'https://app.gridex.se/api/v1'
const organization = 'organization_hotfix_0123456789abcdef'
const fixture = JSON.parse(readFileSync(new URL(
  './fixtures/public-contracts.ops-2026-10-02.4.json', import.meta.url,
), 'utf8'))
const context = {
  data: {
    organization_reference: organization,
    api_client_reference: 'api_client_hotfix_fixture',
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
  request_id: '00000000-0000-4000-8000-000000000011',
  contract_schema_version: version,
}

assertWebsiteOperationResponse('/api/v1/integration/context', 'get', 200, context)
assert.equal(integrationContextFromPayload(context).contract_version, version)

const names = ['GRIDEX_API_KEY', 'GRIDEX_OPS_API_URL', 'VERCEL_ENV',
  'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
const previous = names.map((name) => process.env[name])
const originalFetch = globalThis.fetch
const originalError = console.error
let publicPayload = structuredClone(fixture)
const requests = []
process.env.GRIDEX_API_KEY = 'gridex_public_v4_runtime_fixture'
process.env.GRIDEX_OPS_API_URL = baseUrl
process.env.VERCEL_ENV = 'production'
delete process.env.NEXT_PUBLIC_SUPABASE_URL
delete process.env.SUPABASE_SERVICE_ROLE_KEY
try {
  // The existing snapshot-store fallback is exercised without a DB dependency.
  console.error = (...args) => {
    if (args[0] === '[gridex-public-contracts] persistent snapshot write failed') return
    originalError(...args)
  }
  globalThis.fetch = async (url, init = {}) => {
    const path = new URL(String(url)).pathname
    requests.push({ path, init })
    const payload = path === '/api/v1/integration/context' ? context : publicPayload
    assert.ok(['/api/v1/integration/context', '/api/v1/website/public-contracts'].includes(path))
    assert.equal(new Headers(init.headers).get('Authorization'), 'Bearer gridex_public_v4_runtime_fixture')
    return new Response(JSON.stringify(payload), { headers: {
      'content-type': 'application/json', 'X-Gridex-Contract-Version': version,
      'X-Request-ID': payload.request_id, ETag: '"public-v4-fixture"',
    } })
  }
  const snapshot = await fetchOpsPublicContractsSnapshot(null, { forceFresh: true })
  assert.equal(snapshot.source, 'live')
  assert.equal(snapshot.stale, false)
  assert.equal(snapshot.contract_version, version)
  assert.equal(snapshot.schema_sha256, GRIDEX_WEBSITE_OPENAPI_SHA256)
  assert.equal(snapshot.organization_reference, organization)
  assert.equal(snapshot.contracts.length, 1)
  assert.equal(snapshot.blocked_contracts.length, 0)
  assert.equal(buildPublicContractDisplay(snapshot.contracts[0]).ready, true)
  assert.equal(snapshot.feed_state, 'contracts_present')
  assert.ok(requests.some((request) => request.path === '/api/v1/integration/context'))
  assert.ok(requests.some((request) => request.path === '/api/v1/website/public-contracts'))

  publicPayload.meta.organization_reference = 'organization_other_0123456789abcdef'
  await assert.rejects(
    fetchOpsPublicContractsSnapshot(null, { forceFresh: true }),
    (error) => error.code === 'ops_organization_mismatch',
    'a synchronized schema must preserve tenant isolation',
  )

  publicPayload = structuredClone(fixture)
  publicPayload.meta.contract_schema_version = '2026-08-22.2'
  await assert.rejects(
    fetchOpsPublicContractsSnapshot(null, { forceFresh: true }),
    (error) => error.code === 'ops_public_contracts_contract_version_sources_mismatch',
    'mixed response header/payload releases must fail closed',
  )

  publicPayload = structuredClone(fixture)
  publicPayload.data[0].price_options[0].markup = '1'
  publicPayload.contracts = structuredClone(publicPayload.data)
  await assert.rejects(
    fetchOpsPublicContractsSnapshot(null, { forceFresh: true }),
    (error) => error.code === 'ops_public_contracts_all_blocked',
    'incorrect commercial types must still block public offers',
  )
} finally {
  globalThis.fetch = originalFetch
  console.error = originalError
  names.forEach((name, index) => {
    if (previous[index] === undefined) delete process.env[name]
    else process.env[name] = previous[index]
  })
}

console.log('Public OPS 2026-10-02.4 producer and isolation regression passed')
