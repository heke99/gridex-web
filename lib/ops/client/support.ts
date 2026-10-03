import { createHash } from 'node:crypto'
import { opsCustomerFetch, verifiedPortalHeaders, type OpsPortalIdentity } from './portal'
import { opsRequest, getOpsApiBaseUrl, getOpsApiKey, safeErrorDetails, customerSafeMessage } from '@/lib/ops/transport'
import { OpsError } from '@/lib/ops/errors'
import {
  assertCustomerPortalOperationRequest,
  assertCustomerPortalOperationResponse,
} from '@/lib/ops/validators/openapi'
import {
  assertSupportFile,
  SUPPORT_DOWNLOAD_MAX_BYTES,
  SUPPORT_FILE_TYPES,
  SUPPORT_REFERENCE_PATTERN,
  supportCreateInput,
  supportIdempotencyKey,
  supportReference,
  supportReplyInput,
} from '@/lib/support/validation'
import type {
  SupportAttachment,
  SupportCase,
  SupportCaseDetail,
  SupportCreateInput,
  SupportListResponse,
  SupportMessage,
  SupportResponse,
} from '@/lib/support/types'

const CASES_PATH = '/api/v1/customer/support/cases'

function invalidResponse(): never {
  throw new OpsError('Kundservice returnerade ett ogiltigt svar.', 502, {
    code: 'support_response_invalid', retryable: false,
  })
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalidResponse()
  return value as Record<string, unknown>
}

function text(value: unknown, max?: number): string {
  if (typeof value !== 'string' || (max !== undefined && value.length > max)) invalidResponse()
  return value
}

function reference(value: unknown): string {
  const result = text(value)
  if (!SUPPORT_REFERENCE_PATTERN.test(result)) invalidResponse()
  return result
}

function date(value: unknown): string {
  const result = text(value)
  if (!Number.isFinite(Date.parse(result))) invalidResponse()
  return result
}

function nullableDate(value: unknown): string | null {
  return value === null ? null : date(value)
}

export function customerVisibleSupportCase(value: unknown): SupportCase {
  const row = object(value)
  const status = row.status
  if (!['received', 'in_progress', 'resolved', 'closed'].includes(String(status))) invalidResponse()
  // Explicit fields keep staff identities, assignments and future internal fields out of the browser.
  return {
    case_reference: reference(row.case_reference),
    title: text(row.title, 180),
    description: row.description === null ? null : text(row.description),
    status: status as SupportCase['status'],
    channel: row.channel === null ? null : text(row.channel),
    created_at: date(row.created_at),
    updated_at: date(row.updated_at),
    resolved_at: nullableDate(row.resolved_at),
  }
}

export function customerVisibleSupportMessage(value: unknown): SupportMessage {
  const row = object(value)
  if (
    !['customer', 'staff'].includes(String(row.author_type)) ||
    !['message', 'phone_summary'].includes(String(row.kind)) ||
    row.is_internal_note === true || row.visibility === 'internal' || row.kind === 'internal_note'
  ) invalidResponse()
  return {
    message_reference: reference(row.message_reference),
    author_type: row.author_type as SupportMessage['author_type'],
    kind: row.kind as SupportMessage['kind'],
    body: text(row.body, 8000),
    created_at: date(row.created_at),
  }
}

export function customerVisibleSupportAttachment(value: unknown): SupportAttachment {
  const row = object(value)
  if (
    !SUPPORT_FILE_TYPES.has(String(row.mime_type)) ||
    !Number.isSafeInteger(row.byte_size) || Number(row.byte_size) < 1 || Number(row.byte_size) > SUPPORT_DOWNLOAD_MAX_BYTES ||
    typeof row.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(row.sha256) ||
    !['customer', 'staff'].includes(String(row.uploaded_by)) ||
    row.is_internal_note === true || row.visibility === 'internal'
  ) invalidResponse()
  return {
    attachment_reference: reference(row.attachment_reference),
    file_name: text(row.file_name, 160),
    mime_type: row.mime_type as SupportAttachment['mime_type'],
    byte_size: Number(row.byte_size),
    sha256: row.sha256,
    uploaded_by: row.uploaded_by as SupportAttachment['uploaded_by'],
    created_at: date(row.created_at),
  }
}

function response<T>(payload: unknown, map: (value: unknown) => T): SupportResponse<T> {
  const root = object(payload)
  return {
    data: map(root.data),
    request_id: text(root.request_id),
    contract_schema_version: text(root.contract_schema_version),
    ...(root.correlation_id === undefined ? {} : { correlation_id: root.correlation_id === null ? null : text(root.correlation_id) }),
  }
}

function array<T>(value: unknown, map: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) invalidResponse()
  return value.map(map)
}

export function mapSupportListResponse(payload: unknown): SupportListResponse {
  const root = object(payload)
  const page = object(root.page)
  if (
    !Number.isSafeInteger(page.limit) || Number(page.limit) < 1 || Number(page.limit) > 100 ||
    !Number.isSafeInteger(page.offset) || Number(page.offset) < 0 ||
    !Number.isSafeInteger(page.returned) || Number(page.returned) < 0 ||
    typeof page.has_more !== 'boolean' ||
    !(page.next_cursor === null || typeof page.next_cursor === 'string') ||
    (page.has_more && !page.next_cursor)
  ) invalidResponse()
  const result = response(payload, (value) => array(value, customerVisibleSupportCase))
  if (result.data.length !== page.returned || result.data.length > Number(page.limit)) invalidResponse()
  return {
    ...result,
    page: { limit: Number(page.limit), offset: Number(page.offset), returned: Number(page.returned), has_more: page.has_more, next_cursor: page.next_cursor as string | null },
  }
}

export async function fetchOpsCustomerSupportTickets(
  identity: OpsPortalIdentity,
  input: { limit?: number; cursor?: string } = {},
): Promise<SupportListResponse> {
  const query = new URLSearchParams({ limit: String(input.limit ?? 20) })
  if (input.cursor) query.set('cursor', input.cursor)
  return mapSupportListResponse(await opsCustomerFetch(`${CASES_PATH}?${query}`, identity))
}

export async function fetchOpsCustomerSupportCase(identity: OpsPortalIdentity, caseReference: string): Promise<SupportResponse<SupportCaseDetail>> {
  return response(await opsCustomerFetch(`${CASES_PATH}/${supportReference(caseReference)}`, identity), (value) => {
    const row = object(value)
    const result = customerVisibleSupportCase(value)
    if (result.case_reference !== caseReference) invalidResponse()
    return { ...result, messages: array(row.messages, customerVisibleSupportMessage) }
  })
}

export async function fetchOpsCustomerSupportMessages(identity: OpsPortalIdentity, caseReference: string) {
  return response(await opsCustomerFetch(`${CASES_PATH}/${supportReference(caseReference)}/messages`, identity), (value) => array(value, customerVisibleSupportMessage))
}

export async function createOpsCustomerSupportCase(identity: OpsPortalIdentity, input: SupportCreateInput, operationId: string) {
  const headers = new Headers({ 'Idempotency-Key': supportIdempotencyKey(operationId) })
  return response(await opsCustomerFetch(CASES_PATH, identity, {
    method: 'POST', headers, body: JSON.stringify(supportCreateInput(input)),
  }), customerVisibleSupportCase)
}

export async function replyOpsCustomerSupportCase(identity: OpsPortalIdentity, caseReference: string, input: { message: string }, operationId: string) {
  const headers = new Headers({ 'Idempotency-Key': supportIdempotencyKey(operationId) })
  return response(await opsCustomerFetch(`${CASES_PATH}/${supportReference(caseReference)}/messages`, identity, {
    method: 'POST', headers, body: JSON.stringify(supportReplyInput(input)),
  }), customerVisibleSupportMessage)
}

export async function fetchOpsCustomerSupportAttachments(identity: OpsPortalIdentity, caseReference: string) {
  return response(await opsCustomerFetch(`${CASES_PATH}/${supportReference(caseReference)}/attachments`, identity), (value) => array(value, customerVisibleSupportAttachment))
}

export async function uploadOpsCustomerSupportAttachment(identity: OpsPortalIdentity, caseReference: string, input: { bytes: Uint8Array; contentType: string; fileName?: string }, operationId: string) {
  assertSupportFile(input.bytes, input.contentType)
  const path = `${CASES_PATH}/${supportReference(caseReference)}/attachments`
  const headers = await verifiedPortalHeaders(identity)
  headers.set('Content-Type', input.contentType)
  headers.set('Idempotency-Key', supportIdempotencyKey(operationId))
  if (input.fileName) headers.set('X-File-Name', encodeURIComponent(input.fileName.slice(0, 160)))
  // OpenAPI validates path/security headers; binary content is validated above.
  assertCustomerPortalOperationRequest(path, 'post', undefined, headers)
  const result = await opsRequest(path, { method: 'POST', headers, body: Buffer.from(input.bytes) })
  assertCustomerPortalOperationResponse(path, 'post', result.status, result.payload)
  return response(result.payload, customerVisibleSupportAttachment)
}

export async function readBoundedSupportBytes(response: Response, maxBytes: number): Promise<Uint8Array> {
  const declaredLength = Number(response.headers.get('content-length') ?? 0)
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    await response.body?.cancel()
    throw new OpsError('Filen är för stor.', 413, { code: 'attachment_too_large', retryable: false })
  }
  const reader = response.body?.getReader()
  if (!reader) return new Uint8Array()
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) break
      length += next.value.byteLength
      if (length > maxBytes) {
        await reader.cancel()
        throw new OpsError('Filen är för stor.', 413, { code: 'attachment_too_large', retryable: false })
      }
      chunks.push(next.value)
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return bytes
}

export async function downloadOpsCustomerSupportAttachment(identity: OpsPortalIdentity, caseReference: string, attachmentReference: string) {
  const path = `${CASES_PATH}/${supportReference(caseReference)}/attachments/${supportReference(attachmentReference)}`
  const headers = await verifiedPortalHeaders(identity)
  assertCustomerPortalOperationRequest(path, 'get', undefined, headers)
  const apiKey = getOpsApiKey()
  if (!apiKey.value) throw new OpsError('Kundservice är inte konfigurerad.', 503, { code: 'ops_not_configured', retryable: false })
  headers.set('Authorization', `Bearer ${apiKey.value}`)
  headers.set('Accept', 'application/pdf, image/png, image/jpeg')
  let upstream: Response
  const timeout = AbortSignal.timeout(12_000)
  try {
    // A single attempt prevents reuse of single-use customer assertions.
    upstream = await fetch(`${getOpsApiBaseUrl()}${path.replace(/^\/api\/v1/, '')}`, { headers, cache: 'no-store', redirect: 'manual', signal: timeout })
    if (upstream.status >= 300 && upstream.status < 400) {
      await upstream.body?.cancel()
      throw new OpsError('Bilagan kunde inte hämtas.', 502, { code: 'ops_redirect_received', retryable: false, endpoint: path })
    }
    if (!upstream.ok) {
      const payload = await upstream.json().catch(() => null)
      const details = safeErrorDetails(payload, upstream, path)
      throw new OpsError(customerSafeMessage(details), upstream.status, {
        ...details, code: details.code ?? 'attachment_download_failed',
      })
    }
    const contentType = upstream.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() ?? ''
    const sha256 = upstream.headers.get('x-gridex-sha256') ?? ''
    if (!SUPPORT_FILE_TYPES.has(contentType) || !/^[a-f0-9]{64}$/.test(sha256)) invalidResponse()
    const bytes = await readBoundedSupportBytes(upstream, SUPPORT_DOWNLOAD_MAX_BYTES)
    if (!bytes.length || createHash('sha256').update(bytes).digest('hex') !== sha256) {
      throw new OpsError('Bilagans innehåll kunde inte verifieras.', 502, { code: 'attachment_integrity_failed', retryable: false })
    }
    return { bytes, contentType, sha256 }
  } catch (error) {
    if (error instanceof OpsError) throw error
    throw new OpsError('Bilagan kunde inte hämtas just nu.', timeout.aborted ? 504 : 503, { code: 'attachment_download_unavailable', retryable: true })
  }
}
