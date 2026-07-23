export type WebsiteCustomerType = 'private' | 'business'
export type OpsCustomerType = 'private' | 'business'

function normalize(value: string): WebsiteCustomerType | null {
  const type = value.trim().toLowerCase()
  if (['private', 'privat', 'consumer', 'household', 'person'].includes(type)) return 'private'
  if (['company', 'foretag', 'företag', 'business', 'corporate', 'organization'].includes(type)) return 'business'
  return null
}

function explicitlyBoth(value: string): boolean { return value.trim().toLowerCase() === 'both' }
export function toOpsCustomerType(value: WebsiteCustomerType): OpsCustomerType { return value }
export function fromOpsCustomerType(value: OpsCustomerType): WebsiteCustomerType { return value }
export function parseWebsiteCustomerType(value: unknown): WebsiteCustomerType | null { return typeof value === 'string' ? normalize(value) : null }
export function contractSupportsCustomerType(customerTypes: string[] | null | undefined, customerType: WebsiteCustomerType): boolean {
  if (!customerTypes?.length || customerTypes.some(explicitlyBoth)) return true
  const supported = customerTypes.map(normalize).filter((value): value is WebsiteCustomerType => value !== null)
  return supported.length > 0 && supported.includes(customerType)
}
export function customerTypeLabel(customerTypes: string[] | null | undefined): string | null {
  if (!customerTypes?.length) return null
  if (customerTypes.some(explicitlyBoth)) return 'För privatkunder och företag'
  const supported = new Set(customerTypes.map(normalize).filter((value): value is WebsiteCustomerType => value !== null))
  if (supported.size === 1 && supported.has('private')) return 'För privatkunder'
  if (supported.size === 1 && supported.has('business')) return 'För företag'
  if (supported.size === 2) return 'För privatkunder och företag'
  return null
}
