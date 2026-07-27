import { createHash } from 'node:crypto'

export const BASE_URL = 'https://app.gridex.se/api/v1/openapi'
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
