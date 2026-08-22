export const GRIDEX_API_CONTRACT_VERSION = '2026-08-22.2' as const
export const GRIDEX_WEBSITE_API_CONTRACT_VERSION = GRIDEX_API_CONTRACT_VERSION
export const GRIDEX_CUSTOMER_PORTAL_API_CONTRACT_VERSION = GRIDEX_API_CONTRACT_VERSION
export const GRIDEX_MINIMUM_TENANT_INTEGRATION_VERSION = '2026-08-22.2' as const
export const GRIDEX_WEBSITE_API_VERSION_HEADER = 'X-Gridex-Contract-Version' as const
export const GRIDEX_CANONICAL_OPS_API_URL = 'https://app.gridex.se/api/v1' as const
export const GRIDEX_OPENAPI_RELEASE_MANIFEST_URL = `${GRIDEX_CANONICAL_OPS_API_URL}/openapi/release-manifest.json` as const
export const GRIDEX_WEBSITE_OPENAPI_URL = `${GRIDEX_CANONICAL_OPS_API_URL}/openapi/website-integration-v1.json` as const
export const GRIDEX_CUSTOMER_PORTAL_OPENAPI_URL = `${GRIDEX_CANONICAL_OPS_API_URL}/openapi/customer-portal-v1.json` as const
export const GRIDEX_WEBSITE_IMMUTABLE_OPENAPI_URL = `${GRIDEX_CANONICAL_OPS_API_URL}/openapi/${GRIDEX_API_CONTRACT_VERSION}/website-integration-v1.json` as const
export const GRIDEX_CUSTOMER_PORTAL_IMMUTABLE_OPENAPI_URL = `${GRIDEX_CANONICAL_OPS_API_URL}/openapi/${GRIDEX_API_CONTRACT_VERSION}/customer-portal-v1.json` as const
export const GRIDEX_WEBSITE_OPENAPI_SHA256 = 'f89637e6138621acd7e4d25d2d7e025ce4b56a68d12b2f984b49d44adfce6dbb' as const
export const GRIDEX_CUSTOMER_PORTAL_OPENAPI_SHA256 = 'f5c8909c37a88eece134a3c4db8f885e2f1a1699c58e5fe987c5b5fa4d61caf8' as const

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
