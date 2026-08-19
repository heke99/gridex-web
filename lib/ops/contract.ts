export const GRIDEX_API_CONTRACT_VERSION = '2026-08-19.2' as const
export const GRIDEX_WEBSITE_API_CONTRACT_VERSION = GRIDEX_API_CONTRACT_VERSION
export const GRIDEX_CUSTOMER_PORTAL_API_CONTRACT_VERSION = GRIDEX_API_CONTRACT_VERSION
export const GRIDEX_MINIMUM_TENANT_INTEGRATION_VERSION = '2026-08-19.2' as const
export const GRIDEX_WEBSITE_API_VERSION_HEADER = 'X-Gridex-Contract-Version' as const
export const GRIDEX_CANONICAL_OPS_API_URL = 'https://app.gridex.se/api/v1' as const
export const GRIDEX_OPENAPI_RELEASE_MANIFEST_URL = `${GRIDEX_CANONICAL_OPS_API_URL}/openapi/release-manifest.json` as const
export const GRIDEX_WEBSITE_OPENAPI_URL = `${GRIDEX_CANONICAL_OPS_API_URL}/openapi/website-integration-v1.json` as const
export const GRIDEX_CUSTOMER_PORTAL_OPENAPI_URL = `${GRIDEX_CANONICAL_OPS_API_URL}/openapi/customer-portal-v1.json` as const
export const GRIDEX_WEBSITE_IMMUTABLE_OPENAPI_URL = `${GRIDEX_CANONICAL_OPS_API_URL}/openapi/${GRIDEX_API_CONTRACT_VERSION}/website-integration-v1.json` as const
export const GRIDEX_CUSTOMER_PORTAL_IMMUTABLE_OPENAPI_URL = `${GRIDEX_CANONICAL_OPS_API_URL}/openapi/${GRIDEX_API_CONTRACT_VERSION}/customer-portal-v1.json` as const
export const GRIDEX_WEBSITE_OPENAPI_SHA256 = '0cf1141657063a86266737ce658518e14456ed8a19c6e32590aeb6efa22cce17' as const
export const GRIDEX_CUSTOMER_PORTAL_OPENAPI_SHA256 = '9601ec30bfb47632f2cced96281211a669d5a8cdd5309a839d547d7352e6b0e6' as const

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
