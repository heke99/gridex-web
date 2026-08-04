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
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  })
  if (!response.ok) {
    throw new Error(`OpenAPI release manifest fetch failed: ${response.status}`)
  }
  const manifest = await response.json()
  const version = manifest?.release_version
  const versions = [
    manifest?.website_openapi_version,
    manifest?.customer_portal_openapi_version,
    manifest?.runtime_contract_version,
    manifest?.guide_version,
  ]
  if (
    typeof version !== 'string' ||
    versions.some((candidate) => candidate !== version)
  ) {
    throw new Error('OpenAPI release manifest contains mixed contract versions')
  }
  if (
    typeof manifest?.minimum_tenant_integration_version !== 'string' ||
    !manifest.minimum_tenant_integration_version.trim()
  ) {
    throw new Error('OpenAPI release manifest is missing minimum_tenant_integration_version')
  }
  for (const key of ['website', 'customer_portal']) {
    const specification = manifest?.specifications?.[key]
    if (
      typeof specification?.url !== 'string' ||
      !specification.url.startsWith(`${BASE_URL}/`) ||
      !/^[a-f0-9]{64}$/.test(specification?.sha256 ?? '')
    ) {
      throw new Error(`OpenAPI release manifest contains an invalid ${key} specification`)
    }
  }
  return manifest
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
