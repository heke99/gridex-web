import { isStrictCalendarDate } from '@/lib/website/businessDate'

export type RequestedStartMode = 'earliest_possible' | 'specific_date'

export type RequestedStartSelection =
  | { mode: 'earliest_possible'; requestedDate: null }
  | { mode: 'specific_date'; requestedDate: string }

export function parseRequestedStartMode(value: unknown): RequestedStartMode | null {
  if (value === 'earliest_possible' || value === 'specific_date') return value
  return null
}

export function parseRequestedStartSelection(input: {
  mode: unknown
  requestedDate: unknown
}):
  | { ok: true; value: RequestedStartSelection }
  | { ok: false; code: 'requested_start_mode_invalid' | 'requested_start_date_required' | 'requested_start_date_invalid' } {
  const mode = parseRequestedStartMode(input.mode)
  if (!mode) return { ok: false, code: 'requested_start_mode_invalid' }

  const requestedDate = typeof input.requestedDate === 'string' && input.requestedDate.trim()
    ? input.requestedDate.trim()
    : null

  if (mode === 'earliest_possible') {
    if (requestedDate) return { ok: false, code: 'requested_start_date_invalid' }
    return { ok: true, value: { mode, requestedDate: null } }
  }

  if (!requestedDate) return { ok: false, code: 'requested_start_date_required' }
  if (!isStrictCalendarDate(requestedDate)) {
    return { ok: false, code: 'requested_start_date_invalid' }
  }

  return { ok: true, value: { mode, requestedDate } }
}
