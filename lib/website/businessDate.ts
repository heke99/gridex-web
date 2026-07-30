const STOCKHOLM_TIME_ZONE = 'Europe/Stockholm'
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function stockholmCalendarDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: STOCKHOLM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}`
}

export function isStrictCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const utc = new Date(Date.UTC(year, month - 1, day))
  return utc.getUTCFullYear() === year &&
    utc.getUTCMonth() === month - 1 &&
    utc.getUTCDate() === day
}

export function requireStrictCalendarDate(
  value: unknown,
  field = 'date',
): string {
  if (!isStrictCalendarDate(value)) {
    throw new TypeError(`${field} måste vara ett verkligt kalenderdatum i formatet ÅÅÅÅ-MM-DD.`)
  }
  return value
}



export type StockholmValidityResult =
  | 'active'
  | 'not_started'
  | 'expired'
  | 'invalid'

function dateTimeBoundary(value: string): number | null {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Date-only values use Europe/Stockholm calendar semantics: valid_from starts
 * at the beginning of that local day and valid_to remains valid through the
 * end of that local day. Timestamp values retain their explicit instant.
 */
export function stockholmValidityStatus(input: {
  validFrom?: string | null
  validTo?: string | null
  now?: Date
}): StockholmValidityResult {
  const now = input.now ?? new Date()
  const today = stockholmCalendarDate(now)

  if (input.validFrom) {
    if (DATE_PATTERN.test(input.validFrom) && !isStrictCalendarDate(input.validFrom)) return 'invalid'
    if (isStrictCalendarDate(input.validFrom)) {
      if (input.validFrom > today) return 'not_started'
    } else {
      const boundary = dateTimeBoundary(input.validFrom)
      if (boundary === null) return 'invalid'
      if (boundary > now.getTime()) return 'not_started'
    }
  }

  if (input.validTo) {
    if (DATE_PATTERN.test(input.validTo) && !isStrictCalendarDate(input.validTo)) return 'invalid'
    if (isStrictCalendarDate(input.validTo)) {
      if (input.validTo < today) return 'expired'
    } else {
      const boundary = dateTimeBoundary(input.validTo)
      if (boundary === null) return 'invalid'
      if (boundary < now.getTime()) return 'expired'
    }
  }

  return 'active'
}
