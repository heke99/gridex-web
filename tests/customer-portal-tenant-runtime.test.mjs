import assert from 'node:assert/strict'
import { normalizeCanonicalCustomerResource, portalIdentityFromProfile } from '../lib/customerPortal/service.ts'
import { canonicalResourceRows, unwrapOpsData } from '../lib/customerPortal/resourceData.ts'
import { customerApiErrorResponse } from '../lib/customerPortal/apiErrors.ts'
import { assertCustomerAccountActive } from '../lib/customerPortal/accountAccess.ts'
import { profilePayload, syncPowerOfAttorney } from '../lib/customerPortal/writeValidation.ts'
import { OpsError } from '../lib/ops/errors.ts'
import { getVerifiedOpsIntegrationContext } from '../lib/ops/client/core.ts'
import {
  opsCustomerFetch, submitOpsCustomerPortalSync, submitOpsCustomerSync,
  submitOpsCustomerProfileUpdate, submitOpsCustomerMoveOut, sendOpsCustomerEvent, markOpsCustomerNotificationsRead,
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
  const moved = await submitOpsCustomerMoveOut({ identity, idempotencyKey: 'test-move-out', moveOut: {
    facility_reference: 'facility_123', requested_move_out_date: '2026-11-01',
  } })
  assert.equal(moved.ok, true)
  assert.equal(moved.status, 'submitted')
  const event = await sendOpsCustomerEvent(identity, {
    event_type: 'customer.opened_document', source: 'gridex_website', idempotency_key: 'test-event',
    entity_type: 'document', entity_id: 'document_123',
  })
  assert.equal(event.status, 'accepted')
  assert.equal(event.eventReference, 'test-event')
  assert.equal(event.requestId, 'request_test')
  assert.equal(event.eventResourceReference, 'event_123456789012345678901234')
  await markOpsCustomerNotificationsRead(identity, { notificationIds: [notificationReference], operationId: 'test-notification' })

  const upstreamError = new OpsError('OPS tillfälligt otillgängligt.', 503, {
    code: 'upstream_unavailable', retryable: true, request_id: 'ops_request_123',
    correlation_id: 'ops_correlation_123', field: 'profile', action: 'retry_request',
    retry_after: '30',
  })
  const errorResponse = customerApiErrorResponse(upstreamError, { logLabel: 'regression', fallbackMessage: 'Fel' })
  const errorBody = await errorResponse.json()
  assert.equal(errorResponse.status, 503)
  assert.equal(errorBody.error.retryable, true)
  assert.equal(errorBody.error.request_id, 'ops_request_123')
  assert.equal(errorBody.error.correlation_id, 'ops_correlation_123')
  assert.equal(errorBody.error.action, 'retry_request')
  assert.equal(errorResponse.headers.get('cache-control'), 'private, no-store')
  assert.equal(errorResponse.headers.get('retry-after'), '30')
  console.log('Tenant context, verified identity, canonical profile, portal access and OPS error regressions passed')
} finally {
  globalThis.fetch = originalFetch
}
