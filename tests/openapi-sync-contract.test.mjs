import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { sha, fetchManifestSpecification } from '../scripts/openapi-common.mjs'

const websiteRaw = await readFile(new URL('../docs/openapi/website-integration-v1.json', import.meta.url), 'utf8')
const portalRaw = await readFile(new URL('../docs/openapi/customer-portal-v1.json', import.meta.url), 'utf8')
const manifest = JSON.parse(await readFile(new URL('../docs/openapi/manifest.json', import.meta.url), 'utf8'))
const release = JSON.parse(await readFile(new URL('../docs/openapi/release-manifest.json', import.meta.url), 'utf8'))
const websiteTypes = await readFile(new URL('../lib/ops/generated/website-api.d.ts', import.meta.url), 'utf8')
const portalTypes = await readFile(new URL('../lib/ops/generated/customer-portal-api.d.ts', import.meta.url), 'utf8')
const website = JSON.parse(websiteRaw)
const portal = JSON.parse(portalRaw)

assert.equal(website.info.version, '2026-08-01.1')
assert.equal(portal.info.version, '2026-08-01.1')
assert.equal(website['x-contract-schema-version'], '2026-08-01.1')
assert.equal(release.release_version, '2026-08-01.1')
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
