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

