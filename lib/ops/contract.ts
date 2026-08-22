export const GRIDEX_API_CONTRACT_VERSION = '2026-08-22.1' as const
export const GRIDEX_WEBSITE_API_CONTRACT_VERSION = GRIDEX_API_CONTRACT_VERSION
export const GRIDEX_CUSTOMER_PORTAL_API_CONTRACT_VERSION = GRIDEX_API_CONTRACT_VERSION
export const GRIDEX_MINIMUM_TENANT_INTEGRATION_VERSION = '2026-08-22.1' as const
export const GRIDEX_WEBSITE_API_VERSION_HEADER = 'X-Gridex-Contract-Version' as const
export const GRIDEX_CANONICAL_OPS_API_URL = 'https://app.gridex.se/api/v1' as const
export const GRIDEX_OPENAPI_RELEASE_MANIFEST_URL = `${GRIDEX_CANONICAL_OPS_API_URL}/openapi/release-manifest.json` as const
export const GRIDEX_WEBSITE_OPENAPI_URL = `${GRIDEX_CANONICAL_OPS_API_URL}/openapi/website-integration-v1.json` as const
export const GRIDEX_CUSTOMER_PORTAL_OPENAPI_URL = `${GRIDEX_CANONICAL_OPS_API_URL}/openapi/customer-portal-v1.json` as const
export const GRIDEX_WEBSITE_IMMUTABLE_OPENAPI_URL = `${GRIDEX_CANONICAL_OPS_API_URL}/openapi/${GRIDEX_API_CONTRACT_VERSION}/website-integration-v1.json` as const
export const GRIDEX_CUSTOMER_PORTAL_IMMUTABLE_OPENAPI_URL = `${GRIDEX_CANONICAL_OPS_API_URL}/openapi/${GRIDEX_API_CONTRACT_VERSION}/customer-portal-v1.json` as const
export const GRIDEX_WEBSITE_OPENAPI_SHA256 = 'e702b5c0ed254737a3a8e97935e57b2a50270cde6d98aac55442000d4fb7a2e0' as const
export const GRIDEX_CUSTOMER_PORTAL_OPENAPI_SHA256 = '4424cc7d922a37fcd41e1f3abca7915809a49f28ac964aa9011760241efd0065' as const

export const GRIDEX_WEBSITE_CHECKOUT_SCOPES = [
  'integration_context.read',
  'website_contracts.read',
  'website_energy_area.resolve',
  'website_market_prices.read',
  'website_quotes.write',
  'website_quotes.validate',
  'website_legal.read',
  'website_applications.write',
  'website_switch_status.read',
] as const

export const GRIDEX_WEBSITE_MARKET_PRICE_SCOPE = 'website_market_prices.read' as const
export const GRIDEX_WEBSITE_SWITCH_STATUS_SCOPE = 'website_switch_status.read' as const

export const GRIDEX_WEBSITE_LEGAL_SCOPE = 'website_legal.read' as const
export const GRIDEX_WEBSITE_DIAGNOSTICS_SCOPE = 'website_contracts.diagnostics' as const
