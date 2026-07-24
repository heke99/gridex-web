export const GRIDEX_WEBSITE_API_CONTRACT_VERSION = '2026-07-24.2' as const
export const GRIDEX_WEBSITE_API_ACCEPT_VERSION_HEADER = 'X-Gridex-Accept-Contract-Version' as const
export const GRIDEX_WEBSITE_API_VERSION_HEADER = 'X-Gridex-Contract-Version' as const
export const GRIDEX_API_BASE_URL = 'https://app.gridex.se/api/v1' as const

export const GRIDEX_WEBSITE_CHECKOUT_SCOPES = [
  'integration_context.read',
  'website_contracts.read',
  'website_contracts.diagnostics',
  'website_energy_area.resolve',
  'website_market_prices.read',
  'website_quotes.write',
  'website_quotes.validate',
  'website_applications.write',
  'website_switch_status.read',
] as const

export const GRIDEX_WEBSITE_LEGAL_SCOPE_ALTERNATIVES = [
  'website_legal.read',
  'website_contracts.read',
] as const
