import 'server-only'
import { randomUUID, sign } from 'node:crypto'
import { requireStaffSubject, validateStaffApiConfig, type StaffApiConfig } from './config'
import { StaffApiError } from './errors'

/** The caller supplies the UUID from verified OPS Auth, never from a browser field. */
export function signStaffAssertion(config: StaffApiConfig, subject: string, now = new Date()): string {
  requireStaffSubject(subject)
  const validated = validateStaffApiConfig(config)
  const issuedAt = Math.floor(now.getTime() / 1000)
  if (!Number.isSafeInteger(issuedAt)) throw new StaffApiError(503, 'staff_api_not_configured')
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: validated.keyId })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ iss: validated.issuer, aud: validated.audience, sub: subject,
    company_id: validated.companyId, iat: issuedAt, exp: issuedAt + 60, jti: randomUUID() })).toString('base64url')
  const input = `${header}.${payload}`
  return `${input}.${sign('RSA-SHA256', Buffer.from(input), validated.privateKey).toString('base64url')}`
}
