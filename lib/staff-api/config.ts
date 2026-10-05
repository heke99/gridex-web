import 'server-only'
import { createPrivateKey } from 'node:crypto'
import { StaffApiError } from './errors'

export const STAFF_API_BASE_URL = 'https://app.gridex.se/api/v1/staff' as const
export const STAFF_SUBJECT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export type StaffApiConfig = { apiKey: string; companyId: string; opsProjectRef: string; issuer: string; audience: string; keyId: string; privateKey: string; timeoutMs: number }

export function validateStaffApiConfig(config: StaffApiConfig): StaffApiConfig {
  const invalid = () => { throw new StaffApiError(503, 'staff_api_not_configured') }
  if (!config || typeof config.apiKey !== 'string' || !/^[^\s]{20,512}$/.test(config.apiKey)
    || !STAFF_SUBJECT_UUID.test(config.companyId ?? '')
    || typeof config.opsProjectRef !== 'string' || !/^[a-z]{20}$/.test(config.opsProjectRef)
    || typeof config.issuer !== 'string' || !config.issuer.trim() || config.issuer.length > 512 || /[\u0000-\u001f\u007f]/.test(config.issuer)
    || typeof config.audience !== 'string' || !config.audience.trim() || config.audience.length > 512 || /[\u0000-\u001f\u007f]/.test(config.audience)
    || typeof config.keyId !== 'string' || !/^[A-Za-z0-9_.-]{1,128}$/.test(config.keyId)
    || !Number.isInteger(config.timeoutMs) || config.timeoutMs < 1 || config.timeoutMs > 30_000) invalid()
  try {
    const key = createPrivateKey(config.privateKey)
    if (key.asymmetricKeyType !== 'rsa' || (key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048) invalid()
  } catch { invalid() }
  return { ...config }
}

/** Read server settings only. Website credentials never activate staff access. */
export function readStaffApiConfig(environment: NodeJS.ProcessEnv = process.env): StaffApiConfig {
  const value = (name: string) => environment[name]?.trim() ?? ''
  return validateStaffApiConfig({
    apiKey: value('GRIDEX_STAFF_API_KEY'), companyId: value('GRIDEX_STAFF_COMPANY_ID'),
    opsProjectRef: value('GRIDEX_STAFF_API_PROJECT_REF'),
    issuer: value('GRIDEX_STAFF_ASSERTION_ISSUER'), audience: value('GRIDEX_STAFF_ASSERTION_AUDIENCE'),
    keyId: value('GRIDEX_STAFF_ASSERTION_KID'), privateKey: value('GRIDEX_STAFF_ASSERTION_PRIVATE_KEY').replace(/\\n/g, '\n'),
    timeoutMs: Number(value('GRIDEX_STAFF_TIMEOUT_MS') || '12000'),
  })
}

export function requireStaffSubject(subject: string): void {
  if (typeof subject !== 'string' || !STAFF_SUBJECT_UUID.test(subject)) throw new StaffApiError(401, 'staff_session_required')
}
