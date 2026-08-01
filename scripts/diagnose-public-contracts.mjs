import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const CANONICAL_BASE_URL = 'https://app.gridex.se/api/v1'
const REQUIRED_PUBLIC_CONTRACT_SCOPE = 'website_contracts.read'
const LOCAL_MANIFEST_PATH = resolve('docs/openapi/release-manifest.json')
const LOCAL_WEBSITE_OPENAPI_PATH = resolve('docs/openapi/website-integration-v1.json')
const LOCAL_CUSTOMER_PORTAL_OPENAPI_PATH = resolve('docs/openapi/customer-portal-v1.json')

function nonEmpty(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null
}

function arrayOfStrings(value) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim())
    : []
}

function sha256File(path) {
  if (!existsSync(path)) return null
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function parseJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function safeError(payload, response) {
  const root = record(payload) ?? {}
  const nested = record(root.error) ?? {}
  return {
    code: nonEmpty(nested.code) ?? nonEmpty(root.code),
    message: nonEmpty(nested.message) ?? nonEmpty(root.message),
    request_id:
      nonEmpty(response.headers.get('x-request-id')) ??
      nonEmpty(nested.request_id) ??
      nonEmpty(root.request_id),
    trace_id:
      nonEmpty(response.headers.get('x-trace-id')) ??
      nonEmpty(nested.trace_id) ??
      nonEmpty(root.trace_id),
    correlation_id:
      nonEmpty(response.headers.get('x-correlation-id')) ??
      nonEmpty(nested.correlation_id) ??
      nonEmpty(root.correlation_id),
    field: nonEmpty(nested.field) ?? nonEmpty(root.field),
    stage: nonEmpty(nested.stage) ?? nonEmpty(root.stage),
    blockers: Array.isArray(root.blockers)
      ? root.blockers
      : Array.isArray(nested.blockers)
        ? nested.blockers
        : [],
  }
}

async function requestJson(url, { apiKey = null, timeoutMs = 15_000 } = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const headers = new Headers({ Accept: 'application/json' })
    if (apiKey) headers.set('Authorization', `Bearer ${apiKey}`)
    const response = await fetch(url, {
      method: 'GET',
      headers,
      redirect: 'manual',
      cache: 'no-store',
      signal: controller.signal,
    })
    const text = await response.text()
    const payload = parseJson(text)
    return {
      ok: response.ok,
      status: response.status,
      headers: response.headers,
      payload,
      error: response.ok ? null : safeError(payload, response),
      body_is_json: payload !== null,
    }
  } catch (error) {
    return {
      ok: false,
      status: null,
      headers: new Headers(),
      payload: null,
      error: {
        code: error?.name === 'AbortError' ? 'request_timeout' : 'network_error',
        message: error instanceof Error ? error.message : String(error),
        request_id: null,
        trace_id: null,
        correlation_id: null,
        field: null,
        stage: null,
        blockers: [],
      },
      body_is_json: false,
    }
  } finally {
    clearTimeout(timeout)
  }
}

function normalizeBaseUrl(value) {
  const candidate = nonEmpty(value) ?? CANONICAL_BASE_URL
  const parsed = new URL(candidate)
  if (parsed.protocol !== 'https:') throw new Error('GRIDEX_OPS_API_URL måste använda HTTPS.')
  parsed.hash = ''
  parsed.search = ''
  parsed.pathname = parsed.pathname.replace(/\/+$/, '')
  if (!parsed.pathname.endsWith('/api/v1')) {
    throw new Error('GRIDEX_OPS_API_URL måste sluta med /api/v1.')
  }
  return parsed.toString().replace(/\/$/, '')
}

function findStringArrays(input, keys, output = new Set(), seen = new Set()) {
  if (!input || typeof input !== 'object' || seen.has(input)) return output
  seen.add(input)
  if (Array.isArray(input)) {
    for (const item of input) findStringArrays(item, keys, output, seen)
    return output
  }
  for (const [key, value] of Object.entries(input)) {
    if (keys.has(key)) {
      for (const item of arrayOfStrings(value)) output.add(item)
    }
    findStringArrays(value, keys, output, seen)
  }
  return output
}

function findFirst(input, keys, seen = new Set()) {
  if (!input || typeof input !== 'object' || seen.has(input)) return null
  seen.add(input)
  if (!Array.isArray(input)) {
    for (const key of keys) {
      const value = input[key]
      if (value !== undefined && value !== null) return value
    }
    for (const value of Object.values(input)) {
      const found = findFirst(value, keys, seen)
      if (found !== null) return found
    }
  } else {
    for (const value of input) {
      const found = findFirst(value, keys, seen)
      if (found !== null) return found
    }
  }
  return null
}

function summarizeContext(result) {
  const root = record(result.payload) ?? {}
  const data = record(root.data) ?? root
  const capabilities = record(data.capabilities) ?? {}
  const scopes = [...findStringArrays(data, new Set(['active_scopes', 'activeScopes', 'scopes']))]
  const missingWebsiteScopes = [
    ...findStringArrays(capabilities, new Set([
      'missing_website_scopes',
      'missingWebsiteScopes',
      'missing_website_checkout_scopes',
      'missingWebsiteCheckoutScopes',
    ])),
  ]
  return {
    http_status: result.status,
    ok: result.ok,
    error: result.error,
    request_id: nonEmpty(result.headers.get('x-request-id')) ?? nonEmpty(root.request_id),
    contract_version_header: nonEmpty(result.headers.get('x-gridex-contract-version')),
    tenant_reference: nonEmpty(data.tenant_reference),
    api_client_reference: nonEmpty(data.api_client_reference),
    contract_version: nonEmpty(data.contract_version),
    operational_status: findFirst(data, [
      'operational_status',
      'operationalStatus',
      'tenant_status',
      'tenantStatus',
      'status',
    ]),
    website_checkout_ready: capabilities.website_checkout_ready === true,
    active_scopes: scopes.sort(),
    missing_website_scopes: missingWebsiteScopes.sort(),
    required_scope_present:
      scopes.includes(REQUIRED_PUBLIC_CONTRACT_SCOPE) ||
      (!scopes.length && !missingWebsiteScopes.includes(REQUIRED_PUBLIC_CONTRACT_SCOPE)),
  }
}

function summarizeContracts(result) {
  const root = record(result.payload) ?? {}
  const meta = record(root.meta) ?? {}
  const data = Array.isArray(root.data)
    ? root.data
    : Array.isArray(root.contracts)
      ? root.contracts
      : []
  const diagnostics = record(root.diagnostics) ?? {}
  const blockers = Array.isArray(diagnostics.blockers)
    ? diagnostics.blockers
    : Array.isArray(root.blockers)
      ? root.blockers
      : []
  return {
    http_status: result.status,
    ok: result.ok,
    error: result.error,
    request_id:
      nonEmpty(result.headers.get('x-request-id')) ??
      nonEmpty(root.request_id) ??
      nonEmpty(result.error?.request_id),
    trace_id: nonEmpty(result.error?.trace_id),
    correlation_id:
      nonEmpty(result.headers.get('x-correlation-id')) ??
      nonEmpty(result.error?.correlation_id),
    contract_version_header: nonEmpty(result.headers.get('x-gridex-contract-version')),
    contract_schema_version: nonEmpty(meta.contract_schema_version),
    tenant_reference: nonEmpty(meta.tenant_reference),
    publication_revision:
      Number.isSafeInteger(meta.publication_revision) ? meta.publication_revision : null,
    reported_count: Number.isSafeInteger(meta.count) ? meta.count : null,
    actual_count: data.length,
    blocker_count: blockers.length,
    etag: nonEmpty(result.headers.get('etag')),
  }
}

function summarizeDiagnostics(result) {
  const root = record(result.payload) ?? {}
  const data = root.data ?? root.items ?? root.diagnostics ?? null
  return {
    http_status: result.status,
    ok: result.ok,
    error: result.error,
    request_id:
      nonEmpty(result.headers.get('x-request-id')) ??
      nonEmpty(root.request_id) ??
      nonEmpty(result.error?.request_id),
    trace_id: nonEmpty(result.error?.trace_id),
    item_count: Array.isArray(data) ? data.length : null,
    data,
  }
}

function localManifestSummary(liveManifestResult) {
  const localManifest = existsSync(LOCAL_MANIFEST_PATH)
    ? parseJson(readFileSync(LOCAL_MANIFEST_PATH, 'utf8'))
    : null
  const liveManifest = record(liveManifestResult.payload)
  const localWebsiteSha = sha256File(LOCAL_WEBSITE_OPENAPI_PATH)
  const localPortalSha = sha256File(LOCAL_CUSTOMER_PORTAL_OPENAPI_PATH)
  const expectedLocalWebsiteSha = nonEmpty(localManifest?.specifications?.website?.sha256)
  const expectedLocalPortalSha = nonEmpty(localManifest?.specifications?.customer_portal?.sha256)
  const liveWebsiteSha = nonEmpty(liveManifest?.specifications?.website?.sha256)
  const livePortalSha = nonEmpty(liveManifest?.specifications?.customer_portal?.sha256)
  const localReleaseVersion = nonEmpty(localManifest?.release_version)
  const liveReleaseVersion = nonEmpty(liveManifest?.release_version)
  return {
    live_manifest_http_status: liveManifestResult.status,
    live_manifest_error: liveManifestResult.error,
    local_release_version: localReleaseVersion,
    live_release_version: liveReleaseVersion,
    local_website_file_sha256: localWebsiteSha,
    local_website_manifest_sha256: expectedLocalWebsiteSha,
    live_website_manifest_sha256: liveWebsiteSha,
    local_customer_portal_file_sha256: localPortalSha,
    local_customer_portal_manifest_sha256: expectedLocalPortalSha,
    live_customer_portal_manifest_sha256: livePortalSha,
    local_files_match_local_manifest:
      localWebsiteSha === expectedLocalWebsiteSha && localPortalSha === expectedLocalPortalSha,
    local_manifest_matches_live_manifest:
      expectedLocalWebsiteSha === liveWebsiteSha && expectedLocalPortalSha === livePortalSha,
    same_version_checksum_drift:
      Boolean(localReleaseVersion) &&
      localReleaseVersion === liveReleaseVersion &&
      (expectedLocalWebsiteSha !== liveWebsiteSha || expectedLocalPortalSha !== livePortalSha),
  }
}

async function inspectSupabaseSnapshotStore() {
  const supabaseUrl = nonEmpty(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const serviceRoleKey = nonEmpty(process.env.SUPABASE_SERVICE_ROLE_KEY)
  if (!supabaseUrl || !serviceRoleKey) {
    return {
      checked: false,
      reason: 'NEXT_PUBLIC_SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY saknas i körmiljön.',
    }
  }

  const endpoint = new URL('/rest/v1/website_public_contract_snapshots', supabaseUrl)
  endpoint.searchParams.set(
    'select',
    'cache_key,tenant_reference,customer_type,publication_revision,accepted_count,blocked_count,updated_at',
  )
  endpoint.searchParams.set('order', 'updated_at.desc')
  endpoint.searchParams.set('limit', '5')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    const response = await fetch(endpoint, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
      redirect: 'manual',
      signal: controller.signal,
    })
    const text = await response.text()
    const payload = parseJson(text)
    return {
      checked: true,
      ok: response.ok,
      http_status: response.status,
      error: response.ok ? null : safeError(payload, response),
      snapshot_count_returned: Array.isArray(payload) ? payload.length : 0,
      snapshots: Array.isArray(payload) ? payload : [],
    }
  } catch (error) {
    return {
      checked: true,
      ok: false,
      http_status: null,
      error: {
        code: error?.name === 'AbortError' ? 'request_timeout' : 'network_error',
        message: error instanceof Error ? error.message : String(error),
      },
      snapshot_count_returned: 0,
      snapshots: [],
    }
  } finally {
    clearTimeout(timeout)
  }
}

function outputSection(title, value) {
  console.log(`\n=== ${title} ===`)
  console.log(JSON.stringify(value, null, 2))
}

const apiKey = nonEmpty(process.env.GRIDEX_API_KEY)
if (!apiKey) {
  console.error('GRIDEX_API_KEY saknas. Kör skriptet med Vercels Production-miljö inläst.')
  process.exit(2)
}

let baseUrl
try {
  baseUrl = normalizeBaseUrl(process.env.GRIDEX_OPS_API_URL)
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(2)
}

const customerType = process.argv.includes('--business') ? 'business' : 'private'
const [contextResult, contractsResult, diagnosticsResult, liveManifestResult, snapshotStore] = await Promise.all([
  requestJson(`${baseUrl}/integration/context`, { apiKey }),
  requestJson(`${baseUrl}/website/public-contracts?customer_type=${customerType}`, { apiKey }),
  requestJson(`${baseUrl}/website/public-contracts/diagnostics?customer_type=${customerType}`, { apiKey }),
  requestJson(`${baseUrl}/openapi/release-manifest.json`),
  inspectSupabaseSnapshotStore(),
])

const context = summarizeContext(contextResult)
const contracts = summarizeContracts(contractsResult)
const diagnostics = summarizeDiagnostics(diagnosticsResult)
const openapi = localManifestSummary(liveManifestResult)

outputSection('Integration context', context)
outputSection('Website public contracts', contracts)
outputSection('Publication diagnostics', diagnostics)
outputSection('OpenAPI drift', openapi)
outputSection('Durable public-contract snapshot store', snapshotStore)

const failures = []
if (!context.ok) failures.push(`integration/context HTTP ${context.http_status ?? 'network_error'}: ${context.error?.code ?? 'unknown_error'}`)
if (context.missing_website_scopes.includes(REQUIRED_PUBLIC_CONTRACT_SCOPE)) {
  failures.push(`API-nyckeln saknar ${REQUIRED_PUBLIC_CONTRACT_SCOPE}`)
}
if (!contracts.ok) failures.push(`website/public-contracts HTTP ${contracts.http_status ?? 'network_error'}: ${contracts.error?.code ?? 'unknown_error'}`)
if (contracts.ok && contracts.actual_count === 0) failures.push('OPS returnerar 0 publicerade privata avtal')
if (
  contracts.ok &&
  contracts.contract_version_header &&
  contracts.contract_schema_version &&
  contracts.contract_version_header !== contracts.contract_schema_version
) {
  failures.push('X-Gridex-Contract-Version skiljer sig från meta.contract_schema_version')
}
if (!openapi.local_files_match_local_manifest) failures.push('Lokala OpenAPI-filer matchar inte lokalt release-manifest')
if (!openapi.local_manifest_matches_live_manifest) failures.push('Lokalt release-manifest/OpenAPI är osynkat mot live OPS')
if (snapshotStore.checked && !snapshotStore.ok) failures.push('Durable snapshot-tabellen kan inte läsas med service-role')

console.log('\n=== Slutsats ===')
if (failures.length === 0) {
  console.log('Alla obligatoriska kontroller är gröna och OPS returnerar minst ett avtal.')
  process.exit(0)
}
for (const failure of failures) console.log(`- ${failure}`)
process.exitCode = 1
