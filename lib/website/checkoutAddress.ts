export const MAX_CHECKOUT_STREET_LENGTH = 180
export const CHECKOUT_STREET_TOO_LONG = `Gatuadressen får innehålla högst ${MAX_CHECKOUT_STREET_LENGTH} tecken.`

export function normalizeCheckoutStreet(value: unknown): string | null {
  const street = typeof value === 'string' ? value.trim() : ''
  return street.length <= MAX_CHECKOUT_STREET_LENGTH ? street : null
}
