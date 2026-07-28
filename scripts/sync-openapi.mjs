import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { assertOpenApiDocument, fetchJsonSpec, SPECS } from './openapi-common.mjs'

const outputDirectory = path.join('docs', 'openapi')
await mkdir(outputDirectory, { recursive: true })

// Fetch and validate the complete contract set before touching checked-in files.
// This prevents a failed second download or version mismatch from leaving the
// repository with only one specification updated.
let contractVersion = null
const downloaded = []
for (const [specName] of SPECS) {
  const spec = await fetchJsonSpec(specName)
  const version = assertOpenApiDocument(spec, specName, 'live', contractVersion)
  contractVersion ??= version
  downloaded.push({ specName, spec, version })
}

const temporaryFiles = []
try {
  for (const { specName, spec } of downloaded) {
    const target = path.join(outputDirectory, specName)
    const temporary = `${target}.${process.pid}.tmp`
    await writeFile(temporary, `${JSON.stringify(spec, null, 2)}\n`, { flag: 'wx' })
    temporaryFiles.push({ target, temporary })
  }

  for (const { target, temporary } of temporaryFiles) {
    await rename(temporary, target)
  }
} catch (error) {
  await Promise.all(temporaryFiles.map(({ temporary }) => rm(temporary, { force: true })))
  throw error
}

for (const { specName, version } of downloaded) {
  console.log(`Synced ${specName} (${version})`)
}

const generated = spawnSync(process.execPath, ['scripts/generate-openapi-types.mjs'], { stdio: 'inherit' })
if (generated.status !== 0) process.exit(generated.status ?? 1)
const manifested = spawnSync(process.execPath, ['scripts/write-openapi-manifest.mjs'], { stdio: 'inherit' })
if (manifested.status !== 0) process.exit(manifested.status ?? 1)
const checked = spawnSync(process.execPath, ['scripts/check-openapi-drift.mjs', '--local-only'], { stdio: 'inherit' })
if (checked.status !== 0) process.exit(checked.status ?? 1)
