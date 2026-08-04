import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { sha, fetchManifestSpecification } from '../scripts/openapi-common.mjs'

const websiteRaw = await readFile(new URL('../docs/openapi/website-integration-v1.json', import.meta.url), 'utf8')
const portalRaw = await readFile(new URL('../docs/openapi/customer-portal-v1.json', import.meta.url), 'utf8')
const manifest = JSON.parse(await readFile(new URL('../docs/openapi/manifest.json', import.meta.url), 'utf8'))
const release = JSON.parse(await readFile(new URL('../docs/openapi/release-manifest.json', import.meta.url), 'utf8'))
const websiteTypes = await readFile(new URL('../lib/ops/generated/website-api.d.ts', import.meta.url), 'utf8')
const portalTypes = await readFile(new URL('../lib/ops/generated/customer-portal-api.d.ts', import.meta.url), 'utf8')
const syncScript = await readFile(new URL('../scripts/sync-openapi.mjs', import.meta.url), 'utf8')
const website = JSON.parse(websiteRaw)
const portal = JSON.parse(portalRaw)

assert.equal(website.info.version, release.release_version)
assert.equal(portal.info.version, release.release_version)
assert.equal(website['x-contract-schema-version'], release.release_version)
assert.equal(portal['x-contract-schema-version'], release.release_version)
assert.equal(release.website_openapi_version, release.release_version)
assert.equal(release.customer_portal_openapi_version, release.release_version)
assert.equal(release.runtime_contract_version, release.release_version)
assert.equal(manifest.contract_version, release.release_version)
assert.equal(manifest.specifications['website-integration-v1.json'].sha256, sha(websiteRaw))
assert.equal(manifest.specifications['customer-portal-v1.json'].sha256, sha(portalRaw))
assert.match(websiteTypes, new RegExp(`Contract version: ${release.release_version.replaceAll('.', '\\.')}`))
assert.match(websiteTypes, new RegExp(`Source SHA-256: ${sha(websiteRaw)}`))
assert.match(portalTypes, new RegExp(`Contract version: ${release.release_version.replaceAll('.', '\\.')}`))
assert.match(portalTypes, new RegExp(`Source SHA-256: ${sha(portalRaw)}`))
assert.match(syncScript, /GRIDEX_WEBSITE_OPENAPI_SHA256/)
assert.match(syncScript, /GRIDEX_CUSTOMER_PORTAL_OPENAPI_SHA256/)
assert.match(syncScript, /websiteSpecification\.sha256/)
assert.match(syncScript, /portalSpecification\.sha256/)
assert.match(syncScript, /GRIDEX_MINIMUM_TENANT_INTEGRATION_VERSION/)
assert.match(syncScript, /releaseManifest\.minimum_tenant_integration_version/)

const priceOption = website.components.schemas.ContractPriceOption
assert.ok(priceOption.required.includes('is_default'))
assert.ok(priceOption.required.includes('default'))
assert.equal(priceOption.properties.is_default.type, 'boolean')
assert.equal(priceOption.properties.default.deprecated, true)
assert.equal(priceOption.properties.area_prices.type, 'array')
assert.equal(priceOption.properties.area_prices.minItems, undefined)

const legal = website.components.schemas.WebsiteLegalBlock
assert.ok(legal.required.includes('legal_bundle_version_id'))
assert.ok(legal.required.includes('module_versions'))
assert.ok(legal.required.includes('power_of_attorney_version_id'))

const feedMeta = website.paths['/api/v1/website/public-contracts'].get.responses['200']
  .content['application/json'].schema.properties.meta
assert.ok(feedMeta.required.includes('feed_state'))
assert.ok(feedMeta.required.includes('empty_feed_authorization'))
assert.deepEqual(feedMeta.properties.feed_state.enum, ['contracts_present', 'canonical_empty'])
const emptyAuthorizationProperty = feedMeta.properties.empty_feed_authorization
const emptyAuthorization = Array.isArray(emptyAuthorizationProperty.oneOf)
  ? emptyAuthorizationProperty.oneOf.find((candidate) => candidate.type === 'object')
  : emptyAuthorizationProperty
assert.ok(emptyAuthorization)
assert.ok(
  emptyAuthorization.type === 'object' ||
  (Array.isArray(emptyAuthorization.type) && emptyAuthorization.type.includes('object')),
)
assert.equal(emptyAuthorization.additionalProperties, false)
assert.deepEqual(emptyAuthorization.required, [
  'authorized',
  'reason',
  'publication_revision',
  'canonical_source',
  'affected_offer_references',
  'blockers',
])
const moduleSchema = website.components.schemas.LegalBundleDocument
assert.ok(moduleSchema.required.includes('legal_bundle_version_id'))

const invalidDocument = JSON.stringify({ openapi: '3.1.0', info: { version: 'test' }, paths: { '/test': {} } })
await assert.rejects(
  fetchManifestSpecification({
    url: `data:application/json,${encodeURIComponent(invalidDocument)}`,
    sha256: '0'.repeat(64),
  }),
  /SHA-256 mismatch/,
)

console.log('openapi sync contract tests passed')
