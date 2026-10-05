import 'server-only'
import { randomUUID } from 'node:crypto'
import { signLocalStaffAssertion, type StaffIdentityBinding } from './assertion'
import { readStaffApiConfig, requireStaffSubject, validateStaffApiConfig, STAFF_SUBJECT_UUID, type StaffApiConfig } from './config'
import { StaffApiError } from './errors'

export const STAFF_IDENTITY_RESOLUTION_URL = 'https://app.gridex.se/api/v1/staff-onboarding/identity/resolve' as const
export const STAFF_ONBOARDING_VERSION = '2026-10-05.2' as const
type IdentityDependencies = { config?: StaffApiConfig; fetchImpl?: typeof fetch; now?: () => Date }
const identifier = (value: unknown): string | null => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,128}$/.test(value) ? value : null
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const exactKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))

async function boundedJson(response: Response): Promise<unknown> {
  if (response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') throw new StaffApiError(502, 'staff_api_response_invalid')
  const length = response.headers.get('content-length')
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > 16_384)) throw new StaffApiError(502, 'staff_api_response_invalid')
  if (!response.body) throw new StaffApiError(502, 'staff_api_response_invalid')
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []; let size = 0
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.length
      if (size > 16_384) { await reader.cancel(); throw new StaffApiError(502, 'staff_api_response_invalid') }
      chunks.push(chunk.value)
    }
  } finally { reader.releaseLock() }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) }
  catch { throw new StaffApiError(502, 'staff_api_response_invalid') }
}

/** Resolve a fresh verified tenant identity; no email or UUID-equality fallback. */
export async function resolveStaffIdentity(localAuthSubject: string, accessToken: string, localAuthIssuer: string,
  dependencies: IdentityDependencies = {}): Promise<StaffIdentityBinding> {
  requireStaffSubject(localAuthSubject)
  if (typeof accessToken !== 'string' || !/^[^\s]{20,8192}$/.test(accessToken)
    || !/^https:\/\/[a-z]{20}\.supabase\.co\/auth\/v1$/.test(localAuthIssuer)) throw new StaffApiError(401, 'staff_session_required')
  const config = dependencies.config ? validateStaffApiConfig(dependencies.config) : readStaffApiConfig()
  const headers = new Headers({ Authorization: `Bearer ${config.apiKey}`, Accept: 'application/json', 'Content-Type': 'application/json',
    'x-gridex-expected-project-ref': config.opsProjectRef, 'x-request-id': randomUUID(),
    'x-gridex-support-auth-token': accessToken,
    'x-gridex-staff-assertion': signLocalStaffAssertion(config, localAuthSubject, 'staff_identity_resolution', dependencies.now?.() ?? new Date()) })
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), config.timeoutMs)
  try {
    const response = await (dependencies.fetchImpl ?? fetch)(STAFF_IDENTITY_RESOLUTION_URL, {
      method: 'POST', headers, body: '{}', cache: 'no-store', redirect: 'manual', signal: controller.signal,
    })
    const requestId = identifier(response.headers.get('x-request-id'))
    if (response.status >= 300 && response.status < 400) throw new StaffApiError(502, 'staff_api_redirect_blocked', requestId)
    if (response.ok && response.headers.get('x-gridex-project-ref') !== config.opsProjectRef) throw new StaffApiError(503, 'staff_storage_target_unverified', requestId)
    const payload = await boundedJson(response)
    if (!response.ok) {
      const error = record(payload) && record(payload.error) ? payload.error : {}
      const code = typeof error.code === 'string' && /^[a-z][a-z0-9_]{0,95}$/.test(error.code) ? error.code : 'staff_api_request_failed'
      throw new StaffApiError(response.status, code, requestId, error.retryable === true)
    }
    if (!record(payload) || !exactKeys(payload, ['data', 'request_id', 'contract_schema_version'])
      || payload.contract_schema_version !== STAFF_ONBOARDING_VERSION || !identifier(payload.request_id)
      || !record(payload.data) || !exactKeys(payload.data, ['actor_user_id', 'binding_id', 'binding_version'])
      || typeof payload.data.actor_user_id !== 'string' || !STAFF_SUBJECT_UUID.test(payload.data.actor_user_id)
      || typeof payload.data.binding_id !== 'string' || !STAFF_SUBJECT_UUID.test(payload.data.binding_id)
      || typeof payload.data.binding_version !== 'number' || !Number.isSafeInteger(payload.data.binding_version) || payload.data.binding_version < 1) {
      throw new StaffApiError(502, 'staff_api_response_invalid', requestId)
    }
    return { actorUserId: payload.data.actor_user_id, bindingId: payload.data.binding_id, bindingVersion: payload.data.binding_version,
      localAuthSubject, localAuthIssuer }
  } catch (error) {
    if (error instanceof StaffApiError) throw error
    throw new StaffApiError(controller.signal.aborted ? 504 : 503, controller.signal.aborted ? 'staff_api_timeout' : 'staff_api_unavailable', null, true)
  } finally { clearTimeout(timer) }
}
