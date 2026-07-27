import { readFile } from 'node:fs/promises'
import { assertOpenApiDocument, canonical, fetchJsonSpec, sha, SPECS } from './openapi-common.mjs'

const localOnly = process.argv.includes('--local-only')
let sharedVersion = null
for (const [specName, typeName] of SPECS) {
  const localSpec = JSON.parse(await readFile(`docs/openapi/${specName}`, 'utf8'))
  const version = assertOpenApiDocument(localSpec, specName, 'local', sharedVersion)
  sharedVersion ??= version
  const localCanonical = canonical(localSpec)
  const localHash = sha(localCanonical)
  const generated = await readFile(`lib/ops/generated/${typeName}`, 'utf8')
  if (!generated.includes(`Contract version: ${version}.`) || !generated.includes(`Source SHA-256: ${localHash}.`)) {
    throw new Error(`${typeName} was not generated from the checked-in ${specName}; run npm run api:generate`)
  }
  if (!localOnly) {
    const liveSpec = await fetchJsonSpec(specName)
    assertOpenApiDocument(liveSpec, specName, 'live', version)
    if (canonical(liveSpec) !== localCanonical) {
      throw new Error(`${specName} drift detected: local=${localHash} live=${sha(canonical(liveSpec))}`)
    }
  }
  console.log(`${specName}: ${localOnly ? 'local snapshot/types consistent' : 'no live drift'} (${version})`)
}
