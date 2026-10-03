import { readFile } from 'node:fs/promises'
import { STAFF_MANIFEST, STAFF_SPEC, STAFF_VERSION, fetchStaffRelease, staffOrigin, staffSha, validateStaffManifest, validateStaffSpec } from './staff-openapi-common.mjs'

const localOnly = process.argv.includes('--local-only')
const raw = await readFile(`docs/openapi/${STAFF_SPEC}`, 'utf8')
const manifest = JSON.parse(await readFile(`docs/openapi/${STAFF_MANIFEST}`, 'utf8'))
// A draft can be built and reviewed locally; runtime/live gates require every
// protocol capability, an actual build commit and both immutable raw hashes.
validateStaffManifest(manifest, 'https://app.gridex.se', false)
validateStaffSpec(raw, manifest)
const source = await readFile('lib/staff/config.ts', 'utf8')
if (!source.includes(`STAFF_CONTRACT_VERSION = '${STAFF_VERSION}'`)) throw new Error('Staff source version is stale')
const generated = await readFile('lib/staff/generated/staff-api.d.ts', 'utf8')
if (!generated.includes(`Contract version: ${STAFF_VERSION}.`) || !generated.includes(`Source SHA-256: ${staffSha(raw)}.`)) throw new Error('Staff generated types are stale')
if (!localOnly) {
  const live = await fetchStaffRelease()
  if (live.raw !== raw || live.manifest.specification.sha256 !== manifest.specification.sha256) throw new Error(`Staff live drift at ${staffOrigin()}`)
}
console.log(`Staff ${STAFF_VERSION}: ${localOnly ? 'local snapshot/types consistent' : 'qualified live mutable/immutable release matches'} (${staffSha(raw)})${manifest.capabilities.length ? '' : '; local draft remains runtime-disabled until qualified live metadata'}`)
