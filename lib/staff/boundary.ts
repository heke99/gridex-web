import { OpsError } from '@/lib/ops/errors'
import { GRIDEX_SUPPORT_HOST } from '@/lib/routing/supportHost'
import { readStaffCookie, sameStaffCsrf, type StaffCookieSession } from './session'

function forbidden(code: string, message: string): never {
  throw new OpsError(message, 403, { code, retryable: false })
}

export function assertStaffHost(request: Request): void {
  const url = new URL(request.url)
  if (url.origin !== `https://${GRIDEX_SUPPORT_HOST}`) forbidden('staff_host_required', 'Använd personalportalen på supportdomänen.')
  if (request.headers.get('sec-fetch-site') === 'cross-site') forbidden('staff_origin_invalid', 'Begäran kommer från en otillåten origin.')
}

/** All mutations, including login and recovery, require an exact Origin and cookie nonce. */
export function requireStaffMutation(request: Request): StaffCookieSession {
  assertStaffHost(request)
  if (request.headers.get('origin') !== `https://${GRIDEX_SUPPORT_HOST}`) forbidden('staff_origin_invalid', 'Begäran kommer från en otillåten origin.')
  const session = readStaffCookie(request)
  if (!session || !sameStaffCsrf(request.headers.get('x-gridex-staff-csrf'), session.csrf)) {
    forbidden('staff_csrf_invalid', 'Ladda om personalportalen och försök igen.')
  }
  return session
}

export function requireStaffProof(request: Request, requireAuthenticated = true): Extract<StaffCookieSession, { kind: 'staff' }> {
  assertStaffHost(request)
  const session = readStaffCookie(request)
  if (session?.kind !== 'staff') throw new OpsError('Logga in i personalportalen.', 401, { code: 'staff_session_required', retryable: false })
  if (requireAuthenticated && session.receipt.status !== 'authenticated') forbidden('staff_auth_stage_required', 'Slutför personalinloggningen först.')
  return session
}

export function staffIdempotencyKey(request: Request): string {
  const key = request.headers.get('idempotency-key') ?? ''
  if (!/^[A-Za-z0-9._:-]{16,128}$/.test(key)) throw new OpsError('Begäran saknar en giltig åtgärdsnyckel.', 400, {
    code: 'idempotency_key_required', retryable: false,
  })
  return key
}

export async function readStaffBody(request: Pick<Request, 'headers' | 'body'>, maxBytes: number, signal?: AbortSignal): Promise<Uint8Array> {
  if (signal?.aborted) throw signal.reason
  const length = request.headers.get('content-length')
  if (length && (!/^\d+$/.test(length) || Number(length) > maxBytes)) {
    throw new OpsError('Filen eller begäran är för stor.', 413, { code: 'payload_too_large', retryable: false })
  }
  const reader = request.body?.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  if (reader) {
    let abort: (() => void) | undefined
    const interrupted = signal ? new Promise<never>((_resolve, reject) => {
      abort = () => { void reader.cancel().catch(() => {}); reject(signal.reason) }
      signal.addEventListener('abort', abort, { once: true })
    }) : null
    try {
      while (true) {
        const { done, value } = await (interrupted ? Promise.race([reader.read(), interrupted]) : reader.read())
        if (signal?.aborted) throw signal.reason
        if (done) break
        total += value.byteLength
        if (total > maxBytes) {
          void reader.cancel().catch(() => {})
          throw new OpsError('Filen eller begäran är för stor.', 413, { code: 'payload_too_large', retryable: false })
        }
        chunks.push(value)
      }
    } finally {
      if (abort) signal?.removeEventListener('abort', abort)
      reader.releaseLock()
    }
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return bytes
}

export async function readStaffJson(request: Request): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
    throw new OpsError('Begäran måste innehålla JSON.', 415, { code: 'unsupported_media_type', retryable: false })
  }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await readStaffBody(request, 16 * 1024))) }
  catch (error) {
    if (error instanceof OpsError) throw error
    throw new OpsError('Begäran innehåller ogiltig JSON.', 400, { code: 'invalid_json', retryable: false })
  }
}
