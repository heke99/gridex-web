export function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

export function text(value: unknown, max = 240): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().slice(0, max)
  return trimmed || null
}

function limitedString(value: unknown, max: number): string | null | undefined {
  if (value === null) return null
  if (value === undefined) return undefined
  if (typeof value !== 'string') return undefined
  return value.trim().slice(0, max) || null
}

function allowedStrings(
  source: Record<string, unknown>,
  fields: Array<[string, number]>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [field, max] of fields) {
    const parsed = limitedString(source[field], max)
    if (parsed !== undefined) result[field] = parsed
  }
  return result
}

function validIsoDate(value: unknown): string | null | undefined {
  const parsed = limitedString(value, 40)
  if (parsed === undefined || parsed === null) return parsed
  return Number.isFinite(Date.parse(parsed)) ? parsed : undefined
}

function safeMetadata(value: unknown): Record<string, unknown> | null {
  const source = object(value)
  if (!source) return null
  const entries = Object.entries(source)
    .filter(([key, item]) => /^[a-zA-Z0-9_.-]{1,80}$/.test(key) && ['string', 'number', 'boolean'].includes(typeof item))
    .slice(0, 40)
  return entries.length ? Object.fromEntries(entries) : null
}

export function profilePayload(value: unknown): Record<string, unknown> | null {
  const source = object(value)
  if (!source) return null
  const result = allowedStrings(source, [
    ['first_name', 120],
    ['last_name', 120],
    ['email', 254],
    ['phone', 40],
    ['preferred_language', 12],
    ['language_code', 12],
  ])
  if (typeof result.email === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)) {
    return null
  }
  return Object.keys(result).length ? result : null
}

export function moveOutPayload(value: unknown): Record<string, unknown> | null {
  const source = object(value)
  if (!source) return null
  const result = allowedStrings(source, [
    ['site_id', 120],
    ['customer_site_id', 120],
    ['facility_id', 120],
    ['reason', 500],
  ])
  const moveOutDate = limitedString(
    source.requested_move_out_date ?? source.move_out_date,
    10,
  )
  if (moveOutDate !== undefined) {
    if (moveOutDate !== null && !isStrictCalendarDate(moveOutDate)) return null
    result.requested_move_out_date = moveOutDate
  }
  const forwarding = object(source.forwarding_address)
  if (forwarding) {
    const safe = allowedStrings(forwarding, [
      ['street', 180],
      ['postal_code', 20],
      ['city', 120],
      ['country_code', 2],
    ])
    if (Object.keys(safe).length) result.forwarding_address = safe
  }
  return Object.keys(result).length ? result : null
}

export function syncPowerOfAttorney(value: unknown): Record<string, unknown> | null {
  const source = object(value)
  if (!source) return null
  const result = allowedStrings(source, [
    ['status', 40],
    ['legal_text_version', 120],
    ['legal_text_version_id', 120],
    ['reference', 160],
    ['method', 80],
  ])
  const signedAt = validIsoDate(source.signed_at ?? source.accepted_at)
  if (signedAt !== undefined) result.signed_at = signedAt
  const rawScope = source.scope ?? source.scopes
  if (typeof rawScope === 'string' && rawScope.trim()) {
    result.scope = rawScope.trim().slice(0, 120)
  } else if (Array.isArray(rawScope)) {
    result.scope = rawScope
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim().slice(0, 120))
      .filter(Boolean)
      .slice(0, 20)
  }
  const document = syncDocument(source.document)
  if (document) result.document = document
  return Object.keys(result).length ? result : null
}

export function syncLegalAcceptances(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, 100).flatMap((item) => {
    const source = object(item)
    if (!source) return []
    const result = allowedStrings(source, [
      ['acceptance_type', 80],
      ['legal_text_version', 120],
      ['legal_text_version_id', 120],
      ['method', 80],
      ['reference', 160],
    ])
    const acceptedAt = validIsoDate(source.accepted_at)
    if (acceptedAt !== undefined) result.accepted_at = acceptedAt
    return result.acceptance_type && (result.legal_text_version || result.legal_text_version_id)
      ? [result]
      : []
  })
}

export function syncDocument(value: unknown): Record<string, unknown> | null {
  const source = object(value)
  if (!source) return null
  const result = allowedStrings(source, [
    ['external_document_id', 160],
    ['document_type', 80],
    ['title', 240],
    ['file_url', 2_000],
    ['status', 40],
    ['content_hash', 160],
  ])
  const createdAt = validIsoDate(source.created_at)
  if (createdAt !== undefined) result.created_at = createdAt
  const metadata = safeMetadata(source.metadata)
  if (metadata) result.metadata = metadata
  return result.external_document_id && result.document_type ? result : null
}

export function syncDocuments(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, 100).map(syncDocument).filter((item): item is Record<string, unknown> => Boolean(item))
}

export function syncFacilityData(value: unknown): Record<string, unknown> | null {
  const source = object(value)
  if (!source) return null
  const result = allowedStrings(source, [
    ['site_id', 120],
    ['customer_site_id', 120],
    ['facility_id', 120],
    ['metering_point_id', 120],
    ['grid_owner_id', 120],
    ['grid_area_code', 40],
    ['price_area_code', 10],
    ['street', 180],
    ['address', 180],
    ['postal_code', 20],
    ['city', 120],
    ['source', 80],
  ])
  const verifiedAt = validIsoDate(source.verified_at)
  if (verifiedAt !== undefined) result.verified_at = verifiedAt
  return Object.keys(result).length ? result : null
}

export function clientOperationId(value: unknown): string | null {
  const parsed = text(value, 240)
  return parsed && /^[0-9a-zA-Z:_-]{8,240}$/.test(parsed) ? parsed : null
}
import { isStrictCalendarDate } from '@/lib/website/businessDate'
