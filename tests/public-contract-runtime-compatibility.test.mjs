import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseOpsPublicContractsPayload } from '../lib/ops/client.ts'
import { classifyWebsitePublicContractFeedState } from '../lib/website/publicContractFeed.ts'
import { buildPublicContractsPayload } from '../lib/website/publicContractsPayload.ts'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/public-contracts.ops-verified-variable.json', import.meta.url), 'utf8'))
const parsed = parseOpsPublicContractsPayload(fixture)
assert.equal(parsed.contracts.length, 1)
assert.equal(parsed.blockedContracts.length, 0)
assert.equal(parsed.contracts[0].price_options[0].area_prices.length, 0)
assert.equal(parsed.contracts[0].price_options[0].is_default, true)
assert.equal(parsed.contracts[0].legal.legal_bundle_version_id, '00000000-0000-4000-8000-000000000001')

const extended = structuredClone(fixture)
extended.data[0].price_options[0].new_optional_metadata = { example: true }
const compatible = parseOpsPublicContractsPayload(extended)
assert.equal(compatible.contracts.length, 1)
assert.equal(compatible.blockedContracts.length, 0)
assert.ok(compatible.compatibilityIssues.some((issue) => issue.code === 'openapi_additionalProperties'))


const deprecatedOnly = structuredClone(fixture)
delete deprecatedOnly.data[0].price_options[0].is_default
const deprecatedCompatible = parseOpsPublicContractsPayload(deprecatedOnly)
assert.equal(deprecatedCompatible.contracts.length, 1)
assert.equal(deprecatedCompatible.blockedContracts.length, 0)
assert.ok(deprecatedCompatible.compatibilityIssues.some((issue) => issue.code === 'deprecated_default_alias_used'))
assert.equal(deprecatedCompatible.contracts[0].price_options[0].is_default, true)

const invalidCommercialType = structuredClone(fixture)
invalidCommercialType.data[0].price_options[0].markup = '1'
const invalidCommercial = parseOpsPublicContractsPayload(invalidCommercialType)
assert.equal(invalidCommercial.contracts.length, 0)
assert.ok(invalidCommercial.blockedContracts[0].reasons.includes('openapi_type'))

const criticalMissing = structuredClone(fixture)
delete criticalMissing.data[0].offer_reference
const blocked = parseOpsPublicContractsPayload(criticalMissing)
assert.equal(blocked.contracts.length, 0)
assert.equal(blocked.blockedContracts.length, 1)
assert.ok(blocked.blockedContracts[0].reasons.includes('missing_offer_reference'))

const snapshot = {
  contracts: parsed.contracts,
  blocked_contracts: [],
  warnings: parsed.warnings,
  compatibility_issues: parsed.compatibilityIssues,
  parser_version: '2026-08-01.1',
  schema_sha256: 'test-schema',
  etag: '"revision-56"',
  publication_revision: 56,
  tenant_reference: 'tenant_test',
  contract_version: '2026-08-01.1',
  not_modified: false,
  fetched_at: '2026-08-01T00:00:00.000Z',
  source: 'live',
  stale: false,
  stale_reason: null,
  upstream_status: 200,
  upstream_request_id: 'upstream-request-test',
  upstream_correlation_id: 'upstream-correlation-test',
}
const feed = {
  contracts: parsed.contracts,
  blockedContracts: [],
  state: classifyWebsitePublicContractFeedState(parsed.contracts.length, 0),
  snapshot,
}
const payload = buildPublicContractsPayload({
  feed,
  requestId: 'request-test',
  correlationId: 'correlation-test',
})
assert.equal(payload.data.length, 1)
assert.equal(payload.blocked_contracts.length, 0)
assert.equal(payload.meta.state, 'feed_loaded_with_contracts')
assert.equal(payload.meta.upstream_count, 1)
assert.equal(payload.data[0].price_options[0].is_default, true)
assert.equal(payload.data[0].legal.legal_bundle_version_id, '00000000-0000-4000-8000-000000000001')
assert.equal(classifyWebsitePublicContractFeedState(1, 1), 'feed_loaded_with_contracts')
assert.equal(classifyWebsitePublicContractFeedState(0, 1), 'feed_loaded_with_blocked_contracts')
assert.equal(classifyWebsitePublicContractFeedState(0, 0), 'feed_loaded_empty')

console.log('public-contract runtime compatibility tests passed')
