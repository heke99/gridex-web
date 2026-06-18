export type WebsiteCustomerType = 'private' | 'company'

function normalize(value: string): WebsiteCustomerType | null {
  const type = value.trim().toLowerCase()
  if (['private', 'privat', 'consumer', 'household', 'person'].includes(type)) return 'private'
  if (['company', 'foretag', 'företag', 'business', 'corporate', 'organization'].includes(type)) return 'company'
  return null
}

export function contractSupportsCustomerType(customerTypes: string[] | null | undefined, customerType: WebsiteCustomerType): boolean {
  if (!customerTypes?.length) return true
  const supported = customerTypes.map(normalize).filter((value): value is WebsiteCustomerType => value !== null)
  return supported.length === 0 || supported.includes(customerType)
}

export function customerTypeLabel(customerTypes: string[] | null | undefined): string | null {
  if (!customerTypes?.length) return null
  const supported = new Set(customerTypes.map(normalize).filter((value): value is WebsiteCustomerType => value !== null))
  if (supported.size === 1 && supported.has('private')) return 'För privatkunder'
  if (supported.size === 1 && supported.has('company')) return 'För företag'
  return null
}
