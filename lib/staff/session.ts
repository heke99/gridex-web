import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { staffCookieKey } from './config'
import type { components } from './generated/staff-api'

export const STAFF_COOKIE_NAME = '__Host-gridex_staff_session'
const AAD = Buffer.from('gridex-web-staff:v1:support123.gridex.se')
const MAX_COOKIE_BYTES = 4096
const MAX_SESSION_SECONDS = 8 * 60 * 60

export type StaffSessionReceipt = components['schemas']['StaffSessionReceipt']

export type StaffCookieSession = {
  kind: 'anonymous'
  csrf: string
  createdAt: number
  expiresAt: number
} | {
  kind: 'staff'
  csrf: string
  createdAt: number
  receipt: StaffSessionReceipt
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}
function boundedText(value: unknown, maximum: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maximum && !/[\u0000-\u001f\u007f]/.test(value)
}

/** Project only documented token receipt fields into the encrypted server cookie. */
export function staffReceipt(value: unknown): StaffSessionReceipt | null {
  const row = record(value)
  if (!row || !['authenticated', 'mfa_required', 'password_change_required'].includes(String(row.status)) ||
    row.token_type !== 'Bearer' || row.expires_in !== 300 ||
    !boundedText(row.staff_access_token, 2048) || !boundedText(row.refresh_token, 512) ||
    !boundedText(row.session_reference, 128) || !boundedText(row.staff_reference, 128) || !boundedText(row.organization_reference, 128) ||
    !boundedText(row.expires_at, 40) || !boundedText(row.refresh_expires_at, 40) ||
    !Number.isFinite(Date.parse(row.expires_at)) || !Number.isFinite(Date.parse(row.refresh_expires_at)) ||
    Date.parse(row.refresh_expires_at) < Date.parse(row.expires_at) ||
    !Array.isArray(row.factors) || row.factors.length > 8) return null
  const factors: StaffSessionReceipt['factors'] = []
  for (const item of row.factors) {
    const factor = record(item)
    if (!factor || factor.method !== 'totp' || !boundedText(factor.factor_reference, 128) ||
      !(factor.friendly_name === null || boundedText(factor.friendly_name, 120))) return null
    factors.push({ factor_reference: factor.factor_reference, method: 'totp', friendly_name: factor.friendly_name })
  }
  return {
    status: row.status as StaffSessionReceipt['status'], staff_access_token: row.staff_access_token,
    refresh_token: row.refresh_token, token_type: 'Bearer', expires_in: 300,
    expires_at: row.expires_at, refresh_expires_at: row.refresh_expires_at,
    session_reference: row.session_reference, staff_reference: row.staff_reference,
    organization_reference: row.organization_reference, factors,
  }
}

export function anonymousStaffSession(now = Date.now()): StaffCookieSession {
  return { kind: 'anonymous', csrf: randomBytes(32).toString('base64url'), createdAt: now, expiresAt: now + 15 * 60 * 1000 }
}

export function authenticatedStaffSession(receipt: StaffSessionReceipt, previous?: StaffCookieSession): StaffCookieSession {
  return { kind: 'staff', csrf: previous?.kind === 'staff' ? previous.csrf : randomBytes(32).toString('base64url'),
    createdAt: previous?.kind === 'staff' ? previous.createdAt : Date.now(), receipt }
}

export function staffSessionExpiry(session: StaffCookieSession): number {
  return session.kind === 'anonymous' ? session.expiresAt : Math.min(
    Date.parse(session.receipt.refresh_expires_at), session.createdAt + MAX_SESSION_SECONDS * 1000,
  )
}

export function sealStaffSession(session: StaffCookieSession): string {
  const plaintext = Buffer.from(JSON.stringify(session))
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', staffCookieKey(), iv)
  cipher.setAAD(AAD)
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const value = `v1.${Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64url')}`
  if (value.length + STAFF_COOKIE_NAME.length > MAX_COOKIE_BYTES) throw new Error('Staff session cannot fit its protected cookie')
  return value
}

export function openStaffSession(value: string | undefined, now = Date.now()): StaffCookieSession | null {
  if (!value || value.length > MAX_COOKIE_BYTES || !/^v1\.[A-Za-z0-9_-]+$/.test(value)) return null
  try {
    const encrypted = Buffer.from(value.slice(3), 'base64url')
    if (encrypted.length < 29) return null
    const decipher = createDecipheriv('aes-256-gcm', staffCookieKey(), encrypted.subarray(0, 12))
    decipher.setAAD(AAD)
    decipher.setAuthTag(encrypted.subarray(12, 28))
    const row = record(JSON.parse(Buffer.concat([decipher.update(encrypted.subarray(28)), decipher.final()]).toString('utf8')))
    if (!row || typeof row.createdAt !== 'number' || !Number.isSafeInteger(row.createdAt) || row.createdAt > now ||
      typeof row.csrf !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(row.csrf)) return null
    let session: StaffCookieSession
    if (row.kind === 'anonymous' && typeof row.expiresAt === 'number' && Number.isSafeInteger(row.expiresAt) &&
      row.expiresAt <= row.createdAt + 15 * 60 * 1000) {
      session = { kind: 'anonymous', csrf: row.csrf, createdAt: row.createdAt, expiresAt: row.expiresAt }
    } else if (row.kind === 'staff') {
      const receipt = staffReceipt(row.receipt)
      if (!receipt) return null
      session = { kind: 'staff', csrf: row.csrf, createdAt: row.createdAt, receipt }
    } else return null
    return staffSessionExpiry(session) > now ? session : null
  } catch { return null }
}

export function readStaffCookie(request: Request): StaffCookieSession | null {
  const values = (request.headers.get('cookie') ?? '').split(';').map((value) => value.trim())
    .filter((value) => value.startsWith(`${STAFF_COOKIE_NAME}=`))
  if (values.length !== 1) return null
  return openStaffSession(values[0]?.slice(STAFF_COOKIE_NAME.length + 1))
}

export function staffCookieOptions(session: StaffCookieSession) {
  return { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/',
    maxAge: Math.max(0, Math.floor((staffSessionExpiry(session) - Date.now()) / 1000)) }
}

export function sameStaffCsrf(left: string | null, right: string): boolean {
  return typeof left === 'string' && /^[A-Za-z0-9_-]{43}$/.test(left) && left.length === right.length &&
    timingSafeEqual(Buffer.from(left), Buffer.from(right))
}

/** The original rotating proof deterministically names one refresh operation. */
export function staffRefreshOperationKey(session: Extract<StaffCookieSession, { kind: 'staff' }>): string {
  return `staff_refresh:${createHmac('sha256', staffCookieKey()).update(
    `${session.receipt.session_reference}\n${session.receipt.refresh_token}`,
  ).digest('base64url')}`
}
