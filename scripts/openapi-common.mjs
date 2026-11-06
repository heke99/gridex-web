import { createHash } from 'node:crypto'

export const BASE_URL = 'https://app.gridex.se/api/v1/openapi'
export const RELEASE_MANIFEST_URL = `${BASE_URL}/release-manifest.json`
export const SPECS = [
  ['website-integration-v1.json', 'website-api.d.ts'],
  ['customer-portal-v1.json', 'customer-portal-api.d.ts'],
]

export function canonical(value) {
  return `${JSON.stringify(value)}\n`
}

export function sha(value) {
  return createHash('sha256').update(value).digest('hex')
}

export function assertOpenApiDocument(spec, specName, source, expectedVersion = null) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    throw new Error(`${specName} ${source} document is not an object`)
  }
  const version = spec.info?.version
  if (typeof version !== 'string' || !version.trim()) {
    throw new Error(`${specName} ${source} contract version is missing`)
  }
  if (expectedVersion && version !== expectedVersion) {
    throw new Error(`${specName} ${source} contract version mismatch: expected ${expectedVersion}, received ${version}`)
  }
  if (typeof spec.openapi !== 'string' || !spec.openapi.startsWith('3.')) {
    throw new Error(`${specName} ${source} document is not OpenAPI 3`)
  }
  if (!spec.paths || typeof spec.paths !== 'object' || Object.keys(spec.paths).length === 0) {
    throw new Error(`${specName} ${source} document contains no paths`)
  }
  return version
}

export async function fetchJsonSpec(specName) {
  const response = await fetch(`${BASE_URL}/${specName}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  })
  if (!response.ok) throw new Error(`OpenAPI fetch failed for ${specName}: ${response.status}`)
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('json')) {
    throw new Error(`${specName} returned unexpected content type: ${contentType || 'missing'}`)
  }
  return response.json()
}

export async function fetchReleaseManifest() {
  const response = await fetch(RELEASE_MANIFEST_URL, {
    redirect: 'error',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  })
  if (!response.ok) {
    throw new Error(`OpenAPI release manifest fetch failed: ${response.status}`)
  }
  if (!response.headers.get('content-type')?.toLowerCase().includes('json')) throw new Error('Release manifest is not JSON')
  const manifest = await response.json()
  return assertReleaseManifest(manifest)
}

function revision(value) {
  const match = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})\.(\d+)$/.exec(value)
  if (!match) throw new Error('Invalid release revision')
  const [year, month, day, patch] = match.slice(1).map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (!Number.isSafeInteger(patch) || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new Error('Invalid release revision')
  return [year * 10000 + month * 100 + day, patch]
}
const greater = (a, b) => a[0] > b[0] || a[0] === b[0] && a[1] > b[1]

/** OPS publishes documentation and wire revisions independently. Verify both. */
export function assertReleaseManifest(manifest) {
  const version = manifest?.release_version
  const doc = revision(version), wire = revision(manifest?.runtime_contract_version), floor = revision(manifest?.minimum_tenant_integration_version)
  if ([manifest?.website_openapi_version, manifest?.customer_portal_openapi_version, manifest?.guide_version].some(v => v !== version)) throw new Error('OpenAPI release manifest contains mixed documentation versions')
  if (greater(wire, doc) || greater(floor, wire)) throw new Error('Invalid runtime compatibility bounds')
  if (!['backward-compatible', 'breaking-client-update-required', 'breaking'].includes(manifest.compatibility_classification) || version !== manifest.runtime_contract_version && manifest.compatibility_classification !== 'backward-compatible') throw new Error('Incompatible documentation-only release')
  for (const [key, file] of [['website','website-integration-v1.json'], ['customer_portal','customer-portal-v1.json']]) {
    const spec = manifest?.specifications?.[key]
    if (spec?.contract_version !== version || spec?.url !== `${BASE_URL}/${file}` || spec?.immutable_url !== `${BASE_URL}/${version}/${file}` || !/^[a-f0-9]{64}$/.test(spec?.sha256 ?? '')) throw new Error(`OpenAPI release manifest contains an invalid ${key} specification`)
  }
  return manifest
}

export function assertReleaseSpecification(document, manifest, name) {
  assertOpenApiDocument(document, name, 'published', manifest.release_version)
  if (document['x-contract-schema-version'] !== manifest.runtime_contract_version || document['x-gridex-release-version'] !== undefined && document['x-gridex-release-version'] !== manifest.release_version) throw new Error(`${name} runtime/documentation binding mismatch`)
  return document
}

export async function fetchManifestSpecification(specification) {
  const response = await fetch(specification.url, {
    headers: { Accept: 'application/json' },
    redirect: 'error',
    signal: AbortSignal.timeout(20_000),
  })
  if (!response.ok) {
    throw new Error(`OpenAPI fetch failed for ${specification.url}: ${response.status}`)
  }
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('json')) {
    throw new Error(
      `${specification.url} returned unexpected content type: ${contentType || 'missing'}`,
    )
  }
  const rawText = await response.text()
  const digest = sha(rawText)
  if (digest !== specification.sha256) {
    throw new Error(
      `OpenAPI SHA-256 mismatch for ${specification.url}: expected ${specification.sha256}, received ${digest}`,
    )
  }
  let document
  try {
    document = JSON.parse(rawText)
  } catch (error) {
    throw new Error(
      `OpenAPI document from ${specification.url} is not valid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }
  return { document, rawText, sha256: digest }
}
