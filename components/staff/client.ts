import type { StaffResponse } from './types'

export class StaffRequestError extends Error {
  constructor(message: string, public status: number, public code: string | null) { super(message) }
}
export type StaffClient = ReturnType<typeof createStaffClient>
/** This client contains only BFF paths, CSRF and in-memory retry identifiers. */
export function createStaffClient(csrf: () => string, invalidSession?: () => void) {
  const pending = new Map<string, { fingerprint: string; key: string }>()
  async function request<T>(path: string, options: RequestInit = {}): Promise<StaffResponse<T>> {
    if (!path.startsWith('/api/staff/') || path.includes('://')) throw new Error('Ogiltig personalåtgärd.')
    const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(25_000)]) : AbortSignal.timeout(25_000)
    const response = await fetch(path, { ...options, signal, credentials: 'same-origin', cache: 'no-store' })
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      const error = payload?.error
      const code = typeof error?.code === 'string' ? error.code : null
      if (response.status === 401 && !['/api/staff/session/login', '/api/staff/session/recovery', '/api/staff/session/recovery/verify'].includes(path)) invalidSession?.()
      const message = response.status === 409 && code === 'support_case_version_conflict' ? 'Ärendet har ändrats. Uppdatera ärendet och kontrollera uppgifterna innan du försöker igen.'
        : response.status === 409 && ['staff_session_busy', 'idempotency_in_progress'].includes(code ?? '') ? 'Åtgärden behandlas fortfarande. Vänta en stund och försök igen med samma uppgifter.'
        : typeof error?.message === 'string' ? error.message : 'Tjänsten kunde inte nås. Försök igen.'
      const trace = typeof payload?.request_id === 'string' ? ` Referens: ${payload.request_id}` : ''
      const retry = response.headers.get('Retry-After')
      throw new StaffRequestError(`${message}${response.status === 429 && retry ? ` Försök igen om ${retry} sekunder.` : ''}${trace}`, response.status, code)
    }
    if (!payload || !Object.hasOwn(payload, 'data')) throw new Error('Tjänsten gav ett ofullständigt svar. Försök igen.')
    return payload as StaffResponse<T>
  }
  return {
    read<T>(path: string, signal?: AbortSignal) { return request<T>(path, { signal }) },
    async write<T>(path: string, body: Record<string, unknown> | FormData, fingerprint?: string) {
      const multipart = body instanceof FormData
      const serialized = multipart ? null : JSON.stringify(body)
      const identity = fingerprint ?? serialized
      if (!identity) throw new Error('Bilagans innehåll kunde inte verifieras.')
      let operation = pending.get(path)
      if (!operation || operation.fingerprint !== identity) {
        operation = { fingerprint: identity, key: crypto.randomUUID() }
        pending.set(path, operation)
      }
      const headers: Record<string, string> = { 'X-Gridex-Staff-CSRF': csrf(), 'Idempotency-Key': operation.key }
      if (!multipart) headers['Content-Type'] = 'application/json'
      const result = await request<T>(path, { method: 'POST', headers, body: multipart ? body : serialized })
      if (pending.get(path) === operation) pending.delete(path)
      return result
    },
  }
}

/** Clear an emailed recovery fragment before effects can perform any request. */
export function consumeStaffRecoveryFragment(): string | null {
  if (typeof window === 'undefined' || !['/login/recovery', '/staff/recovery'].includes(window.location.pathname) || !window.location.hash) return null
  const hash = window.location.hash
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
  const fields = new URLSearchParams(hash.slice(1))
  const tokens = fields.getAll('token_hash')
  const token = tokens.length === 1 && Array.from(fields.keys()).every((key) => key === 'token_hash') ? tokens[0] : null
  return token && /^[A-Za-z0-9_-]{16,512}$/.test(token) ? token : null
}

export function staffPath(reference: string) { return encodeURIComponent(reference) }
export function staffDate(value: string | null | undefined) {
  if (!value || !Number.isFinite(Date.parse(value))) return '–'
  return new Intl.DateTimeFormat('sv-SE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Stockholm' }).format(new Date(value))
}
export const statusLabels: Record<string, string> = { open: 'Öppet', action_required: 'Åtgärd krävs', awaiting_external_response: 'Inväntar externt svar', manual_follow_up: 'Manuell uppföljning', resolved: 'Löst', closed: 'Avslutat', cancelled: 'Avbrutet', billing_blocked: 'Fakturering spärrad' }
export const priorityLabels: Record<string, string> = { low: 'Låg', normal: 'Normal', high: 'Hög', urgent: 'Brådskande' }
