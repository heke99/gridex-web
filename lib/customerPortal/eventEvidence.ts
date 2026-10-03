import { isStrictCalendarDate } from '@/lib/website/businessDate'

/** The event time is captured once by its producer and retained on every replay. */
export function customerEventOccurredAt(value: unknown): string | null {
  if (
    typeof value !== 'string' || value.length > 40 ||
    !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value) ||
    !isStrictCalendarDate(value.slice(0, 10)) || !Number.isFinite(Date.parse(value))
  ) return null
  return value
}
