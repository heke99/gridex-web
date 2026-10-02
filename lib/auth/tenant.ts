export function getWebCompanyId(): string | null {
  const value = process.env.GRIDEX_WEB_COMPANY_ID?.trim() ?? ''
  // An unconfigured local company grants global roles only. The OPS tenant
  // reference is a separate authority and must never be used as this scope.
  if (!value) return null
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error('GRIDEX_WEB_COMPANY_ID must identify a local authentication company.')
  }
  return value
}
