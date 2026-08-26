export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

export function normalizeSwedishFacilityId(value: string): string {
  return digitsOnly(value)
}

export function isValidSwedishFacilityId(value: string): boolean {
  return /^735999\d{12}$/.test(normalizeSwedishFacilityId(value))
}

function luhn(value: string): boolean {
  if (!/^\d{10}$/.test(value)) return false
  const sum = value.split('').reduce((total, digit, index) => {
    const product = Number(digit) * (index % 2 === 0 ? 2 : 1)
    return total + (product > 9 ? product - 9 : product)
  }, 0)
  return sum % 10 === 0
}

function validCalendarDate(year: number, month: number, rawDay: number): boolean {
  const day = rawDay > 60 ? rawDay - 60 : rawDay
  if (month < 1 || month > 12 || day < 1 || day > 31) return false
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export function isValidSwedishPersonalNumber(value: string): boolean {
  const digits = digitsOnly(value)
  if (digits.length !== 10 && digits.length !== 12) return false
  const short = digits.slice(-10)
  if (!luhn(short)) return false

  const month = Number(short.slice(2, 4))
  const day = Number(short.slice(4, 6))
  if (digits.length === 12) {
    return validCalendarDate(Number(digits.slice(0, 4)), month, day)
  }

  const year = Number(short.slice(0, 2))
  return validCalendarDate(1900 + year, month, day) || validCalendarDate(2000 + year, month, day)
}

export function isValidSwedishOrganizationNumber(value: string): boolean {
  const digits = digitsOnly(value)
  return /^\d{10}$/.test(digits) && Number(digits[2]) >= 2 && luhn(digits)
}

export function normalizePhoneToE164(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const digits = digitsOnly(trimmed)
  let normalized: string
  if (trimmed.startsWith('+')) normalized = `+${digits}`
  else if (digits.startsWith('00')) normalized = `+${digits.slice(2)}`
  else if (digits.startsWith('0')) normalized = `+46${digits.slice(1)}`
  else if (digits.startsWith('46')) normalized = `+${digits}`
  else normalized = `+${digits}`
  const length = digitsOnly(normalized).length
  return length >= 7 && length <= 15 ? normalized : null
}

export function stockholmToday(): string {
  return stockholmCalendarDate()
}

export function isValidRequestedStartDate(
  mode: 'earliest_possible' | 'specific_date',
  value: string,
): boolean {
  if (mode === 'earliest_possible') return true
  return isStrictCalendarDate(value) && value >= stockholmToday()
}
import {
  isStrictCalendarDate,
  stockholmCalendarDate,
} from '@/lib/website/businessDate'
