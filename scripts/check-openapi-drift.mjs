import { readFile } from 'node:fs/promises'
import {
  assertOpenApiDocument,
  fetchManifestSpecification,
  fetchReleaseManifest,
  sha,
  SPECS,
} from './openapi-common.mjs'

const localOnly = process.argv.includes('--local-only')
const manifest = JSON.parse(await readFile('docs/openapi/manifest.json', 'utf8'))

const contractSource = await readFile('lib/ops/contract.ts', 'utf8')
const contractMatch = contractSource.match(/GRIDEX_API_CONTRACT_VERSION = ['"]([^'"]+)['"]/)
if (!contractMatch) throw new Error('GRIDEX_API_CONTRACT_VERSION is missing from lib/ops/contract.ts')
const sourceContractVersion = contractMatch[1]

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
const liveManifest = localOnly ? null : await fetchReleaseManifest()
for (const [specName, typeName] of SPECS) {
  const localRaw = await readFile(`docs/openapi/${specName}`, 'utf8')
  const localSpec = JSON.parse(localRaw)
  const version = assertOpenApiDocument(localSpec, specName, 'local', sharedVersion)
  sharedVersion ??= version
  if (sourceContractVersion !== version) {
    throw new Error(`${specName} contract version ${version} does not match lib/ops/contract.ts ${sourceContractVersion}`)
  }
  const localHash = sha(localRaw)
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
    const manifestKey = specName.startsWith('website')
      ? 'website'
      : 'customer_portal'
    const live = await fetchManifestSpecification(
      liveManifest.specifications[manifestKey],
    )
    const liveSpec = live.document
    const liveVersion = assertOpenApiDocument(liveSpec, specName, 'live')
    if (
      liveVersion !== liveManifest.release_version ||
      liveManifest.release_version !== sourceContractVersion
    ) {
      throw new Error(
        `${specName} release mismatch: local=${sourceContractVersion} manifest=${liveManifest.release_version} live=${liveVersion}`,
      )
    }
    if (live.rawText !== localRaw) {
      throw new Error(
        `${specName} drift detected: old_version=${version} new_version=${liveVersion} ` +
        `old_hash=${localHash} new_hash=${live.sha256} ` +
        `semantic_diff=${JSON.stringify(semanticDiff(localSpec, liveSpec))}`,
      )
    }
  }
  console.log(`${specName}: ${localOnly ? 'local snapshot/types consistent' : 'no live drift'} (${version})`)
}
