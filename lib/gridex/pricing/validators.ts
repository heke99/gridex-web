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

export function prevYearMonth(now: Date): { year: number; month: number } {
  const m = now.getMonth() + 1
  if (m === 1) return { year: now.getFullYear() - 1, month: 12 }
  return { year: now.getFullYear(), month: m - 1 }
}