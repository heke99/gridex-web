import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import {
  assertOpenApiDocument,
  fetchManifestSpecification,
  fetchReleaseManifest,
  SPECS,
} from './openapi-common.mjs'

const outputDirectory = path.join('docs', 'openapi')
await mkdir(outputDirectory, { recursive: true })

function changedKeys(before, after) {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])
  return [...keys].filter((key) => JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key]))
}

function semanticDiff(previous, next) {
  const previousPaths = previous?.paths ?? {}
  const nextPaths = next?.paths ?? {}
  const previousSchemas = previous?.components?.schemas ?? {}
  const nextSchemas = next?.components?.schemas ?? {}
  return {
    previous_version: previous?.info?.version ?? null,
    next_version: next?.info?.version ?? null,
    added_paths: Object.keys(nextPaths).filter((key) => !Object.hasOwn(previousPaths, key)),
    removed_paths: Object.keys(previousPaths).filter((key) => !Object.hasOwn(nextPaths, key)),
    changed_paths: changedKeys(previousPaths, nextPaths),
    added_schemas: Object.keys(nextSchemas).filter((key) => !Object.hasOwn(previousSchemas, key)),
    removed_schemas: Object.keys(previousSchemas).filter((key) => !Object.hasOwn(nextSchemas, key)),
    changed_schemas: changedKeys(previousSchemas, nextSchemas),
  }
}

async function maybeRead(file) {
  try {
    return { exists: true, content: await readFile(file) }
  } catch (error) {
    if (error?.code === 'ENOENT') return { exists: false, content: null }
    throw error
  }
}

async function restoreFiles(backups) {
  for (const [file, backup] of backups.entries()) {
    if (backup.exists) await writeFile(file, backup.content)
    else await rm(file, { force: true })
  }
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with status ${result.status ?? 'unknown'}`)
  }
}

let contractVersion = null
const releaseManifest = await fetchReleaseManifest()
const downloaded = []
for (const [specName] of SPECS) {
  const manifestKey = specName.startsWith('website')
    ? 'website'
    : 'customer_portal'
  const specification = releaseManifest.specifications[manifestKey]
  const downloadedSpec = await fetchManifestSpecification(specification)
  const spec = downloadedSpec.document
  const version = assertOpenApiDocument(spec, specName, 'live', contractVersion)
  if (version !== releaseManifest.release_version) {
    throw new Error(
      `${specName} version ${version} does not match release manifest ${releaseManifest.release_version}`,
    )
  }
  contractVersion ??= version
  let previous = null
  try {
    previous = JSON.parse(await readFile(path.join(outputDirectory, specName), 'utf8'))
  } catch {
    previous = null
  }
  downloaded.push({
    specName,
    spec,
    rawText: downloadedSpec.rawText,
    sha256: downloadedSpec.sha256,
    version,
    previous,
  })
}

const contractPath = path.join('lib', 'ops', 'contract.ts')
const verificationPath = path.join(outputDirectory, 'verification-status.json')
const diffPath = path.join(outputDirectory, 'last-sync-diff.json')
const managedFiles = [
  ...SPECS.map(([specName]) => path.join(outputDirectory, specName)),
  ...SPECS.map(([, typeName]) => path.join('lib', 'ops', 'generated', typeName)),
  contractPath,
  path.join(outputDirectory, 'manifest.json'),
  path.join(outputDirectory, 'release-manifest.json'),
  verificationPath,
  diffPath,
]
const backups = new Map()
for (const file of managedFiles) backups.set(file, await maybeRead(file))

const temporaryFiles = []
try {
  // Stage both live specifications before replacing either checked-in file.
  for (const { specName, rawText } of downloaded) {
    const target = path.join(outputDirectory, specName)
    const temporary = `${target}.${process.pid}.tmp`
    await writeFile(temporary, rawText, { flag: 'wx' })
    temporaryFiles.push({ target, temporary })
  }
  for (const { target, temporary } of temporaryFiles) await rename(temporary, target)
  await writeFile(
    path.join(outputDirectory, 'release-manifest.json'),
    `${JSON.stringify(releaseManifest, null, 2)}\n`,
  )

  const contractSource = await readFile(contractPath, 'utf8')
  const websiteSpecification = downloaded.find(({ specName }) => specName === 'website-integration-v1.json')
  const portalSpecification = downloaded.find(({ specName }) => specName === 'customer-portal-v1.json')
  if (!websiteSpecification || !portalSpecification) {
    throw new Error('Both canonical OpenAPI specifications are required before updating contract constants')
  }

  const replaceContractConstant = (source, name, value) => {
    const pattern = new RegExp(`export const ${name} = ['"][^'"]+['"] as const`)
    if (!pattern.test(source)) throw new Error(`Could not locate ${name} in lib/ops/contract.ts`)
    return source.replace(pattern, `export const ${name} = '${value}' as const`)
  }

  let nextContractSource = replaceContractConstant(
    contractSource,
    'GRIDEX_API_CONTRACT_VERSION',
    contractVersion,
  )
  nextContractSource = replaceContractConstant(
    nextContractSource,
    'GRIDEX_MINIMUM_TENANT_INTEGRATION_VERSION',
    releaseManifest.minimum_tenant_integration_version,
  )
  nextContractSource = replaceContractConstant(
    nextContractSource,
    'GRIDEX_WEBSITE_OPENAPI_SHA256',
    websiteSpecification.sha256,
  )
  nextContractSource = replaceContractConstant(
    nextContractSource,
    'GRIDEX_CUSTOMER_PORTAL_OPENAPI_SHA256',
    portalSpecification.sha256,
  )
  await writeFile(contractPath, nextContractSource)

  const report = {
    synced_at: new Date().toISOString(),
    contract_version: contractVersion,
    release_manifest: releaseManifest,
    specifications: Object.fromEntries(downloaded.map(({ specName, sha256, previous, spec }) => [
      specName,
      {
        sha256,
        semantic_diff: semanticDiff(previous, spec),
      },
    ])),
  }
  await writeFile(diffPath, `${JSON.stringify(report, null, 2)}\n`)
  await writeFile(verificationPath, `${JSON.stringify({
    live_sync_verified: false,
    verified_at: null,
    contract_version: contractVersion,
    reason: 'Live files were downloaded, but generated artifacts and local consistency checks have not completed yet.',
  }, null, 2)}\n`)

  for (const { specName, version } of downloaded) console.log(`Synced ${specName} (${version})`)
  run(process.execPath, ['scripts/generate-openapi-types.mjs'])
  run(process.execPath, ['scripts/write-openapi-manifest.mjs'])
  run(process.execPath, ['scripts/check-openapi-drift.mjs', '--local-only'])
  run(process.execPath, ['scripts/check-api-compatibility.mjs', '--allow-upstream-gaps'])

  await writeFile(verificationPath, `${JSON.stringify({
    live_sync_verified: true,
    verified_at: report.synced_at,
    contract_version: contractVersion,
    specifications: Object.fromEntries(downloaded.map(({ specName, sha256 }) => [
      specName,
      { sha256 },
    ])),
  }, null, 2)}\n`)
  console.log(`Live OpenAPI sync verified (${contractVersion}).`)
} catch (error) {
  await Promise.all(temporaryFiles.map(({ temporary }) => rm(temporary, { force: true })))
  await restoreFiles(backups)
  throw error
}
