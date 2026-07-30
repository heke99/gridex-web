import { readFile } from 'node:fs/promises'

const allowUpstreamGaps = process.argv.includes('--allow-upstream-gaps')
const website = JSON.parse(await readFile('docs/openapi/website-integration-v1.json', 'utf8'))
const portal = JSON.parse(await readFile('docs/openapi/customer-portal-v1.json', 'utf8'))
const contract = await readFile('lib/ops/contract.ts', 'utf8')
const verification = JSON.parse(await readFile('docs/openapi/verification-status.json', 'utf8'))
const expected = contract.match(/GRIDEX_API_CONTRACT_VERSION = ['"]([^'"]+)['"]/)?.[1]
if (!expected) throw new Error('Canonical contract version is missing.')
if (website.info?.version !== expected || portal.info?.version !== expected) {
  throw new Error(`Mixed API versions: code=${expected}, website=${website.info?.version}, portal=${portal.info?.version}`)
}

const gaps = []
const applicationProperties = website.components?.schemas?.CustomerApplicationRequest?.properties ?? {}
if (!applicationProperties.customer_portal_user_id || !applicationProperties.auth_user_id) {
  gaps.push('customer_application_portal_identity_missing')
}
const legalSchema = website.components?.schemas?.LegalAcceptances
if (legalSchema?.type === 'object' && legalSchema?.additionalProperties === false) {
  gaps.push('legal_acceptances_not_dynamic')
}
const publicContract = website.components?.schemas?.PublicContract
const publicContractPricing = publicContract?.properties?.pricing
if (
  !publicContract?.properties?.price_options &&
  !publicContractPricing?.properties?.price_options
) {
  gaps.push('public_contract_price_options_not_published')
}
const portfolioSchema = website.paths?.['/api/v1/website/portfolio-prices']?.get?.responses?.['200']?.content?.['application/json']?.schema
if (portfolioSchema?.additionalProperties !== false || !portfolioSchema?.properties?.data) {
  gaps.push('portfolio_response_schema_not_strict')
}
const quoteValidationResponse = website.paths?.['/api/v1/website/quote/validate']?.post?.responses?.['200']?.content?.['application/json']?.schema
if (quoteValidationResponse?.additionalProperties === true) gaps.push('website_quote_validation_response_not_strict')
const customerEvents = website.paths?.['/api/v1/website/customer-events']?.post
if (
  customerEvents?.requestBody?.content?.['application/json']?.schema?.additionalProperties === true ||
  customerEvents?.responses?.['200']?.content?.['application/json']?.schema?.additionalProperties === true
) gaps.push('website_customer_events_schema_not_strict')
const portalSync = portal.paths?.['/api/v1/customer-portal/sync']?.post
const syncRequest = portalSync?.requestBody?.content?.['application/json']?.schema
const syncResponse = portalSync?.responses?.['200']?.content?.['application/json']?.schema
if (syncRequest?.additionalProperties !== false) gaps.push('customer_portal_sync_request_not_strict')
if (JSON.stringify(syncResponse).includes('CustomerInvoice')) gaps.push('customer_portal_sync_response_is_invoice_list')
const portalHeaderNames = new Set(Object.values(portal.paths ?? {})
  .flatMap((item) => Object.values(item ?? {}))
  .flatMap((operation) => Array.isArray(operation?.parameters) ? operation.parameters : [])
  .filter((parameter) => parameter?.in === 'header' && typeof parameter.name === 'string')
  .map((parameter) => parameter.name.toLowerCase()))
if (!portalHeaderNames.has('x-gridex-customer-portal-user-id') || !portalHeaderNames.has('x-gridex-auth-user-id')) {
  gaps.push('customer_portal_identity_headers_missing')
}
const permissivePortalSchema = Object.entries(portal.paths ?? {}).some(([path, item]) => {
  if (path.includes('/openapi/') || path === '/api/v1/integration/context') return false
  return Object.entries(item ?? {}).some(([method, operation]) => {
    if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) return false
    const request = operation?.requestBody?.content?.['application/json']?.schema
    const response = operation?.responses?.['200']?.content?.['application/json']?.schema
    const isPermissive = (schema) => schema?.type === 'object' && (
      schema.additionalProperties === true ||
      (schema.additionalProperties !== false && Object.keys(schema.properties ?? {}).length === 0)
    )
    return isPermissive(request) || isPermissive(response)
  })
})
if (permissivePortalSchema) gaps.push('customer_portal_resource_schemas_not_strict')
const webhookEnvelope = website.components?.schemas?.OpsDomainWebhookEnvelope
if (
  webhookEnvelope?.type !== 'object' ||
  webhookEnvelope?.additionalProperties !== false
) {
  gaps.push('ops_domain_webhook_schema_not_published')
}

const oldVersionMatches = []
for (const file of [
  'lib/ops/contract.ts',
  'docs/openapi/website-integration-v1.json',
  'docs/openapi/customer-portal-v1.json',
  'lib/ops/generated/website-api.d.ts',
  'lib/ops/generated/customer-portal-api.d.ts',
]) {
  const source = await readFile(file, 'utf8')
  if (source.includes('2026-07-28.1')) oldVersionMatches.push(file)
}
if (oldVersionMatches.length) throw new Error(`Stale contract version remains in: ${oldVersionMatches.join(', ')}`)

const environmentBlockers = []
if (verification.live_sync_verified !== true || verification.contract_version !== expected) {
  environmentBlockers.push('live_openapi_sync_not_verified')
}
console.log(JSON.stringify({ contract_version: expected, upstream_contract_gaps: gaps, environment_blockers: environmentBlockers }, null, 2))
if ((gaps.length || environmentBlockers.length) && !allowUpstreamGaps) {
  throw new Error(`Full API compatibility is blocked: ${[...gaps, ...environmentBlockers].join(', ')}`)
}
