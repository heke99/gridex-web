import { readBoundedBytes } from '../ops/httpSafety'
import { isSupportAttachmentType, MAX_SUPPORT_ATTACHMENT_BYTES } from './attachmentRules'

export function attachmentError(status: number, code: string): Response {
  return Response.json({ error: { code } }, { status, headers: { 'Cache-Control': 'private, no-store' } })
}

/** Cookie-authenticated upload boundary. Authority is verified by the caller first. */
export async function readAttachmentRequest(request: Request) {
  const origin = request.headers.get('origin')
  const url = new URL(request.url)
  // Next's local adapter may construct request.url with localhost even when
  // the browser uses 127.0.0.1. Host is still the actual requested authority.
  let sameOrigin = origin === url.origin
  try {
    const source = new URL(origin ?? '')
    sameOrigin ||= source.origin === origin && source.host === request.headers.get('host') && source.protocol === url.protocol
  } catch { /* Missing/malformed origins fail closed. */ }
  if (!sameOrigin
    || request.headers.get('sec-fetch-site') === 'cross-site') {
    return { response: attachmentError(403, 'cross_site_request_blocked') } as const
  }
  const mimeType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() ?? ''
  if (!isSupportAttachmentType(mimeType)) return { response: attachmentError(415, 'attachment_type_invalid') } as const
  const key = request.headers.get('idempotency-key') ?? ''
  const fileName = request.headers.get('x-file-name') ?? 'bilaga'
  if (!/^[A-Za-z0-9._:+~-]{8,200}$/.test(key) || fileName.length > 200 || /[\u0000-\u001f\u007f]/.test(fileName)) {
    return { response: attachmentError(400, 'attachment_request_invalid') } as const
  }
  try { decodeURIComponent(fileName) } catch { return { response: attachmentError(400, 'attachment_request_invalid') } as const }
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(8_000)])
  try {
    const bytes = await readBoundedBytes(new Response(request.body, { headers: request.headers }), MAX_SUPPORT_ATTACHMENT_BYTES, signal)
    if (!bytes.length) return { response: attachmentError(400, 'attachment_empty') } as const
    return { bytes, mimeType, key, fileName } as const
  } catch (error) {
    return { response: attachmentError(error instanceof RangeError ? 413 : signal.aborted ? 408 : 400,
      error instanceof RangeError ? 'attachment_too_large' : 'attachment_body_invalid') } as const
  }
}
