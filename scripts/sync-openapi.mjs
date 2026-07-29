import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { assertOpenApiDocument, canonical, fetchJsonSpec, sha, SPECS } from './openapi-common.mjs'

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
const downloaded = []
for (const [specName] of SPECS) {
  const spec = await fetchJsonSpec(specName)
  const version = assertOpenApiDocument(spec, specName, 'live', contractVersion)
  contractVersion ??= version
  let previous = null
  try {
    previous = JSON.parse(await readFile(path.join(outputDirectory, specName), 'utf8'))
  } catch {
    previous = null
  }
  downloaded.push({ specName, spec, version, previous })
}

const contractPath = path.join('lib', 'ops', 'contract.ts')
const verificationPath = path.join(outputDirectory, 'verification-status.json')
const diffPath = path.join(outputDirectory, 'last-sync-diff.json')
const managedFiles = [
  ...SPECS.map(([specName]) => path.join(outputDirectory, specName)),
  ...SPECS.map(([, typeName]) => path.join('lib', 'ops', 'generated', typeName)),
  contractPath,
  path.join(outputDirectory, 'manifest.json'),
  verificationPath,
  diffPath,
]
const backups = new Map()
for (const file of managedFiles) backups.set(file, await maybeRead(file))

const temporaryFiles = []
try {
  // Stage both live specifications before replacing either checked-in file.
  for (const { specName, spec } of downloaded) {
    const target = path.join(outputDirectory, specName)
    const temporary = `${target}.${process.pid}.tmp`
    await writeFile(temporary, `${JSON.stringify(spec, null, 2)}\n`, { flag: 'wx' })
    temporaryFiles.push({ target, temporary })
  }
  for (const { target, temporary } of temporaryFiles) await rename(temporary, target)

  const contractSource = await readFile(contractPath, 'utf8')
  const nextContractSource = contractSource.replace(
    /export const GRIDEX_API_CONTRACT_VERSION = ['"][^'"]+['"] as const/,
    `export const GRIDEX_API_CONTRACT_VERSION = '${contractVersion}' as const`,
  )
  if (nextContractSource === contractSource && !contractSource.includes(`'${contractVersion}'`)) {
    throw new Error('Could not update GRIDEX_API_CONTRACT_VERSION in lib/ops/contract.ts')
  }
  await writeFile(contractPath, nextContractSource)

  const report = {
    synced_at: new Date().toISOString(),
    contract_version: contractVersion,
    specifications: Object.fromEntries(downloaded.map(({ specName, spec, previous }) => [
      specName,
      {
        sha256: sha(canonical(spec)),
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
    specifications: Object.fromEntries(downloaded.map(({ specName, spec }) => [
      specName,
      { sha256: sha(canonical(spec)) },
    ])),
  }, null, 2)}\n`)
  console.log(`Live OpenAPI sync verified (${contractVersion}).`)
} catch (error) {
  await Promise.all(temporaryFiles.map(({ temporary }) => rm(temporary, { force: true })))
  await restoreFiles(backups)
  throw error
}
