import { isStrictCalendarDate } from '@/lib/website/businessDate'

/** Calendar dates retain their day; instants are displayed in Swedish time. */
export function formatCustomerDate(value: string | null | undefined, longMonth = false): string {
  if (!value) return '—'
  const calendar = /^\d{4}-\d{2}-\d{2}$/.test(value)
  if (calendar && !isStrictCalendarDate(value)) return '—'
  const date = new Date(calendar ? `${value}T12:00:00Z` : value)
  if (!Number.isFinite(date.getTime())) return '—'
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Stockholm', year: 'numeric',
    month: longMonth ? 'long' : '2-digit', day: longMonth ? 'numeric' : '2-digit',
  }).format(date)
}

export function formatCustomerCurrency(value: number | null, currency: string): string {
  if (value === null || !Number.isFinite(value)) return 'Inväntas'
  // Preserve the amount without silently changing an invalid currency to SEK.
  try {
    return new Intl.NumberFormat('sv-SE', { style: 'currency', currency: currency || 'SEK' }).format(value)
  } catch {
    return `${new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} (valuta saknas)`
  }
}
