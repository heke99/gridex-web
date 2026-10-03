import { OpsError } from '@/lib/ops/errors'
import { STAFF_CONTRACT_VERSION } from './config'
import { staffJsonRequest, type StaffEnvelope } from './transport'
import { authenticatedStaffSession, staffReceipt, staffRefreshOperationKey, type StaffCookieSession } from './session'
import type { components } from './generated/staff-api'

export type StaffMe = components['schemas']['StaffContext']

export function staffMe(value: unknown, session: Extract<StaffCookieSession, { kind: 'staff' }>): StaffMe {
  const row = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
  if (!row || row.staff_reference !== session.receipt.staff_reference || row.organization_reference !== session.receipt.organization_reference ||
    !(row.display_name === null || (typeof row.display_name === 'string' && row.display_name.length <= 240)) || typeof row.is_platform_admin !== 'boolean' ||
    !Array.isArray(row.permissions) || !Array.isArray(row.capabilities) || row.permissions.length > 1000 || row.capabilities.length > 100 ||
    ![...row.permissions, ...row.capabilities].every((entry) => typeof entry === 'string' && /^[a-zA-Z0-9_.:-]{1,120}$/.test(entry))) {
    throw new OpsError('Personalidentiteten kunde inte verifieras.', 502, { code: 'staff_identity_response_invalid', retryable: false })
  }
  return { staff_reference: row.staff_reference as string, organization_reference: row.organization_reference as string,
    display_name: row.display_name as string | null, is_platform_admin: row.is_platform_admin,
    permissions: [...new Set(row.permissions as string[])], capabilities: [...new Set(row.capabilities as StaffMe['capabilities'])] }
}

export function safeStaffContext(session: StaffCookieSession, me: StaffMe | null = null) {
  return { status: session.kind === 'anonymous' ? 'anonymous' : session.receipt.status,
    csrf_token: session.csrf, factors: session.kind === 'staff' ? session.receipt.factors : [], staff: me }
}

export function sessionFromReceipt(envelope: StaffEnvelope, previous?: StaffCookieSession): Extract<StaffCookieSession, { kind: 'staff' }> {
  const receipt = staffReceipt(envelope.data)
  if (!receipt || Date.parse(receipt.expires_at) <= Date.now() ||
    Date.parse(receipt.expires_at) > Date.now() + 330000 || Date.parse(receipt.refresh_expires_at) > Date.now() + 8 * 60 * 60 * 1000 + 30000) {
    throw new OpsError('Personalinloggningens svar kunde inte verifieras.', 502, {
      code: 'staff_session_response_invalid', retryable: false, request_id: envelope.request_id,
    })
  }
  return authenticatedStaffSession(receipt, previous) as Extract<StaffCookieSession, { kind: 'staff' }>
}

/** Concurrent and lost-response attempts use the original proof/body/key. */
const pendingRefreshes = new Map<string, Promise<Extract<StaffCookieSession, { kind: 'staff' }>>>()
export async function refreshStaffSession(session: Extract<StaffCookieSession, { kind: 'staff' }>): Promise<Extract<StaffCookieSession, { kind: 'staff' }>> {
  const key = staffRefreshOperationKey(session)
  const existing = pendingRefreshes.get(key)
  if (existing) return existing
  const operation = (async () => {
    const envelope = await staffJsonRequest('/staff/sessions/refresh', { method: 'POST',
      body: { refresh_token: session.receipt.refresh_token }, idempotencyKey: key })
    const refreshed = sessionFromReceipt(envelope, session)
    if (refreshed.receipt.session_reference !== session.receipt.session_reference ||
      refreshed.receipt.staff_reference !== session.receipt.staff_reference ||
      refreshed.receipt.organization_reference !== session.receipt.organization_reference) {
      throw new OpsError('Personalsessionens identitet ändrades oväntat.', 502, { code: 'staff_refresh_identity_invalid', retryable: false })
    }
    return refreshed
  })()
  pendingRefreshes.set(key, operation)
  try { return await operation } finally { if (pendingRefreshes.get(key) === operation) pendingRefreshes.delete(key) }
}

export async function freshStaffSession(session: Extract<StaffCookieSession, { kind: 'staff' }>) {
  return Date.parse(session.receipt.expires_at) <= Date.now() + 15000 ? refreshStaffSession(session) : session
}

export async function publicStaffSession(session: StaffCookieSession, trace?: StaffEnvelope): Promise<StaffEnvelope<ReturnType<typeof safeStaffContext>>> {
  const context = session.kind === 'staff' && session.receipt.status === 'authenticated'
    ? await staffJsonRequest('/staff/me', { proof: session.receipt.staff_access_token }) : null
  const me = context && session.kind === 'staff' ? staffMe(context.data, session) : null
  return { data: safeStaffContext(session, me), request_id: trace?.request_id ?? context?.request_id ?? crypto.randomUUID(),
    correlation_id: trace?.correlation_id ?? context?.correlation_id ?? null, contract_schema_version: STAFF_CONTRACT_VERSION }
}
