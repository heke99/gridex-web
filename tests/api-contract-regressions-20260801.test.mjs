import { readOpsClientImplementation } from './ops-client-source.mjs'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  moveOutPayload,
  syncDocuments,
  syncFacilityData,
  syncLegalAcceptances,
  syncPowerOfAttorney,
} from '../lib/customerPortal/writeValidation.ts'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const openapi = JSON.parse(read('docs/openapi/website-integration-v1.json'))

const publicationWebhookOperation = openapi.webhooks?.contractsPublicationChanged?.post
const legacyPublicationPathOperation = openapi.paths?.['/webhooks/contracts.publication.changed']?.post
const publicationOperation = publicationWebhookOperation ?? legacyPublicationPathOperation

assert.ok(publicationOperation, 'publication webhook callback must be published')
if (publicationWebhookOperation) {
  assert.equal(
    legacyPublicationPathOperation,
    undefined,
    'OpenAPI 3.1 callbacks must not be advertised as app.gridex.se server paths',
  )
}
assert.deepEqual(
  publicationOperation.parameters
    .filter((parameter) => parameter.in === 'header' && parameter.required)
    .map((parameter) => parameter.name.toLowerCase())
    .sort(),
  ['x-gridex-delivery-id', 'x-gridex-event-id', 'x-gridex-signature', 'x-gridex-timestamp'].sort(),
  'route-specific OpenAPI must be the source of truth for required headers',
)

const webhookSchema = openapi.components.schemas.PublicationChangedWebhook
assert.deepEqual(webhookSchema.required, [
  'event_id',
  'delivery_id',
  'event_type',
  'created_at',
  'tenant_reference',
  'aggregate',
  'data',
  'contract_schema_version',
])
assert.equal(webhookSchema.properties.data.properties.revision_token.type, 'string')
assert.equal(webhookSchema.properties.aggregate.required.includes('reference'), true)
assert.equal(webhookSchema.properties.aggregate.properties.id, undefined)

const resolutionSchema = openapi.components.schemas.WebsiteEnergyAreaResolution
assert.equal(resolutionSchema.properties.grid_owner_id, undefined, 'resolver must not expose an internal grid-owner UUID')
const resolverRoute = read('app/api/checkout/energy-area/resolve/route.ts')
const energyToken = read('lib/website/energyAreaToken.ts')
const quoteValidation = read('lib/website/canonicalQuoteValidation.ts')
assert.ok(!resolverRoute.includes('grid_owner_id: resolution.grid_owner_id'))
assert.ok(!energyToken.includes('grid_owner_id: input.resolution.grid_owner_id'))
assert.ok(!quoteValidation.includes('gridOwnerId'))

const handler = read('lib/webhooks/publicationChanged.ts')
assert.ok(handler.includes('payload.aggregate.reference'))
assert.ok(handler.includes("publicationPayload.event_type !== eventTypeHeader"))
assert.ok(!handler.includes('parseGenericEnvelope'))
assert.ok(!handler.includes('aggregate.id'))
assert.ok(!handler.includes('!eventId || !eventTypeHeader'))

const tokenMigration = read('supabase/migrations/20260801192000_publication_revision_token_text.sql')
assert.match(tokenMigration, /revision_token text/)
assert.match(tokenMigration, /p_revision_token text/)
assert.doesNotMatch(tokenMigration, /p_revision_token uuid/)

assert.deepEqual(syncFacilityData({
  site_id: 'site_123',
  metering_point_id: '735999123456789012',
  move_in_date: '2026-08-15',
  street: 'Testgatan 1',
  postal_code: '211 20',
  city: 'Malmö',
}), [{
  facility_reference: 'site_123',
  metering_point_id: '735999123456789012',
  move_in_date: '2026-08-15',
  address: { street: 'Testgatan 1', postal_code: '211 20', city: 'Malmö' },
}])

assert.deepEqual(moveOutPayload({
  site_id: 'site_123',
  move_out_date: '2026-08-31',
  data: { facility_reference: 'must_not_leak' },
}), {
  facility_reference: 'site_123',
  requested_move_out_date: '2026-08-31',
})

assert.deepEqual(syncPowerOfAttorney({
  document_reference: 'poa_doc_1',
  scope: ['request_grid_data'],
  accepted: true,
  accepted_at: '2026-08-01T18:00:00.000Z',
}), {
  document_reference: 'poa_doc_1',
  scope: ['request_grid_data'],
  accepted: true,
  accepted_at: '2026-08-01T18:00:00.000Z',
})

assert.equal(syncLegalAcceptances([{
  document_reference: 'terms_doc_1',
  document_code: 'terms',
  document_version: 'v1',
  document_hash: 'a'.repeat(64),
  accepted: true,
  accepted_at: '2026-08-01T18:00:00.000Z',
}]).length, 1)
assert.deepEqual(syncDocuments([{
  external_document_id: 'invoice_doc_1',
  document_type: 'invoice',
  file_url: 'https://example.com/document.pdf',
}]), [{
  document_reference: 'invoice_doc_1',
  document_type: 'invoice',
  secure_url: 'https://example.com/document.pdf',
}])

const client = readOpsClientImplementation()
const syncSection = client.slice(client.indexOf('export async function submitOpsCustomerSync'), client.indexOf('export async function submitOpsCustomerPortalSync'))
assert.ok(syncSection.includes('facility_data: input.facilityData'))
assert.ok(syncSection.includes('power_of_attorney: input.powerOfAttorney'))
assert.ok(syncSection.includes('legal_acceptances: input.legalAcceptances'))
assert.ok(syncSection.includes('documents: input.documents'))
assert.ok(!syncSection.includes('data: {'))

const moveOutSection = client.slice(client.indexOf('export async function submitOpsCustomerMoveOut'), client.indexOf('function createCustomerEventIdempotencyKey'))
assert.ok(moveOutSection.includes('facility_reference: facilityReference'))
assert.ok(moveOutSection.includes('requested_move_out_date: requestedMoveOutDate'))
assert.ok(!moveOutSection.includes('data: moveOutData'))

const snapshotStore = read('lib/website/publicContractSnapshotStore.ts')
for (const invariant of ['organizationReference', 'contractVersion', 'parserVersion', 'schemaSha256', 'maxAgeMs']) {
  assert.ok(snapshotStore.includes(invariant), `snapshot validation must include ${invariant}`)
}
const endpoint = read('lib/website/publicContractsEndpoint.ts')
assert.ok(endpoint.includes('!snapshot.stale'))
const fallbackFunction = client.slice(client.indexOf('function publicContractsFallbackEligible'), client.indexOf('async function persistentPublicContractsCacheEntry'))
assert.ok(fallbackFunction.includes('if (!isOpsError(error)) return false'))
assert.ok(fallbackFunction.includes('return isTransientOpsError(error)'))

const form = read('components/signup/CustomerApplicationForm.tsx')
const signup = read('app/(public)/teckna-avtal/page.tsx')
assert.ok(!form.includes('/api/checkout/legal-bundle'))
assert.ok(!signup.includes('fetchOpsWebsiteLegalBundle'))
assert.ok(form.includes('selectedContract.legal'))
assert.ok(signup.includes('offer.legal'))
assert.ok(!signup.includes('grid_owner_id: verifiedQuote.value.area.gridOwnerId'))

const contractsPage = read('app/(public)/elavtal/page.tsx')
const homePage = read('app/(public)/page.tsx')
assert.ok(contractsPage.includes('feed_loaded_with_blocked_contracts'))
assert.ok(contractsPage.includes('Supportreferens:'))
assert.ok(homePage.includes('Supportreferens:'))
const displaySource = read('lib/website/publicContractDisplay.ts')
assert.ok(displaySource.includes('onlineReady'))
assert.ok(!displaySource.includes('dokumentlänk saknas för digital teckning'))
assert.ok(displaySource.includes('document_url/public_url is explicitly nullable'))
assert.ok(contractsPage.includes('display.onlineReady'))

console.log('2026-08-01 canonical API regression tests passed')
