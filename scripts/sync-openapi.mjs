import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

const CONTRACT_VERSION = '2026-07-25.1'
const BASE_URL = 'https://app.gridex.se/api/v1/openapi'
const specs = [
  'website-integration-v1.json',
  'customer-portal-v1.json',
]

function validateSpec(spec, specName) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    throw new Error(`${specName} did not return an OpenAPI object`)
  }
  if (spec.info?.version !== CONTRACT_VERSION) {
    throw new Error(`${specName} contract version mismatch: expected ${CONTRACT_VERSION}, received ${spec.info?.version ?? 'missing'}`)
  }
  if (typeof spec.openapi !== 'string' || !spec.openapi.startsWith('3.')) {
    throw new Error(`${specName} is not an OpenAPI 3 document`)
  }
  if (!spec.paths || typeof spec.paths !== 'object' || Object.keys(spec.paths).length === 0) {
    throw new Error(`${specName} contains no API paths`)
  }
}

const outputDirectory = path.join('docs', 'openapi')
await mkdir(outputDirectory, { recursive: true })

for (const specName of specs) {
  const url = `${BASE_URL}/${specName}`
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  })
  if (!response.ok) throw new Error(`OpenAPI fetch failed for ${specName}: ${response.status}`)
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('json')) {
    throw new Error(`${specName} returned unexpected content type: ${contentType || 'missing'}`)
  }

  const spec = await response.json()
  validateSpec(spec, specName)

  const target = path.join(outputDirectory, specName)
  const temporary = `${target}.${process.pid}.tmp`
  try {
    await writeFile(temporary, `${JSON.stringify(spec, null, 2)}\n`, { flag: 'wx' })
    await rename(temporary, target)
  } catch (error) {
    await rm(temporary, { force: true })
    throw error
  }
  console.log(`Synced ${specName} (${CONTRACT_VERSION})`)
}
