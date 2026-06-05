// lib/gridex/pricing/validators.ts

export function safeNumber(v: unknown, fallback = 0): number {
  const n =
    typeof v === 'number'
      ? v
      : typeof v === 'string'
      ? Number(v)
      : NaN
  return Number.isFinite(n) ? n : fallback
}

export function assertPositiveKwh(kwh: number): void {
  if (!Number.isFinite(kwh) || kwh <= 0) {
    throw new Error('kWh måste vara ett positivt tal.')
  }
}

export function clampVatRate(v: number): number {
  if (!Number.isFinite(v)) return 0.25
  // future safe: allow 0..1
  if (v < 0) return 0
  if (v > 1) return 1
  return v
}

function getMonthPartsInTimeZone(
  now: Date,
  timeZone: string
): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(now)

  const year = Number(parts.find((part) => part.type === 'year')?.value)
  const month = Number(parts.find((part) => part.type === 'month')?.value)

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    const fallbackMonth = now.getMonth() + 1
    return { year: now.getFullYear(), month: fallbackMonth }
  }

  return { year, month }
}

export function prevYearMonth(
  now: Date,
  timeZone = 'Europe/Stockholm'
): { year: number; month: number } {
  const current = getMonthPartsInTimeZone(now, timeZone)
  if (current.month === 1) return { year: current.year - 1, month: 12 }
  return { year: current.year, month: current.month - 1 }
}

export function formatYearMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}
