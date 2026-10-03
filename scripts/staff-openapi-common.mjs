import { createHash } from 'node:crypto'

export const STAFF_VERSION = '2026-10-03.1'
export const STAFF_CAPABILITIES = ['staff.sessions', 'staff.context', 'staff.customers.read', 'staff.support.read', 'staff.support.write', 'staff.support.attachments']
export const staffSha = raw => createHash('sha256').update(raw).digest('hex')
export const STAFF_SPEC = 'staff-support-v1.json'
export const STAFF_MANIFEST = 'staff-release-manifest.json'
export function staffOrigin() {
  const base = new URL(process.env.GRIDEX_STAFF_OPS_API_URL || 'https://app.gridex.se/api/v1')
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || base.pathname.replace(/\/$/, '') !== '/api/v1') throw new Error('Invalid independent staff API URL')
  return base.origin
}
export function validateStaffManifest(value, origin, qualified = true) {
  if (!value || value.schema_version !== 1 || value.contract_name !== 'staff-support-v1' || value.contract_version !== STAFF_VERSION ||
    value.minimum_staff_integration_version !== STAFF_VERSION || value.guide_version !== STAFF_VERSION ||
    !Number.isFinite(Date.parse(value.released_at)) || !/^[a-f0-9]{64}$/.test(value.specification?.sha256 || '') ||
    value.specification.url !== `${origin}/api/v1/openapi/${STAFF_SPEC}` ||
    value.specification.immutable_url !== `${origin}/api/v1/openapi/${STAFF_VERSION}/${STAFF_SPEC}` ||
    !Array.isArray(value.capabilities) || value.capabilities.some(cap => !STAFF_CAPABILITIES.includes(cap)) ||
    (qualified && (!/^[a-f0-9]{40}$/.test(value.build_commit || '') || !STAFF_CAPABILITIES.every(cap => value.capabilities.includes(cap))))) throw new Error('Independent staff release manifest is unqualified or incompatible')
  return value
}
export function validateStaffSpec(raw, manifest) {
  const spec = JSON.parse(raw)
  const methods = Object.entries(spec.paths || {}).flatMap(([path, item]) => path.startsWith('/api/v1/staff/') ? Object.keys(item).filter(method => ['get', 'post'].includes(method)) : [])
  if (spec.openapi !== '3.1.0' || spec.info?.version !== STAFF_VERSION || methods.length !== 26 || staffSha(raw) !== manifest.specification.sha256) throw new Error('Independent staff specification raw hash/version/operation coverage mismatch')
  return spec
}
export async function fetchStaffPublic(url, maxBytes) {
  const signal = AbortSignal.timeout(15000)
  const response = await fetch(url, { redirect: 'manual', cache: 'no-store', signal, headers: { Accept: 'application/json' } })
  if (!response.ok || response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new Error('Independent staff metadata unavailable')
  if (Number(response.headers.get('content-length')) > maxBytes) throw new Error('Independent staff metadata exceeds bound')
  const reader = response.body.getReader(); const chunks = []; let total = 0
  const aborted = new Promise((_, reject) => signal.addEventListener('abort', () => { void reader.cancel(); reject(signal.reason) }, { once: true }))
  while (true) {
    const { done, value } = await Promise.race([reader.read(), aborted])
    if (signal.aborted) throw signal.reason
    if (done) break
    total += value.byteLength
    if (total > maxBytes) { await reader.cancel(); throw new Error('Independent staff metadata exceeds bound') }
    chunks.push(value)
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))
}
export async function fetchStaffRelease() {
  const origin = staffOrigin()
  const manifestRaw = await fetchStaffPublic(`${origin}/api/v1/openapi/${STAFF_MANIFEST}`, 65536)
  const manifest = validateStaffManifest(JSON.parse(manifestRaw), origin)
  const immutable = await fetchStaffPublic(manifest.specification.immutable_url, 2 * 1024 * 1024)
  validateStaffSpec(immutable, manifest)
  const mutable = await fetchStaffPublic(manifest.specification.url, 2 * 1024 * 1024)
  if (mutable !== immutable) throw new Error('Independent staff mutable/immutable specification mismatch')
  return { manifest, manifestRaw, raw: immutable }
}
