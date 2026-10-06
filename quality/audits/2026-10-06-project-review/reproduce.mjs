// Offline audit proofs. All identities and credentials below are synthetic.
// Run from the project root with the project's TypeScript alias loader.
import assert from 'node:assert/strict'
const root = new URL('../../../', import.meta.url)
const { mapOpsCustomerApplicationResult, assertAcceptedApplication } = await import(new URL('lib/ops/client/application.ts', root))
const { assertWebsiteResponse } = await import(new URL('lib/ops/validators/openapi.ts', root))
const { opsRequest } = await import(new URL('lib/ops/transport.ts', root))
const { passwordMeetsPolicy } = await import(new URL('lib/auth/passwordPolicy.ts', root))
const version = '2026-10-04.1'
const data = {
  application_number: 'APP-AUDIT-000001', status: 'accepted', customer_number: 'DX-999999',
  contract_status: 'signed', contract_number: 'AVT-AUDIT-000001', signed_at: '2026-10-06T12:00:00Z',
  signature_snapshot_sha256: 'a'.repeat(64), workflow_state: 'canonical_data_committed',
  missing_fields: [], blocking_reasons: [], grid_owner_verification_issues: [], warnings: [],
  selected_component_references: [], mandatory_component_references: [], conditional_component_references: [],
  supplier_switch: { request_reference: null, status: 'not_created', can_create_request: false,
    can_dispatch: false, blockers: [], next_action: 'resolve_switch_blockers' },
  communication: { pending: true, source_of_truth: 'communication_logs', triggered: [], queued: [], sent: [], failed: [] },
  checkout: { outcome: 'customer_action_required', thank_you_ready: false, page_state: 'action_required',
    customer_action_required: true, application: { application_number: 'APP-AUDIT-000001', status: 'accepted' },
    agreement: { status: 'signed', contract_number: 'AVT-AUDIT-000001', signed_at: '2026-10-06T12:00:00Z',
      withdrawal_deadline_at: null, signature_snapshot_sha256: 'a'.repeat(64) },
    confirmation_email: { expected: true, status: 'failed' }, status_path: '/api/v1/website/customer-applications/APP-AUDIT-000001' },
}
const envelope = { data, request_id: 'audit-request', contract_schema_version: version }
assertWebsiteResponse('WebsiteCustomerApplicationResponse', envelope, '/api/v1/website/customer-applications')
const mapped = mapOpsCustomerApplicationResult(envelope)
assertAcceptedApplication(mapped)
assert.equal(mapped.checkout, undefined)
console.log('CONFIRMED: schema-valid action_required/thank_you_ready=false is discarded and passes accepted gate')
const pending = structuredClone(envelope)
Object.assign(pending.data, { status: 'processing', contract_status: null, signed_at: null,
  signature_snapshot_sha256: null, workflow_state: null })
Object.assign(pending.data.checkout, { outcome: 'application_received', page_state: 'processing' })
assertWebsiteResponse('WebsiteCustomerApplicationResponse', pending, '/api/v1/website/customer-applications')
assert.throws(() => assertAcceptedApplication(mapOpsCustomerApplicationResult(pending)), e => e.code === 'ops_application_not_accepted')
console.log('CONFIRMED: schema-valid processing application is rejected as an upstream error')
process.env.GRIDEX_API_KEY = 'synthetic-audit-key'
process.env.GRIDEX_OPS_API_URL = 'https://app.gridex.se/api/v1'
process.env.GRIDEX_OPS_TIMEOUT_MS = '1000'
const originalFetch = globalThis.fetch
try {
  let calls = 0
  globalThis.fetch = async () => {
    calls++
    return new Response(JSON.stringify({ error: { code: 'permanent_audit_failure', retryable: false } }),
      { status: 503, headers: { 'content-type': 'application/json', 'x-gridex-contract-version': version } })
  }
  await assert.rejects(opsRequest('/api/v1/customer/me'), e => e.retryable === false)
  assert.equal(calls, 3)
  console.log('CONFIRMED: GET retries three times despite explicit retryable=false')
  let signal
  globalThis.fetch = async (_url, init) => {
    signal = init.signal
    return { status: 200, ok: true, headers: new Headers({ 'content-type': 'application/json' }),
      json: () => new Promise(() => {}) }
  }
  let settled = false
  void opsRequest('/api/v1/integration/context').finally(() => { settled = true })
  await new Promise(r => setTimeout(r, 1200))
  assert.equal(settled, false)
  assert.equal(signal.aborted, false)
  console.log('CONFIRMED: response body remains pending beyond configured timeout; abort timer already cleared')
} finally { globalThis.fetch = originalFetch }
assert.equal(passwordMeetsPolicy('abcdefgh'), false)
console.log('CONFIRMED: shared password policy rejects the eight-character password accepted by profile action length check')
