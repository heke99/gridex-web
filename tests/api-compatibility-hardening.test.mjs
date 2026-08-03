import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

const contract = read('lib/ops/contract.ts')
const client = read('lib/ops/client.ts')
const transport = read('lib/ops/transport.ts')
const validators = read('lib/ops/validators/openapi.ts')
const readiness = read('lib/ops/readiness.ts')
const signup = read('app/(public)/teckna-avtal/page.tsx')
const marketRoute = read('app/api/web/market-price/current/route.ts')
const portfolioRoute = read('app/api/web/portfolio-prices/route.ts')
const webhookParser = read('lib/webhooks/opsWebhook.ts')
const webhookHandler = read('lib/webhooks/publicationChanged.ts')
const webhookRetry = read('lib/webhooks/retry.ts')
const webhookMigration = read('supabase/migrations/20260729131000_ops_webhook_domain_projections.sql')
const verification = JSON.parse(read('docs/openapi/verification-status.json'))
const releaseManifest = JSON.parse(read('docs/openapi/release-manifest.json'))
const websiteOpenApi = JSON.parse(read('docs/openapi/website-integration-v1.json'))
const canonicalQuoteValidation = read('lib/website/canonicalQuoteValidation.ts')
const stagingFlow = read('tests/staging-canonical-ops-flow.mjs')

assert.ok(contract.includes(`GRIDEX_API_CONTRACT_VERSION = '${releaseManifest.release_version}'`), 'canonical API version must match the synchronized release')
assert.ok(!contract.includes('2026-07-28.1'), 'old version must not remain in canonical contract')

assert.match(client, /opsRequest as transportOpsRequest/, 'client must use canonical transport')
assert.match(client, /return transportOpsRequest\(path, init, options\)/, 'all client requests must funnel through canonical transport')
assert.equal((client.match(/async function opsRequest\(/g) ?? []).length, 1, 'client may only expose one thin transport wrapper')
assert.match(transport, /redirect:\s*['"]manual['"]/, 'transport must inspect redirects without forwarding credentials')
assert.match(transport, /response\.status >= 300 && response\.status < 400/, 'transport must reject redirect responses')
assert.match(transport, /AbortSignal|AbortController/, 'transport must enforce request cancellation/timeout')

const marketStart = client.indexOf('export async function fetchOpsCurrentMarketPrice')
const marketEnd = client.indexOf('\nexport ', marketStart + 1)
const marketFunction = client.slice(marketStart, marketEnd)
assert.match(marketFunction, /assertWebsiteRequest\(['"]CurrentMarketPriceRequest['"]/, 'market request must be schema validated')
assert.match(marketFunction, /assertWebsiteResponse\(['"]CurrentMarketPriceResponse['"]/, 'market response must be schema validated')
for (const forbidden of ['reference_type ??', 'available_resolutions ??', 'stale_after ??', 'next_update_at ??', 'provider ??']) {
  assert.ok(!marketFunction.includes(forbidden), `market function must not contain fallback ${forbidden}`)
}
assert.match(marketRoute, /contract_schema_version/, 'market BFF must preserve contract metadata')
assert.match(marketRoute, /request_id/, 'market BFF must preserve request id')
assert.match(marketFunction, /market_price_stale/, 'stale current price must fail closed')

const portfolioStart = client.indexOf('export async function fetchOpsWebsitePortfolioPrices')
const portfolioEnd = client.indexOf('\nexport ', portfolioStart + 1)
const portfolioFunction = client.slice(portfolioStart, portfolioEnd)
assert.match(portfolioFunction, /historical_final_prices/, 'portfolio must read documented history node')
assert.match(portfolioFunction, /locked_settlement_only/, 'portfolio must enforce locked final settlement')
assert.ok(!portfolioFunction.includes('extractRows('), 'portfolio must not use generic row extraction')
assert.match(portfolioRoute, /historical_final_prices/, 'portfolio BFF must preserve historical prices')
assert.match(portfolioRoute, /final_billing_rule/, 'portfolio BFF must preserve billing rule')
assert.ok(!portfolioRoute.includes("price_area_code')"), 'portfolio BFF must accept only canonical price_area query input')

assert.match(signup, /customer_portal_user_id:\s*linkedAuthUserId/, 'authenticated signup must propagate verified portal identity')
assert.match(signup, /auth_user_id:\s*linkedAuthUserId/, 'authenticated signup must propagate verified auth identity')
assert.match(client, /ops_customer_application_portal_identity_contract_unsupported/, 'signup must fail closed if a future OPS schema drops identity fields')
assert.match(client, /customerPortalUserId\) !== Boolean\(authUserId\).*customerPortalUserId !== authUserId/s, 'identity fields must be equal')

assert.match(validators, /assertWebsiteOperationRequest/, 'website operation requests must be validated')
assert.match(validators, /assertWebsiteOperationResponse/, 'website operation responses must be validated')
assert.match(validators, /assertCustomerPortalOperationRequest/, 'portal operation requests must be validated')
assert.match(validators, /assertCustomerPortalOperationResponse/, 'portal operation responses must be validated')
assert.match(validators, /customer_application_portal_identity_missing/, 'known OPS identity gap must be detected')
assert.match(validators, /portfolio_response_schema_not_strict/, 'known OPS portfolio gap must be detected')
assert.match(validators, /legal_acceptances_not_dynamic/, 'known OPS legal gap must be detected')
assert.match(validators, /customer_portal_resource_schemas_not_strict/, 'permissive portal schemas must block full compatibility')
assert.match(validators, /ops_domain_webhook_schema_not_published/, 'unpublished domain webhook schemas must block full compatibility')
assert.match(client, /OPS-anropet saknar ett incheckat OpenAPI-kontrakt/, 'unknown OPS operations must fail closed')
assert.match(client, /return error\.retryable &&/, 'non-retryable schema and tenant errors must never trigger local portal fallback')

const quoteValidationSchema = websiteOpenApi.components.schemas.QuoteValidationRequest
for (const field of ['price_option_reference', 'invoice_delivery_method', 'selected_component_references', 'site_count']) {
  assert.ok(quoteValidationSchema.required.includes(field), `quote validation contract must require ${field}`)
}
const quoteValidationStart = client.indexOf('export async function validateOpsWebsiteQuote')
const quoteValidationEnd = client.indexOf('\nexport async function fetchOpsCurrentMarketPrice', quoteValidationStart)
const quoteValidationFunction = client.slice(quoteValidationStart, quoteValidationEnd)
for (const field of ['price_option_reference', 'invoice_delivery_method', 'site_count']) {
  assert.match(quoteValidationFunction, new RegExp(`${field}:\\s*input\.${field}`), `quote validation request must send ${field}`)
}
assert.match(quoteValidationFunction, /selected_component_references:\s*selectedComponentReferences/, 'quote validation request must send deduplicated selected_component_references')
assert.match(quoteValidationFunction, /ops_quote_validation_selection_mismatch/, 'quote validation must reject a changed canonical selection')
for (const field of ['price_option_reference', 'invoice_delivery_method', 'selected_component_references', 'site_count']) {
  assert.ok(canonicalQuoteValidation.includes(`${field}: local.quote.${field}`), `signed quote validation must forward ${field}`)
  assert.ok(stagingFlow.includes(`${field}: quote.${field}`), `staging flow must validate ${field}`)
}
assert.ok(!client.includes('\"switch-status\": \"/api/v1/customer/switch-status\"'), 'undocumented portal switch-status endpoint must not be called')

for (const checkName of [
  'contract_version_ready',
  'local_schema_ready',
  'live_schema_ready',
  'runtime_schema_ready',
  'openapi_sync_ready',
  'diagnostics_ready',
  'customer_application_ready',
  'portal_identity_ready',
  'portfolio_ready',
  'customer_portal_contract_ready',
  'webhook_projection_ready',
  'webhook_retry_ready',
  'database_migrations_ready',
  'staging_flow_ready',
  'tenant_isolation_ready',
  'full_api_compatibility_ready',
]) {
  assert.ok(readiness.includes(checkName), `readiness must expose ${checkName}`)
}
assert.match(readiness, /!portalIdentityGap/, 'checkout readiness must block unsupported portal identity')
assert.match(readiness, /!legalAcceptanceGap/, 'checkout readiness must block non-dynamic legal contract')
assert.match(readiness, /!priceOptionsGap/, 'checkout readiness must block unpublished price options')
assert.equal(typeof verification.live_sync_verified, 'boolean', 'verification status must expose a boolean live_sync_verified flag')
assert.equal(verification.contract_version, releaseManifest.release_version, 'verification status must retain the checked-in contract version')
assert.ok(Object.hasOwn(verification, 'verified_at'), 'verification status must always expose verified_at')
if (verification.live_sync_verified) {
  assert.equal(typeof verification.verified_at, 'string', 'verified live sync must include verified_at')
  assert.ok(verification.verified_at.length > 0, 'verified_at must not be empty for verified live sync')
}
assert.match(readiness, /normalizeOpenApiVerificationStatus\(value: unknown\)/, 'readiness must tolerate incomplete verification status JSON')
assert.match(readiness, /liveOpenApiVerified/, 'live readiness must require both sync evidence and the exact contract version')
assert.match(readiness, /const checkoutReady =[\s\S]*liveOpenApiVerified/, 'website sales must remain blocked until exact live OpenAPI sync is verified')
assert.match(readiness, /customerPortal: liveOpenApiVerified &&/, 'customer portal capability must remain blocked until exact live OpenAPI sync is verified')

for (const event of ['invoice.paid', 'invoice.disputed', 'supply.started', 'metering_values.updated', 'facility_data.verified']) {
  assert.ok(webhookParser.includes(`'${event}'`), `webhook parser must support ${event}`)
}
assert.match(webhookHandler, /apply_ops_publication_event/, 'publication changes must use the durable publication projection')
assert.match(webhookHandler, /assertWebsiteRequest/, 'publication route must validate the canonical body schema')
assert.doesNotMatch(webhookHandler, /!eventId \|\| !eventTypeHeader/, 'x-gridex-event-type must not be a required route header')
assert.match(webhookRetry, /processOpsWebhookRetries/, 'retry worker must exist')
assert.match(webhookMigration, /retryable_failure/, 'migration must persist retryable state')
assert.match(webhookMigration, /permanent_failure/, 'migration must persist permanent failure state')
assert.match(webhookMigration, /dead_letter_at/, 'migration must persist dead-letter timestamp')
assert.match(webhookMigration, /max_attempts/, 'migration must enforce retry budget')

console.log('API compatibility hardening static checks passed.')
