import assert from 'node:assert/strict'
import { normalizeCanonicalCustomerResource, portalIdentityFromProfile } from '../lib/customerPortal/service.ts'
import { canonicalResourceRows, unwrapOpsData } from '../lib/customerPortal/resourceData.ts'
import { customerApiErrorResponse } from '../lib/customerPortal/apiErrors.ts'
import { assertCustomerAccountActive } from '../lib/customerPortal/accountAccess.ts'
import { facilityUpdatePayload, profilePayload, syncPowerOfAttorney } from '../lib/customerPortal/writeValidation.ts'
import { OpsError } from '../lib/ops/errors.ts'
import { customerEventOccurredAt } from '../lib/customerPortal/eventEvidence.ts'
import { getVerifiedOpsIntegrationContext } from '../lib/ops/client/core.ts'
import {
  opsCustomerFetch, submitOpsCustomerPortalSync, submitOpsCustomerSync,
  submitOpsCustomerProfileUpdate, submitOpsCustomerMoveOut, sendOpsCustomerEvent, markOpsCustomerNotificationsRead,
  normalizePortalBundle,
  mapCustomerWriteResult,
} from '../lib/ops/client/portal.ts'
import { GRIDEX_WEBSITE_API_CONTRACT_VERSION as version } from '../lib/ops/contract.ts'

process.env.GRIDEX_API_KEY = 'gridex_live_tenant_runtime_A'
process.env.GRIDEX_OPS_API_URL = 'https://app.gridex.se/api/v1'
process.env.VERCEL_ENV = 'production'
const originalFetch = globalThis.fetch
const userId = '11111111-1111-4111-8111-111111111111'
const user = { id: userId, email: 'verified@example.test', user_metadata: {
  customer_number: 'DX-ATTACKER', external_customer_id: 'external-attacker', role: 'super_admin',
} }

const envelope = (data) => ({ data, request_id: 'request_test', contract_schema_version: version })
const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json', 'X-Gridex-Contract-Version': version },
})
function context(organization) {
  return {
    organization_reference: organization, api_client_reference: `api_client_${organization}`,
    authoritative_identity: 'api_key', api_version: 'v1', contract_version: version,
    configuration: {
      required_environment_variables: ['GRIDEX_API_KEY'], api_base_url: 'https://app.gridex.se/api/v1',
      authentication: { header: 'Authorization', scheme: 'Bearer', server_side_only: true },
      openapi_url: 'https://app.gridex.se/api/v1/openapi/website-integration-v1.json',
      customer_portal_openapi_url: 'https://app.gridex.se/api/v1/openapi/customer-portal-v1.json',
      application_reference_location: 'top_level',
    },
    capabilities: {
      website_checkout_ready: true, customer_portal_ready: true, complete_integration_ready: true,
      missing_website_scopes: [], missing_customer_portal_scopes: [], missing_recommended_scopes: [],
    },
  }
}

try {
  for (const status of ['active', null, undefined]) assertCustomerAccountActive(status)
  for (const status of ['disabled', 'suspended', 'deleted', 'pending', '']) {
    assert.throws(() => assertCustomerAccountActive(status), (error) => error.code === 'customer_account_disabled' && error.status === 403)
  }
  assert.deepEqual(profilePayload({ first_name: null, phone: null }), { first_name: '', phone: '' })
  const poa = syncPowerOfAttorney({
    document_reference: 'poa_document', scope: ['supplier_switch', 'facility_information_lookup'],
    accepted_at: '2026-10-02T12:00:00.000Z', signer_name: 'API Kund',
    signer_identity_number: '199001011234', method: 'web',
  })
  assert.equal(poa.signer_name, 'API Kund')
  assert.equal(poa.signer_identity_number, '199001011234')
  assert.equal(poa.method, 'web')
  assert.equal(syncPowerOfAttorney({ ...poa, scope: ['request_grid_data'] }), null)
  assert.deepEqual(portalIdentityFromProfile(user, null), {
    userId, email: user.email, customerNumber: null, externalCustomerId: null,
  }, 'editable auth metadata never selects a customer or grants a role')
  const upstreamProfile = {
    first_name: 'API', last_name: 'Kund', full_name: 'Auktoritativ kund',
    email: 'canonical@example.test', language_code: 'en', timezone: 'Europe/London',
  }
  const profile = normalizeCanonicalCustomerResource('me', { profile: upstreamProfile }, {
    localProfile: { full_name: 'Stale local name' }, user, detail: false,
  })
  assert.equal(profile.full_name, upstreamProfile.full_name)
  assert.equal(profile.email, upstreamProfile.email)
  assert.equal(profile.language_code, 'en')
  assert.equal(profile.timezone, 'Europe/London')
  assert.deepEqual(canonicalResourceRows({ invoices: null }, 'invoices'), [])
  assert.deepEqual(canonicalResourceRows({ contracts: [] }, 'contracts'), [])
  assert.deepEqual(canonicalResourceRows(unwrapOpsData(envelope({ profile: upstreamProfile })), 'profile'), [upstreamProfile])

  // Populated public DTOs from OPS release 472d703e7580fdaa49374f4d7aa202da74751057,
  // rather than fixtures shaped like Web's historical local database rows.
  const mapped = (resource, value) => normalizeCanonicalCustomerResource(resource, value, { localProfile: null, user, detail: false })
  const siteDto = { facility_reference: 'facility_canonical', facility_id: '7359991234567890',
    address: { street: 'Gatan 1', postal_code: '12345', city: 'Stockholm', country: 'SE' },
    price_area: 'SE3', grid_area_code: 'STH', status: 'active' }
  const meterDto = { facility_reference: siteDto.facility_reference, metering_point_reference: 'meter_canonical',
    metering_point_id: '735999000000000001', verification_status: 'verified' }
  const site = mapped('sites', { sites: [siteDto], metering_points: [meterDto] })[0]
  assert.equal(site.id, siteDto.facility_reference)
  assert.equal(site.facility_reference, siteDto.facility_reference)
  assert.equal(site.address, siteDto.address.street)
  assert.equal(site.postal_code, siteDto.address.postal_code)
  assert.equal(site.city, siteDto.address.city)
  assert.equal(site.metering_point_id, meterDto.metering_point_id)
  assert.equal(site.verification_status, 'verified')
  assert.equal(mapped('sites', [siteDto])[0].metering_point_id, null, 'granular sites never invent a physical metering identity')
  assert.throws(() => mapped('sites', [{ id: 'internal-db-id', site_reference: 'legacy-alias' }]), /facility_reference/)
  const docDto = { document_reference: 'document_canonical', title: 'Villkor', document_type: 'terms',
    secure_url: 'https://documents.gridex.se/terms.pdf', version: '2026.4', created_at: '2026-10-02T12:00:00Z' }
  assert.equal(mapped('documents', [docDto])[0].download_url, docDto.secure_url)
  assert.equal(mapped('documents', [docDto])[0].version, docDto.version)
  for (const secure_url of ['javascript:alert(1)', 'http://unsafe.test/a.pdf', 'https://user:secret@files.test/a.pdf']) {
    assert.equal(mapped('documents', [{ ...docDto, secure_url }])[0].download_url, null)
  }
  const noticeDto = { notification_reference: 'notification_canonical', type: 'contract_status', title: 'Avtalet är aktivt',
    message: 'Dina uppgifter är klara.', severity: 'info', status: 'read', read_at: '2026-10-02T13:00:00Z' }
  const notice = mapped('notifications', [noticeDto])[0]
  assert.equal(notice.body, noticeDto.message)
  assert.equal(notice.category, noticeDto.type)
  assert.equal(notice.priority, noticeDto.severity)
  assert.equal(notice.is_read, true)
  assert.equal(notice.read_at, noticeDto.read_at)
  assert.equal(mapped('notifications', [{ ...noticeDto, status: 'unread', read_at: null }])[0].is_read, false)
  assert.equal(mapped('legal-acceptances', [{ acceptance_reference: 'acceptance_canonical',
    acceptance_type: 'terms', document_version: '2026.4', accepted_at: '2026-10-02T12:00:00Z' }])[0].version, '2026.4')
  const poaDto = { power_of_attorney_reference: 'poa_canonical', scope: 'supplier_switch', status: 'active',
    signed_at: '2026-10-02T12:00:00Z', accepted_at: null, valid_to: '2027-10-02' }
  assert.equal(mapped('powers-of-attorney', [poaDto])[0].accepted_at, poaDto.signed_at)
  assert.equal(mapped('powers-of-attorney', [poaDto])[0].valid_until, poaDto.valid_to)
  const bundle = normalizePortalBundle(envelope({ profile: upstreamProfile, sites: [siteDto], metering_points: [meterDto],
    bundle_status: { status: 'partial', complete: true, unavailable_sections: ['invoices', 'notifications'], warnings: [] } }))
  assert.deepEqual(bundle.meteringPoints, [meterDto])
  assert.deepEqual(bundle.unavailableSections, ['invoices', 'notifications'], 'partial 200 preserves unavailable reads rather than reporting complete empty resources')
  for (const [status, expected] of [['accepted', true], ['submitted', true], ['rejected', false], ['pending_review', false], [null, false], ['future_unknown', false]]) {
    const result = mapCustomerWriteResult(envelope({ completion_reference: 'completion_outcome', status, profile_updated: false, facility_updated: false }))
    assert.equal(result.ok, expected, 'completion status must be interpreted, not just object presence')
    assert.equal(result.data.profile_updated, false, 'receipt of a completion does not imply applied profile fields')
    assert.equal(result.data.facility_updated, false)
  }
  const addressUpdate = { facility_reference: siteDto.facility_reference, address: { street: 'Ny gata 2', postal_code: '23456', city: 'Uppsala', country: 'SE' } }
  assert.deepEqual(facilityUpdatePayload(addressUpdate), addressUpdate)
  for (const invalid of [{ ...addressUpdate, customer_number: 'DX-ATTACKER' }, { ...addressUpdate, price_area: 'SE1' },
    { ...addressUpdate, address: { ...addressUpdate.address, grid_area_code: 'other' } },
    { ...addressUpdate, address: { ...addressUpdate.address, street: 123 } },
    { ...addressUpdate, external_request_id: 123 },
    { address: addressUpdate.address }, { facility_reference: siteDto.facility_reference, address: {} }]) {
    assert.equal(facilityUpdatePayload(invalid), null, 'address updates cannot override identity or pricing authority')
  }

  let calls = 0
  let release
  const gate = new Promise((resolve) => { release = resolve })
  globalThis.fetch = async (_url, init) => {
    calls += 1
    await gate
    const credential = new Headers(init.headers).get('authorization')
    return jsonResponse({ data: context(credential.endsWith('_A')
      ? 'organization_tenant_A_01234567890123456789' : 'organization_tenant_B_01234567890123456789') })
  }
  const parallel = Array.from({ length: 12 }, () => getVerifiedOpsIntegrationContext())
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(calls, 1, 'concurrent context requests share one credential-bound upstream request')
  release()
  const values = await Promise.all(parallel)
  assert.ok(values.every((value) => value.organization_reference === 'organization_tenant_A_01234567890123456789'))
  process.env.GRIDEX_API_KEY = 'gridex_live_tenant_runtime_B'
  assert.equal((await getVerifiedOpsIntegrationContext()).organization_reference, 'organization_tenant_B_01234567890123456789')
  assert.equal(calls, 2, 'a different credential never inherits the other organization context')

  let observedHeaders
  globalThis.fetch = async (_url, init) => {
    observedHeaders = new Headers(init.headers)
    return jsonResponse(envelope({ profile: upstreamProfile }))
  }
  await opsCustomerFetch('/api/v1/customer/me', { userId, email: user.email }, {
    headers: {
      'x-gridex-auth-user-id': '22222222-2222-4222-8222-222222222222',
      'x-gridex-customer-number': 'DX-ATTACKER',
      'x-gridex-external-customer-id': 'external-attacker',
      'x-gridex-customer-assertion': 'attacker.payload.signature',
    },
  })
  assert.equal(observedHeaders.get('x-gridex-auth-user-id'), userId)
  assert.equal(observedHeaders.get('x-gridex-customer-portal-user-id'), userId)
  assert.equal(observedHeaders.get('x-gridex-customer-number'), null)
  assert.equal(observedHeaders.get('x-gridex-external-customer-id'), null)
  assert.equal(observedHeaders.get('x-gridex-customer-assertion'), null)

  for (const [status, accessGranted, expected] of [
    ['linked', true, true], ['linked', false, false], ['pending_review', true, false], ['rejected', true, false],
  ]) {
    globalThis.fetch = async () => jsonResponse(envelope({ status, access_granted: accessGranted }))
    const result = await submitOpsCustomerPortalSync({
      identity: { userId, email: user.email, externalCustomerId: 'external-test', customerNumber: 'DX-123' },
      idempotencyKey: 'portal-test-operation',
    })
    assert.equal(result.ok, expected, `${status}/${accessGranted} must preserve the explicit access decision`)
    assert.equal(result.requestId, 'request_test', 'sync must retain the envelope request id')
  }

  const identity = { userId, email: user.email, externalCustomerId: 'external-test', customerNumber: 'DX-123' }
  const notificationReference = 'notification_123456789012345678901234'
  const profileRequests = []
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body)
    if (String(_url).endsWith('/customer/notifications/read')) {
      assert.deepEqual(body, { notification_references: [notificationReference] })
      return jsonResponse(envelope({ updated_count: 1, notification_references: [notificationReference], read_at: '2026-10-02T12:00:00.000Z' }))
    }
    if (String(_url).endsWith('/customer/sync')) {
      return jsonResponse(envelope({ status: 'synced', customer_reference: 'customer_123', summary: {} }))
    }
    if (String(_url).endsWith('/customer/profile-update')) {
      profileRequests.push({ body: init.body, key: new Headers(init.headers).get('Idempotency-Key') })
      return jsonResponse(envelope({
        completion_reference: 'completion_profile', status: 'submitted', created_at: '2026-10-02T12:00:00.000Z',
        profile_updated: true, facility_updated: false, address_result: null,
      }))
    }
    if (String(_url).endsWith('/customer/move-out')) {
      return jsonResponse(envelope({
        completion_reference: 'completion_move_out', customer_reference: 'customer_123',
        facility_reference: body.facility_reference, requested_move_out_date: body.requested_move_out_date,
        status: 'submitted', replayed: false,
      }))
    }
    return jsonResponse(envelope({
      event_resource_reference: 'event_123456789012345678901234', customer_reference: 'customer_123',
      event_reference: body.event_reference, event_type: body.event_type, status: 'accepted',
      occurred_at: body.occurred_at, replayed: false,
    }))
  }
  const sync = await submitOpsCustomerSync({ identity, idempotencyKey: 'test-sync', profile: { first_name: 'API' } })
  assert.equal(sync.ok, true)
  assert.equal(sync.status, 'synced')
  assert.equal(sync.requestId, 'request_test')
  const updated = await submitOpsCustomerProfileUpdate({ identity, idempotencyKey: 'test-profile', profile: { first_name: 'API' } })
  assert.equal(updated.ok, true)
  assert.equal(updated.data.completion_reference, 'completion_profile')
  await submitOpsCustomerProfileUpdate({ identity, idempotencyKey: 'test-facility-address', facilityData: addressUpdate })
  await submitOpsCustomerProfileUpdate({ identity, idempotencyKey: 'test-facility-address', facilityData: addressUpdate })
  assert.deepEqual(profileRequests[2], profileRequests[1], 'facility-only transport retries keep exact payload and key')
  assert.deepEqual(JSON.parse(profileRequests[1].body), { facility_data: addressUpdate, metadata: {} }, 'machine schema accepts documented address DTO without a profile')
  await submitOpsCustomerProfileUpdate({ identity, idempotencyKey: 'test-combined-profile', profile: { phone: '+46701234567' }, facilityData: addressUpdate })
  assert.deepEqual(JSON.parse(profileRequests[3].body), { profile: { phone: '+46701234567' }, facility_data: addressUpdate, metadata: {} })
  const moved = await submitOpsCustomerMoveOut({ identity, idempotencyKey: 'test-move-out', moveOut: {
    facility_reference: 'facility_123', requested_move_out_date: '2026-11-01',
  } })
  assert.equal(moved.ok, true)
  assert.equal(moved.status, 'submitted')
  const event = await sendOpsCustomerEvent(identity, {
    event_type: 'customer.opened_document', source: 'gridex_website', idempotency_key: 'test-event',
    occurred_at: '2026-10-02T12:00:00.000Z',
    entity_type: 'document', entity_id: 'document_123',
  })
  assert.equal(event.status, 'accepted')
  assert.equal(event.eventReference, 'test-event')
  assert.equal(event.requestId, 'request_test')
  assert.equal(event.eventResourceReference, 'event_123456789012345678901234')
  const wireEvents = []
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body)
    wireEvents.push({ body: init.body, key: new Headers(init.headers).get('Idempotency-Key') })
    return jsonResponse(envelope({
      event_resource_reference: 'event_123456789012345678901234', customer_reference: 'customer_123',
      event_reference: body.event_reference, event_type: body.event_type, status: 'accepted',
      occurred_at: body.occurred_at, replayed: wireEvents.length > 1,
    }))
  }
  const RealDate = globalThis.Date
  let clock = '2026-10-02T12:01:00.000Z'
  globalThis.Date = class extends RealDate {
    constructor(...args) { super(...(args.length ? args : [clock])) }
    static now() { return RealDate.parse(clock) }
  }
  const replayedEvent = {
    event_type: 'customer.opened_document', source: 'gridex_website',
    occurred_at: '2026-10-02T12:00:00.000Z', entity_type: 'document', entity_id: 'document_123',
  }
  try {
    await sendOpsCustomerEvent(identity, replayedEvent)
    clock = '2026-10-03T18:00:00.000Z'
    await sendOpsCustomerEvent(identity, replayedEvent)
    assert.deepEqual(wireEvents[1], wireEvents[0], 'retry keeps both the exact body and generated key after wall-clock changes')
    assert.equal(JSON.parse(wireEvents[0].body).occurred_at, replayedEvent.occurred_at)
    await assert.rejects(sendOpsCustomerEvent(identity, { ...replayedEvent, occurred_at: undefined }),
      (error) => error.code === 'validation_error' && error.details.field === 'occurred_at')
    assert.equal(wireEvents.length, 2, 'an event without immutable time never reaches OPS')
  } finally { globalThis.Date = RealDate }
  assert.equal(customerEventOccurredAt('2026-02-30T12:00:00Z'), null)
  assert.equal(customerEventOccurredAt('2026-10-03'), null)
  assert.equal(customerEventOccurredAt('2026-10-03T19:45:17+02:00'), '2026-10-03T19:45:17+02:00')
  globalThis.fetch = async (_url, init) => jsonResponse(envelope({
    updated_count: 1, notification_references: JSON.parse(init.body).notification_references,
    read_at: '2026-10-02T12:00:00.000Z',
  }))
  const notificationReceipt = await markOpsCustomerNotificationsRead(identity, { notificationIds: [notificationReference], operationId: 'test-notification' })
  assert.equal(notificationReceipt.ok, true)
  assert.equal(notificationReceipt.updatedCount, 1)
  assert.deepEqual(notificationReceipt.notificationReferences, [notificationReference])
  assert.equal(notificationReceipt.requestId, 'request_test')
  globalThis.fetch = async () => jsonResponse(envelope({ updated_count: 0, notification_references: [notificationReference], read_at: '2026-10-02T12:00:00.000Z' }))
  assert.equal((await markOpsCustomerNotificationsRead(identity, { notificationIds: [notificationReference], operationId: 'already-read-notification' })).ok, true,
    'an exact accepted receipt with zero new rows is valid, not an invented failure')
  for (const notification_references of [[], ['notification_987654321098765432109876']]) {
    globalThis.fetch = async () => jsonResponse(envelope({ updated_count: 0, notification_references, read_at: '2026-10-02T12:00:00.000Z' }))
    await assert.rejects(markOpsCustomerNotificationsRead(identity, { notificationIds: [notificationReference], operationId: 'mismatched-notification-receipt' }),
      (error) => error.code === 'ops_notification_read_receipt_invalid' && error.details.retryable === false)
  }

  const upstreamError = new OpsError('OPS tillfälligt otillgängligt.', 503, {
    code: 'upstream_unavailable', retryable: true, request_id: 'ops_request_123',
    correlation_id: 'ops_correlation_123', field: 'profile', action: 'retry_request',
    retry_after: '30', blockers: [{ code: 'customer_link_pending', message: 'Kundkopplingen behöver granskas.', field: null }],
  })
  const errorResponse = customerApiErrorResponse(upstreamError, { logLabel: 'regression', fallbackMessage: 'Fel' })
  const errorBody = await errorResponse.json()
  assert.equal(errorResponse.status, 503)
  assert.equal(errorBody.error.retryable, true)
  assert.equal(errorBody.error.request_id, 'ops_request_123')
  assert.equal(errorBody.error.correlation_id, 'ops_correlation_123')
  assert.equal(errorBody.error.action, 'retry_request')
  assert.deepEqual(errorBody.error.blockers, upstreamError.details.blockers, 'BFF retains canonical business blockers')
  assert.equal(errorResponse.headers.get('cache-control'), 'private, no-store')
  assert.equal(errorResponse.headers.get('retry-after'), '30')
  const canonicalError = new OpsError('Kundkopplingen behöver granskas.', 503, {
    error: { code: 'customer_link_pending', message: 'Kundkopplingen behöver granskas.', retryable: false,
      field: null, blockers: [{ code: 'manual_review_required', message: 'Kontakta kundservice.', recommended_action: 'contact_support' }] },
    request_id: 'canonical_request', correlation_id: 'canonical_correlation',
  })
  const canonicalBody = await customerApiErrorResponse(canonicalError, { logLabel: 'canonical-regression', fallbackMessage: 'Fel' }).json()
  assert.equal(canonicalBody.error.retryable, false, 'business retry decisions override HTTP retry defaults')
  assert.equal(canonicalBody.error.request_id, 'canonical_request')
  assert.equal(canonicalBody.error.correlation_id, 'canonical_correlation')
  assert.deepEqual(canonicalBody.error.blockers, canonicalError.details.error.blockers, 'nested canonical error blockers reach the browser')
  console.log('Tenant context, verified identity, canonical profile, portal access and OPS error regressions passed')
} finally {
  globalThis.fetch = originalFetch
}
