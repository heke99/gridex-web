import { readOpsClientImplementation } from './ops-client-source.mjs'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const website = JSON.parse(read('docs/openapi/website-integration-v1.json'))
const portal = JSON.parse(read('docs/openapi/customer-portal-v1.json'))
const release = JSON.parse(read('docs/openapi/release-manifest.json'))
const client = readOpsClientImplementation()
const snapshotStore = read('lib/website/publicContractSnapshotStore.ts')
const browserPayload = read('lib/website/publicContractsPayload.ts')
const pricingQuote = read('lib/website/pricingQuote.ts')
const canonicalQuoteValidation = read('lib/website/canonicalQuoteValidation.ts')
const migration = read('supabase/migrations/20260802223000_public_contract_canonical_empty_proof.sql')
const quoteExpiryMigration = read('supabase/migrations/20260802224500_restore_canonical_quote_expiry.sql')

assert.match(release.release_version, /^\d{4}-\d{2}-\d{2}\.\d+$/)
assert.match(release.minimum_tenant_integration_version, /^\d{4}-\d{2}-\d{2}\.\d+$/)
assert.equal(typeof release.compatibility_classification, 'string')
assert.ok(release.compatibility_classification.length > 0)
assert.equal(release.specifications.website.sha256, sha256(read('docs/openapi/website-integration-v1.json')))
assert.equal(release.specifications.customer_portal.sha256, sha256(read('docs/openapi/customer-portal-v1.json')))
assert.equal(website.info.version, release.release_version)
assert.equal(portal.info.version, release.release_version)
assert.equal(website['x-contract-schema-version'], release.release_version)
assert.equal(portal['x-contract-schema-version'], release.release_version)

const publicFeedSchema = website.paths['/api/v1/website/public-contracts'].get.responses['200']
  .content['application/json'].schema
const meta = publicFeedSchema.properties.meta
assert.equal(publicFeedSchema.additionalProperties, false)
assert.ok(publicFeedSchema.required.includes('data'))
assert.ok(publicFeedSchema.required.includes('contracts'))
assert.ok(publicFeedSchema.required.includes('meta'))
assert.ok(meta.required.includes('feed_state'))
assert.ok(meta.required.includes('empty_feed_authorization'))
assert.deepEqual(meta.properties.feed_state.enum, ['contracts_present', 'canonical_empty'])
const emptyAuthorizationProperty = meta.properties.empty_feed_authorization
const proof = Array.isArray(emptyAuthorizationProperty.oneOf)
  ? emptyAuthorizationProperty.oneOf.find((value) => value.type === 'object')
  : emptyAuthorizationProperty
assert.ok(proof)
assert.ok(proof.type === 'object' || (Array.isArray(proof.type) && proof.type.includes('object')))
assert.equal(proof.additionalProperties, false)
assert.equal(proof.properties.authorized.const, true)
assert.equal(proof.properties.canonical_source.const, 'canonical_public_contract_delivery_readiness_v')
assert.deepEqual(proof.properties.reason.enum, [
  'no_canonical_publications',
  'canonical_unpublished_or_archived',
  'publication_validity_ended',
  'canonical_no_visible_contracts',
])

const quote = website.components.schemas.WebsiteQuoteData
const quoteValidation = website.components.schemas.WebsiteQuoteValidationData
assert.ok(quote.required.includes('valid_until'))
assert.equal(quote.properties.valid_until.format, 'date-time')
assert.ok(quoteValidation.required.includes('valid_until'))
assert.equal(website.paths['/api/v1/website/quote/validate'].post.responses['422'].description, 'Quote expired or no longer valid')

const legal = website.components.schemas.WebsiteLegalBlock
assert.ok(legal.required.includes('power_of_attorney_version_id'))
assert.deepEqual(legal.properties.power_of_attorney_version_id.type, ['string', 'null'])
assert.equal(legal.properties.power_of_attorney_version_id.format, 'uuid')

assert.match(client, /canonicalSha256\(root\.contracts\) !== canonicalSha256\(rows\)/)
assert.match(client, /meta\.channel !== 'website' \|\| meta\.api_version !== 'v1'/)
assert.match(client, /ops_public_contracts_contract_version_sources_mismatch/)
assert.match(client, /startsWith\('ops_public_contracts_'\).*error\.status >= 500/)
assert.match(client, /feedMetadata\.feedState === 'canonical_empty'/)
assert.match(client, /persistenceResult\?\.stored !== true/)
assert.match(client, /normalizeStableExternalCustomerId/)
assert.match(client, /headers\.set\("x-gridex-customer-portal-user-id", identity\.userId\)/)
assert.match(client, /headers\.set\("x-gridex-auth-user-id", identity\.userId\)/)
assert.match(client, /customer_portal_user_id: input\.identity\.userId/)
assert.match(client, /auth_user_id: input\.identity\.userId/)
assert.match(client, /external_customer_id: externalCustomerId/)

assert.match(snapshotStore, /parseEmptyFeedAuthorization/)
assert.match(snapshotStore, /p_feed_state: input\.snapshot\.feed_state/)
assert.match(snapshotStore, /p_empty_feed_authorization: input\.snapshot\.empty_feed_authorization/)
assert.match(browserPayload, /feed_state: snapshot\.feed_state/)
assert.match(browserPayload, /empty_feed_authorization: snapshot\.empty_feed_authorization/)
assert.match(pricingQuote, /const CURRENT_TOKEN_VERSION = "v7"/)
assert.match(pricingQuote, /Date\.parse\(parsed\.valid_until\) <= now\.getTime\(\)/)
assert.match(canonicalQuoteValidation, /quote_valid_until_changed/)
assert.match(canonicalQuoteValidation, /quote_expired/)
assert.match(quoteExpiryMigration, /website_pricing_snapshots_valid_until_required_chk/)
assert.match(quoteExpiryMigration, /drop function if exists public\.run_non_expiring_quote_backfill/)

assert.match(migration, /feed_state text/)
assert.match(migration, /empty_feed_authorization jsonb/)
assert.match(migration, /canonical_empty requires the exact authenticated empty-feed authorization object/)
assert.match(migration, /p_empty_feed_authorization - array/)
assert.match(migration, /revoke all on function .* from public, anon, authenticated/s)
assert.match(migration, /grant execute .* to service_role/s)

const portalSync = portal.paths['/api/v1/customer-portal/sync'].post
const requiredPortalHeaders = portalSync.parameters
  .filter((parameter) => parameter.in === 'header' && parameter.required)
  .map((parameter) => parameter.name.toLowerCase())
assert.ok(requiredPortalHeaders.includes('x-gridex-customer-portal-user-id'))
assert.ok(requiredPortalHeaders.includes('x-gridex-auth-user-id'))
assert.deepEqual(portalSync.requestBody.content['application/json'].schema.required, [
  'external_customer_id',
  'customer_portal_user_id',
  'auth_user_id',
])

console.log('2026-08-02 Gridex API contract regressions passed')
