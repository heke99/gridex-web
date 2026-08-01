import { isStrictCalendarDate } from '@/lib/website/businessDate'

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

function validCalendarDate(value: unknown): string | null | undefined {
  const parsed = limitedString(value, 10)
  if (parsed === undefined || parsed === null) return parsed
  return isStrictCalendarDate(parsed) ? parsed : undefined
}

function safeMetadata(value: unknown): Record<string, unknown> | null {
  const source = object(value)
  if (!source) return null
  const entries = Object.entries(source)
    .filter(([key, item]) => /^[a-zA-Z0-9_.-]{1,80}$/.test(key) && ['string', 'number', 'boolean'].includes(typeof item))
    .slice(0, 40)
  return entries.length ? Object.fromEntries(entries) : null
}

function safeFreeformObject(value: unknown, maxEntries = 40): Record<string, unknown> | null {
  const source = object(value)
  if (!source) return null
  const entries = Object.entries(source)
    .filter(([key, item]) => /^[a-zA-Z0-9_.-]{1,80}$/.test(key) && item !== undefined)
    .slice(0, maxEntries)
  return entries.length ? Object.fromEntries(entries) : null
}

function validUri(value: unknown): string | null {
  const candidate = text(value, 2_000)
  if (!candidate) return null
  try {
    const parsed = new URL(candidate)
    return parsed.protocol === 'https:' ? candidate : null
  } catch {
    return null
  }
}

export function profilePayload(value: unknown): Record<string, unknown> | null {
  const source = object(value)
  if (!source) return null
  const result = allowedStrings(source, [
    ['first_name', 120],
    ['last_name', 120],
    ['full_name', 240],
    ['company_name', 240],
    ['phone', 40],
    ['invoice_email', 320],
    ['language_code', 12],
    ['timezone', 80],
  ])
  if (
    typeof result.invoice_email === 'string' &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.invoice_email)
  ) {
    return null
  }
  return Object.keys(result).length ? result : null
}

function canonicalAddress(value: unknown): Record<string, unknown> | null {
  const source = object(value)
  if (!source) return null
  const result = allowedStrings(source, [
    ['street', 180],
    ['postal_code', 20],
    ['city', 120],
    ['country', 80],
    ['care_of', 120],
    ['apartment_number', 40],
  ])
  const legacyCountry = limitedString(source.country_code, 2)
  if (!result.country && legacyCountry) result.country = legacyCountry
  return Object.keys(result).length ? result : null
}

export function moveOutPayload(value: unknown): Record<string, unknown> | null {
  const source = object(value)
  if (!source) return null

  const facilityReference = text(
    source.facility_reference ??
      source.customer_site_id ??
      source.site_id ??
      source.facility_id,
    200,
  )
  const requestedMoveOutDate = validCalendarDate(
    source.requested_move_out_date ?? source.move_out_date,
  )
  if (!facilityReference || !requestedMoveOutDate) return null

  const result: Record<string, unknown> = {
    facility_reference: facilityReference,
    requested_move_out_date: requestedMoveOutDate,
  }
  const customerContractReference = text(source.customer_contract_reference, 200)
  const reason = text(source.reason, 1_000)
  if (customerContractReference) result.customer_contract_reference = customerContractReference
  if (reason) result.reason = reason

  const newAddress = canonicalAddress(source.new_address ?? source.forwarding_address)
  if (newAddress) result.new_address = newAddress
  const contactDetails = safeFreeformObject(source.contact_details)
  if (contactDetails) result.contact_details = contactDetails
  const metadata = safeMetadata(source.metadata)
  if (metadata) result.metadata = metadata
  return result
}

export function syncPowerOfAttorney(value: unknown): Record<string, unknown> | null {
  const source = object(value)
  if (!source) return null

  const document = object(source.document)
  const documentReference = text(
    source.document_reference ??
      document?.document_reference ??
      document?.external_document_id ??
      source.reference,
    200,
  )
  const acceptedAt = validIsoDate(source.accepted_at ?? source.signed_at)
  const rawScope = source.scope ?? source.scopes
  const scope = (Array.isArray(rawScope) ? rawScope : typeof rawScope === 'string' ? [rawScope] : [])
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().slice(0, 160))
    .filter(Boolean)
    .slice(0, 20)

  if (!documentReference || !acceptedAt || scope.length === 0) return null
  if (source.accepted === false) return null

  const result: Record<string, unknown> = {
    document_reference: documentReference,
    scope,
    accepted: true,
    accepted_at: acceptedAt,
  }
  const reference = text(source.power_of_attorney_reference ?? source.reference, 200)
  if (reference) result.power_of_attorney_reference = reference
  const validFrom = validCalendarDate(source.valid_from)
  const validTo = validCalendarDate(source.valid_to)
  if (validFrom) result.valid_from = validFrom
  if (validTo) result.valid_to = validTo
  const metadata = safeMetadata(source.metadata)
  if (metadata) result.metadata = metadata
  return result
}

export function syncLegalAcceptances(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, 100).flatMap((item) => {
    const source = object(item)
    if (!source || source.accepted === false) return []

    const documentReference = text(source.document_reference ?? source.reference, 200)
    const documentCode = text(source.document_code ?? source.acceptance_type, 120)
    const documentVersion = text(
      source.document_version ?? source.legal_text_version_id ?? source.legal_text_version,
      200,
    )
    const documentHash = text(source.document_hash ?? source.content_hash, 64)
    const acceptedAt = validIsoDate(source.accepted_at)
    if (
      !documentReference ||
      !documentCode ||
      !documentVersion ||
      !documentHash ||
      !/^[a-fA-F0-9]{64}$/.test(documentHash) ||
      !acceptedAt
    ) {
      return []
    }

    const result: Record<string, unknown> = {
      document_reference: documentReference,
      document_code: documentCode,
      document_version: documentVersion,
      document_hash: documentHash,
      accepted: true,
      accepted_at: acceptedAt,
    }
    const metadata = safeMetadata(source.metadata)
    if (metadata) result.metadata = metadata
    return [result]
  })
}

export function syncDocument(value: unknown): Record<string, unknown> | null {
  const source = object(value)
  if (!source) return null

  const documentReference = text(source.document_reference ?? source.external_document_id, 200)
  const documentType = text(source.document_type, 120)
  if (!documentReference || !documentType) return null

  const result: Record<string, unknown> = {
    document_reference: documentReference,
    document_type: documentType,
  }
  for (const [field, max] of [
    ['title', 240],
    ['status', 80],
    ['file_name', 240],
    ['mime_type', 160],
  ] as Array<[string, number]>) {
    const parsed = text(source[field], max)
    if (parsed) result[field] = parsed
  }
  const secureUrl = validUri(source.secure_url ?? source.file_url)
  if (secureUrl) result.secure_url = secureUrl
  if (Number.isInteger(source.file_size_bytes) && Number(source.file_size_bytes) >= 0) {
    result.file_size_bytes = Number(source.file_size_bytes)
  }
  const metadata = safeMetadata(source.metadata)
  if (metadata) result.metadata = metadata
  return result
}

export function syncDocuments(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return []
  return value
    .slice(0, 100)
    .map(syncDocument)
    .filter((item): item is Record<string, unknown> => Boolean(item))
}

function syncFacilityItem(value: unknown): Record<string, unknown> | null {
  const source = object(value)
  if (!source) return null
  const result = allowedStrings(source, [
    ['facility_reference', 200],
    ['facility_id', 200],
    ['metering_point_id', 200],
  ])

  const legacyFacilityReference = text(
    source.customer_site_id ?? source.site_id,
    200,
  )
  if (!result.facility_reference && legacyFacilityReference) {
    result.facility_reference = legacyFacilityReference
  }
  const moveInDate = validCalendarDate(source.move_in_date)
  const requestedStartDate = validCalendarDate(source.requested_start_date)
  if (moveInDate) result.move_in_date = moveInDate
  if (requestedStartDate) result.requested_start_date = requestedStartDate

  const nestedAddress = canonicalAddress(source.address)
  const flatAddress = canonicalAddress(source)
  const address = nestedAddress ?? flatAddress
  if (address) result.address = address

  const metadata = safeMetadata(source.metadata)
  if (metadata) result.metadata = metadata
  return Object.keys(result).length ? result : null
}

export function syncFacilityData(value: unknown): Record<string, unknown>[] {
  const rows = Array.isArray(value) ? value : value ? [value] : []
  return rows
    .slice(0, 20)
    .map(syncFacilityItem)
    .filter((item): item is Record<string, unknown> => Boolean(item))
}

export function clientOperationId(value: unknown): string | null {
  const parsed = text(value, 240)
  return parsed && /^[0-9a-zA-Z:_-]{8,240}$/.test(parsed) ? parsed : null
}
