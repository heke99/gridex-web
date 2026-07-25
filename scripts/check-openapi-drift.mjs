import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

const CONTRACT_VERSION = '2026-07-25.1'
const BASE_URL = 'https://app.gridex.se/api/v1/openapi'
const specs = [
  ['website-integration-v1.json', 'website-api.d.ts'],
  ['customer-portal-v1.json', 'customer-portal-api.d.ts'],
]

function canonical(value) {
  return `${JSON.stringify(value)}\n`
}

function sha(value) {
  return createHash('sha256').update(value).digest('hex')
}

function assertOpenApiDocument(spec, specName, source) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    throw new Error(`${specName} ${source} document is not an object`)
  }
  if (spec.info?.version !== CONTRACT_VERSION) {
    throw new Error(`${specName} ${source} contract version mismatch: ${spec.info?.version ?? 'missing'}`)
  }
  if (typeof spec.openapi !== 'string' || !spec.openapi.startsWith('3.')) {
    throw new Error(`${specName} ${source} document is not OpenAPI 3`)
  }
  if (!spec.paths || typeof spec.paths !== 'object' || Object.keys(spec.paths).length === 0) {
    throw new Error(`${specName} ${source} document contains no paths`)
  }
}

for (const [specName, typeName] of specs) {
  const localSpec = JSON.parse(await readFile(`docs/openapi/${specName}`, 'utf8'))
  assertOpenApiDocument(localSpec, specName, 'local')

  const localHash = sha(canonical(localSpec))
  const generated = await readFile(`lib/ops/generated/${typeName}`, 'utf8')
  if (!generated.includes(`Contract version: ${CONTRACT_VERSION}.`) || !generated.includes(`Source SHA-256: ${localHash}.`)) {
    throw new Error(`${typeName} was not generated from the checked-in ${specName}; run npm run api:generate`)
  }

  const response = await fetch(`${BASE_URL}/${specName}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  })
  if (!response.ok) throw new Error(`OpenAPI fetch failed for ${specName}: ${response.status}`)
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('json')) {
    throw new Error(`${specName} returned unexpected content type: ${contentType || 'missing'}`)
  }

  const liveSpec = await response.json()
  assertOpenApiDocument(liveSpec, specName, 'live')
  if (canonical(liveSpec) !== canonical(localSpec)) {
    throw new Error(`${specName} drift detected: local=${localHash} live=${sha(canonical(liveSpec))}`)
  }
  console.log(`${specName}: no drift (${CONTRACT_VERSION})`)
}
