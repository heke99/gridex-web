import assert from 'node:assert/strict'
import {
  assertCustomerPortalOperationRequest,
  assertWebsiteOperationRequest,
} from '../lib/ops/validators/openapi.ts'

const webhookBody = {
  event_id: 'evt_publication_301',
  delivery_id: 'delivery_publication_301',
  event_type: 'contracts.publication.changed',
  created_at: '2026-08-01T18:00:00.000Z',
  tenant_reference: 'tenant_gridex',
  aggregate: {
    type: 'contract_publication',
    reference: 'publication_gridex_website',
  },
  data: {
    channel: 'website',
    publication_revision: 301,
    revision_token: 'publication_revision_301_a8f93c',
    reason: 'contracts_unpublished_by_tenant_admin',
    timestamp: '2026-08-01T18:00:00.000Z',
  },
  contract_schema_version: '2026-08-02.1',
}
const webhookHeaders = new Headers({
  'x-gridex-event-id': webhookBody.event_id,
  'x-gridex-delivery-id': webhookBody.delivery_id,
  'x-gridex-timestamp': '1785607200',
  'x-gridex-signature': `sha256=${'a'.repeat(64)}`,
})
assert.doesNotThrow(() => assertWebsiteOperationRequest(
  '/webhooks/contracts.publication.changed',
  'post',
  webhookBody,
  webhookHeaders,
))
assert.throws(() => assertWebsiteOperationRequest(
  '/webhooks/contracts.publication.changed',
  'post',
  { ...webhookBody, aggregate: { type: 'contract_publication', id: 'legacy-id' } },
  webhookHeaders,
))

const portalHeaders = new Headers({
  'x-gridex-customer-portal-user-id': '11111111-1111-4111-8111-111111111111',
  'x-gridex-auth-user-id': '22222222-2222-4222-8222-222222222222',
})
const syncBody = {
  authenticated_user_reference: '22222222-2222-4222-8222-222222222222',
  profile: { first_name: 'Test', last_name: 'Kund' },
  facility_data: [{
    facility_reference: 'facility_1',
    metering_point_id: '735999123456789012',
    move_in_date: '2026-08-15',
  }],
  power_of_attorney: {
    document_reference: 'poa_doc_1',
    scope: ['request_grid_data'],
    accepted: true,
    accepted_at: '2026-08-01T18:00:00.000Z',
  },
  legal_acceptances: [{
    document_reference: 'terms_doc_1',
    document_code: 'terms',
    document_version: 'v1',
    document_hash: 'a'.repeat(64),
    accepted: true,
    accepted_at: '2026-08-01T18:00:00.000Z',
  }],
  documents: [{
    document_reference: 'invoice_doc_1',
    document_type: 'invoice',
    secure_url: 'https://example.com/document.pdf',
  }],
}
assert.doesNotThrow(() => assertCustomerPortalOperationRequest(
  '/api/v1/customer/sync',
  'post',
  syncBody,
  portalHeaders,
))
assert.throws(() => assertCustomerPortalOperationRequest(
  '/api/v1/customer/sync',
  'post',
  { ...syncBody, data: { legal_acceptances: syncBody.legal_acceptances } },
  portalHeaders,
))

const moveOutBody = {
  authenticated_user_reference: '22222222-2222-4222-8222-222222222222',
  facility_reference: 'facility_1',
  requested_move_out_date: '2026-08-31',
}
assert.doesNotThrow(() => assertCustomerPortalOperationRequest(
  '/api/v1/customer/move-out',
  'post',
  moveOutBody,
  portalHeaders,
))
assert.throws(() => assertCustomerPortalOperationRequest(
  '/api/v1/customer/move-out',
  'post',
  {
    requested_move_out_date: '2026-08-31',
    data: { facility_reference: 'facility_1' },
  },
  portalHeaders,
))

console.log('2026-08-01 OpenAPI runtime regression tests passed')
