import { readFile } from 'node:fs/promises'
import { assertOpenApiDocument, canonical, fetchJsonSpec, sha, SPECS } from './openapi-common.mjs'

const localOnly = process.argv.includes('--local-only')
const manifest = JSON.parse(await readFile('docs/openapi/manifest.json', 'utf8'))

function semanticDiff(previous, next) {
  const keys = (value) => new Set(Object.keys(value ?? {}))
  const changed = (before, after) => {
    const all = new Set([...keys(before), ...keys(after)])
    return [...all].filter((key) => JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key]))
  }
  const paths = changed(previous.paths, next.paths)
  const schemas = changed(previous.components?.schemas, next.components?.schemas)
  return {
    changed_paths: paths.slice(0, 30),
    changed_schemas: schemas.slice(0, 30),
    truncated: paths.length > 30 || schemas.length > 30,
  }
}

let sharedVersion = null
for (const [specName, typeName] of SPECS) {
  const localSpec = JSON.parse(await readFile(`docs/openapi/${specName}`, 'utf8'))
  const version = assertOpenApiDocument(localSpec, specName, 'local', sharedVersion)
  sharedVersion ??= version
  const localCanonical = canonical(localSpec)
  const localHash = sha(localCanonical)
  if (
    manifest.contract_version !== version ||
    manifest.specifications?.[specName]?.sha256 !== localHash
  ) {
    throw new Error(
      `${specName} is not approved by docs/openapi/manifest.json: ` +
      `approved=${manifest.contract_version}/${manifest.specifications?.[specName]?.sha256 ?? 'missing'} ` +
      `local=${version}/${localHash}`,
    )
  }
  const generated = await readFile(`lib/ops/generated/${typeName}`, 'utf8')
  if (!generated.includes(`Contract version: ${version}.`) || !generated.includes(`Source SHA-256: ${localHash}.`)) {
    throw new Error(`${typeName} was not generated from the checked-in ${specName}; run npm run api:generate`)
  }
  if (!localOnly) {
    const liveSpec = await fetchJsonSpec(specName)
    const liveVersion = assertOpenApiDocument(liveSpec, specName, 'live')
    if (canonical(liveSpec) !== localCanonical) {
      throw new Error(
        `${specName} drift detected: old_version=${version} new_version=${liveVersion} ` +
        `old_hash=${localHash} new_hash=${sha(canonical(liveSpec))} ` +
        `semantic_diff=${JSON.stringify(semanticDiff(localSpec, liveSpec))}`,
      )
    }
  }
  console.log(`${specName}: ${localOnly ? 'local snapshot/types consistent' : 'no live drift'} (${version})`)
}
