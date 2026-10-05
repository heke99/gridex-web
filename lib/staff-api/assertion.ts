import 'server-only'
import { randomUUID, sign } from 'node:crypto'
import { requireStaffSubject, validateStaffApiConfig, STAFF_SUBJECT_UUID, type StaffApiConfig } from './config'
import { StaffApiError } from './errors'

export type StaffIdentityBinding = {
  actorUserId: string; bindingId: string; bindingVersion: number;
  localAuthSubject: string; localAuthIssuer: string;
}

function signedAssertion(config: StaffApiConfig, subject: string, now: Date, extra: Record<string, unknown>): string {
  requireStaffSubject(subject)
  const validated = validateStaffApiConfig(config)
  const issuedAt = Math.floor(now.getTime() / 1000)
  if (!Number.isSafeInteger(issuedAt)) throw new StaffApiError(503, 'staff_api_not_configured')
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: validated.keyId })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ iss: validated.issuer, aud: validated.audience, sub: subject,
    company_id: validated.companyId, iat: issuedAt, exp: issuedAt + 60, jti: randomUUID(), ...extra })).toString('base64url')
  const input = `${header}.${payload}`
  return `${input}.${sign('RSA-SHA256', Buffer.from(input), validated.privateKey).toString('base64url')}`
}

/** Normal Staff sub remains the central actor, resolved server-side by OPS. */
export function signStaffAssertion(config: StaffApiConfig, subject: string, now = new Date(), binding?: StaffIdentityBinding): string {
  if (!binding) return signedAssertion(config, subject, now, {})
  if (binding.actorUserId !== subject || !STAFF_SUBJECT_UUID.test(binding.bindingId)
    || !STAFF_SUBJECT_UUID.test(binding.localAuthSubject)
    || !Number.isSafeInteger(binding.bindingVersion) || binding.bindingVersion < 1
    || !/^https:\/\/[a-z]{20}\.supabase\.co\/auth\/v1$/.test(binding.localAuthIssuer)) {
    throw new StaffApiError(401, 'staff_identity_binding_invalid')
  }
  return signedAssertion(config, subject, now, { token_use: 'staff_access',
    staff_binding_id: binding.bindingId, staff_binding_version: binding.bindingVersion,
    local_auth_subject: binding.localAuthSubject, local_auth_issuer: binding.localAuthIssuer })
}

/** A local subject proves identity only; purpose-specific endpoints resolve authority. */
export function signLocalStaffAssertion(config: StaffApiConfig, subject: string,
  tokenUse: 'staff_identity_resolution' | 'staff_invitation_acceptance', now = new Date()): string {
  if (tokenUse !== 'staff_identity_resolution' && tokenUse !== 'staff_invitation_acceptance') {
    throw new StaffApiError(401, 'staff_assertion_purpose_invalid')
  }
  return signedAssertion(config, subject, now, { token_use: tokenUse })
}
