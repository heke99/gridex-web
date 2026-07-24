import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const specs = [
  ['website-integration-v1.json', 'website-api.d.ts'],
  ['customer-portal-v1.json', 'customer-portal-api.d.ts'],
]
const base = 'https://app.gridex.se/api/v1/openapi/'
const temp = await mkdtemp(path.join(tmpdir(), 'gridex-openapi-'))
try {
  for (const [specName, typeName] of specs) {
    const response = await fetch(`${base}${specName}`, { headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error(`OpenAPI fetch failed for ${specName}: ${response.status}`)
    const body = await response.text()
    const live = JSON.parse(body)
    if (live.info?.version !== '2026-07-24.2') throw new Error(`${specName} contract version mismatch: ${live.info?.version}`)
    const specPath = path.join(temp, specName)
    await writeFile(specPath, `${JSON.stringify(live, null, 2)}\n`)
    const generatedPath = path.join(temp, typeName)
    const run = spawnSync('npx', ['--yes', 'openapi-typescript', specPath, '-o', generatedPath], { stdio: 'inherit' })
    if (run.status !== 0) process.exit(run.status ?? 1)
    const [expected, actual] = await Promise.all([
      readFile(path.join('lib/ops/generated', typeName)),
      readFile(generatedPath),
    ])
    if (!expected.equals(actual)) {
      const sha = (value) => createHash('sha256').update(value).digest('hex')
      throw new Error(`${typeName} drift: checked-in=${sha(expected)} live=${sha(actual)}`)
    }
  }
} finally {
  await rm(temp, { recursive: true, force: true })
}
