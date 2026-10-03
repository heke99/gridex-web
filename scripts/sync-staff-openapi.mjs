import { mkdir, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { STAFF_MANIFEST, STAFF_SPEC, fetchStaffRelease } from './staff-openapi-common.mjs'

const release = await fetchStaffRelease()
await mkdir('lib/staff/generated', { recursive: true })
await writeFile(`docs/openapi/${STAFF_SPEC}`, release.raw)
await writeFile(`docs/openapi/${STAFF_MANIFEST}`, release.manifestRaw)
const generation = spawnSync(process.execPath, ['scripts/generate-openapi-types.mjs', '--staff-only'], { stdio: 'inherit' })
if (generation.status !== 0) throw new Error('Independent staff type generation failed')
