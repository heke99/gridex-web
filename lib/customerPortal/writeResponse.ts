type WriteResult = {
  ok?: boolean
  queued?: boolean
  facilityOutcome?: string
  moveOutReceipt?: unknown
  data?: {
    ok?: boolean
    status?: string | null
    data?: { facility_updated?: boolean }
    synced?: { access_granted?: boolean } | null
  }
  error?: string | { message?: string }
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

export function readMoveOutReceipt(value: unknown, facilityReference: unknown, requestedDate: unknown) {
  if (!record(value) || value.status !== 'submitted' ||
      typeof value.completion_reference !== 'string' || !value.completion_reference.trim() ||
      value.completion_reference.length > 240 ||
      typeof facilityReference !== 'string' || value.facility_reference !== facilityReference ||
      typeof requestedDate !== 'string' || value.requested_move_out_date !== requestedDate) return null
  return {
    completion_reference: value.completion_reference,
    facility_reference: facilityReference,
    requested_move_out_date: requestedDate,
    status: 'submitted' as const,
  }
}

/** A 2xx response alone cannot confirm a customer write. */
export async function readCustomerWriteResponse(response: Response): Promise<WriteResult> {
  const value: unknown = await response.json().catch(() => null)
  const payload = record(value) ? value as WriteResult : null
  if (!response.ok) {
    const message = typeof payload?.error === 'string' ? payload.error : payload?.error?.message
    throw new Error(message || 'Åtgärden kunde inte genomföras.')
  }
  if (!payload || (typeof payload.ok !== 'boolean' &&
    !(record(payload.data) && typeof payload.data.ok === 'boolean'))) {
    throw new Error('Svaret kunde inte bekräftas. Försök igen med samma uppgifter.')
  }
  if (payload.error || payload.ok === false || ['rejected', 'failed', 'declined'].includes(payload.data?.status ?? '')) {
    throw new Error('Åtgärden kunde inte slutföras. Kontrollera uppgifterna och försök igen.')
  }
  return payload
}

export function pendingCustomerWrite(result: WriteResult): boolean {
  return Boolean(result.queued || result.data?.ok === false ||
    ['pending_review', 'processing', 'pending', 'queued'].includes(result.data?.status ?? '') ||
    result.data?.data?.facility_updated === false || result.data?.synced?.access_granted === false)
}
