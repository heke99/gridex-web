import { OpsError } from '@/lib/ops/errors'

export const STAFF_CONTRACT_VERSION = '2026-10-03.1'
export const STAFF_PROTOCOL_CAPABILITIES = [
  'staff.sessions', 'staff.context', 'staff.customers.read',
  'staff.support.read', 'staff.support.write', 'staff.support.attachments',
] as const

export function staffUnavailable(): never {
  throw new OpsError('Personalportalen är inte tillgänglig just nu.', 503, {
    code: 'staff_not_configured', retryable: false,
  })
}

export function staffCookieKey(): Buffer {
  const value = process.env.GRIDEX_STAFF_SESSION_COOKIE_SECRET?.trim() ?? ''
  if (!/^[A-Za-z0-9+/]{43}=$/.test(value)) staffUnavailable()
  const key = Buffer.from(value, 'base64')
  if (key.length !== 32 || key.toString('base64') !== value) staffUnavailable()
  return key
}

/** Independent staff configuration never inherits a customer API credential. */
export function staffApiConfig(): { base: URL; apiKey: string } {
  const configured = process.env.GRIDEX_STAFF_OPS_API_URL?.trim()
  const apiKey = process.env.GRIDEX_STAFF_API_KEY?.trim() ?? ''
  if (!configured || !/^[^\s\u0000-\u001f\u007f]{16,512}$/.test(apiKey)) staffUnavailable()
  let base: URL
  try { base = new URL(configured) } catch { staffUnavailable() }
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash ||
    base.pathname.replace(/\/$/, '') !== '/api/v1') staffUnavailable()
  base.pathname = '/api/v1'
  staffCookieKey()
  return { base, apiKey }
}
