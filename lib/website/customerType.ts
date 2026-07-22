export type WebsiteCustomerType = 'private' | 'company'
export type OpsCustomerType = 'private' | 'business'

function normalize(value: string): WebsiteCustomerType | null {
  const type = value.trim().toLowerCase()
  if (['private', 'privat', 'consumer', 'household', 'person'].includes(type)) return 'private'
  if (['company', 'foretag', 'företag', 'business', 'corporate', 'organization'].includes(type)) return 'company'
  return null
}

function explicitlyBoth(value: string): boolean {
  return value.trim().toLowerCase() === 'both'
}

/** Single canonical boundary conversion for every request sent to OPS. */
export function toOpsCustomerType(value: WebsiteCustomerType): OpsCustomerType {
  return value === 'company' ? 'business' : 'private'
}

/** Converts an OPS customer type back to the website's UI vocabulary. */
export function fromOpsCustomerType(value: OpsCustomerType): WebsiteCustomerType {
  return value === 'business' ? 'company' : 'private'
}

export function parseWebsiteCustomerType(value: unknown): WebsiteCustomerType | null {
  return typeof value === 'string' ? normalize(value) : null
}

export function contractSupportsCustomerType(customerTypes: string[] | null | undefined, customerType: WebsiteCustomerType): boolean {
  if (!customerTypes?.length) return true
  if (customerTypes.some(explicitlyBoth)) return true
  const supported = customerTypes.map(normalize).filter((value): value is WebsiteCustomerType => value !== null)
  return supported.length > 0 && supported.includes(customerType)
}

export function customerTypeLabel(customerTypes: string[] | null | undefined): string | null {
  if (!customerTypes?.length) return null
  if (customerTypes.some(explicitlyBoth)) return 'För privatkunder och företag'
  const supported = new Set(customerTypes.map(normalize).filter((value): value is WebsiteCustomerType => value !== null))
  if (supported.size === 1 && supported.has('private')) return 'För privatkunder'
  if (supported.size === 1 && supported.has('company')) return 'För företag'
  if (supported.size === 2) return 'För privatkunder och företag'
  return null
}
