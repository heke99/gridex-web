/** Calendar dates retain their day; instants are displayed in Swedish time. */
export function formatCustomerDate(value: string | null | undefined, longMonth = false): string {
  if (!value) return '—'
  const calendar = /^\d{4}-\d{2}-\d{2}$/.test(value)
  const date = new Date(calendar ? `${value}T12:00:00Z` : value)
  if (!Number.isFinite(date.getTime()) || (calendar && date.toISOString().slice(0, 10) !== value)) return '—'
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Stockholm', year: 'numeric',
    month: longMonth ? 'long' : '2-digit', day: longMonth ? 'numeric' : '2-digit',
  }).format(date)
}
