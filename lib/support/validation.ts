import { OpsError } from '@/lib/ops/errors'
import type { SupportCreateInput } from './types'

export const SUPPORT_REFERENCE_PATTERN = /^[a-z][a-z0-9_]{1,31}_[A-Za-z0-9_-]{20,64}$/
export const SUPPORT_IDEMPOTENCY_PATTERN = /^[A-Za-z0-9._:+~-]{8,200}$/
export const SUPPORT_UPLOAD_MAX_BYTES = 4 * 1024 * 1024
export const SUPPORT_DOWNLOAD_MAX_BYTES = 10 * 1024 * 1024
export const SUPPORT_FILE_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg'])

export function supportValidationError(message: string, field?: string): never {
  throw new OpsError(message, 400, { code: 'validation_error', field, retryable: false })
}

export function supportReference(value: unknown): string {
  if (typeof value !== 'string' || !SUPPORT_REFERENCE_PATTERN.test(value)) {
    supportValidationError('Ärendereferensen är ogiltig.', 'reference')
  }
  return value
}

export function supportIdempotencyKey(value: unknown): string {
  if (typeof value !== 'string' || !SUPPORT_IDEMPOTENCY_PATTERN.test(value)) {
    supportValidationError('Begäran saknar ett giltigt idempotens-ID.', 'idempotency_key')
  }
  return value
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    supportValidationError('Begäran måste vara ett JSON-objekt.')
  }
  return value as Record<string, unknown>
}

function onlyFields(row: Record<string, unknown>, allowed: string[]) {
  const unknown = Object.keys(row).find((field) => !allowed.includes(field))
  if (unknown) supportValidationError('Begäran innehåller ett otillåtet fält.', unknown)
}

function text(value: unknown, max: number, field: string, required = true): string {
  if (typeof value !== 'string' || (required && !value.trim()) || value.length > max) {
    supportValidationError(`Ange ${field === 'title' ? 'ett ämne (högst 180 tecken)' : field === 'category' ? 'en kategori (högst 120 tecken)' : 'ett meddelande (högst 8 000 tecken)'}.`, field)
  }
  return value.trim()
}

export function supportCreateInput(value: unknown): SupportCreateInput {
  const row = object(value)
  // Customer identity and staff-only fields can never be supplied by a browser.
  onlyFields(row, ['title', 'message', 'category'])
  return {
    title: text(row.title, 180, 'title'),
    message: text(row.message, 8000, 'message'),
    ...(row.category === undefined ? {} : { category: text(row.category, 120, 'category', false) }),
  }
}

export function supportReplyInput(value: unknown): { message: string } {
  const row = object(value)
  onlyFields(row, ['message'])
  return { message: text(row.message, 8000, 'message') }
}

export function supportListQuery(searchParams: URLSearchParams): { limit: number; cursor?: string } {
  for (const key of searchParams.keys()) {
    if (!['limit', 'cursor'].includes(key) || searchParams.getAll(key).length !== 1) {
      supportValidationError('Begäran innehåller en otillåten parameter.', key)
    }
  }
  const rawLimit = searchParams.get('limit') ?? '20'
  const limit = /^\d+$/.test(rawLimit) ? Number(rawLimit) : NaN
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    supportValidationError('Sidstorleken måste vara mellan 1 och 100.', 'limit')
  }
  const cursor = searchParams.get('cursor')
  if (cursor !== null && (!cursor || cursor.length > 4096)) {
    supportValidationError('Sidreferensen är ogiltig.', 'cursor')
  }
  return { limit, ...(cursor ? { cursor } : {}) }
}

export function assertSupportFile(bytes: Uint8Array, contentType: string) {
  if (!SUPPORT_FILE_TYPES.has(contentType)) {
    throw new OpsError('Välj en PDF-, PNG- eller JPEG-fil.', 415, { code: 'unsupported_media_type', retryable: false })
  }
  if (bytes.byteLength < 1 || bytes.byteLength > SUPPORT_UPLOAD_MAX_BYTES) {
    throw new OpsError('Filen måste vara högst 4 MB och får inte vara tom.', 413, { code: 'attachment_too_large', retryable: false })
  }
  const matches = contentType === 'application/pdf'
    ? bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-'
    : contentType === 'image/png'
      ? bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte)
      : bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
  if (!matches) {
    throw new OpsError('Filens innehåll stämmer inte med filtypen.', 422, { code: 'attachment_type_mismatch', retryable: false })
  }
}
