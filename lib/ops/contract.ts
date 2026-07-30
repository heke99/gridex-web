export const GRIDEX_API_CONTRACT_VERSION = '2026-07-30.2' as const
export const GRIDEX_WEBSITE_API_CONTRACT_VERSION = GRIDEX_API_CONTRACT_VERSION
export const GRIDEX_WEBSITE_API_VERSION_HEADER = 'X-Gridex-Contract-Version' as const
export const GRIDEX_API_BASE_URL = 'https://app.gridex.se/api/v1' as const
export const GRIDEX_WEBSITE_OPENAPI_URL = `${GRIDEX_API_BASE_URL}/openapi/website-integration-v1.json` as const
export const GRIDEX_CUSTOMER_PORTAL_OPENAPI_URL = `${GRIDEX_API_BASE_URL}/openapi/customer-portal-v1.json` as const

export const GRIDEX_WEBSITE_CHECKOUT_SCOPES = [
  'integration_context.read',
  'website_contracts.read',
  'website_energy_area.resolve',
  'website_quotes.write',
  'website_quotes.validate',
  'website_legal.read',
  'website_applications.write',
] as const

export const GRIDEX_WEBSITE_MARKET_PRICE_SCOPE = 'website_market_prices.read' as const
export const GRIDEX_WEBSITE_SWITCH_STATUS_SCOPE = 'website_switch_status.read' as const

export const GRIDEX_WEBSITE_LEGAL_SCOPE = 'website_legal.read' as const
export const GRIDEX_WEBSITE_DIAGNOSTICS_SCOPE = 'website_contracts.diagnostics' as const
