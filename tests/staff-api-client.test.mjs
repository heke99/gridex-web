import assert from 'node:assert/strict'
import test from 'node:test'
import { generateKeyPairSync, verify, createHash } from 'node:crypto'
import { readStaffApiConfig } from '../lib/staff-api/config.ts'
import { signStaffAssertion, signLocalStaffAssertion } from '../lib/staff-api/assertion.ts'
import { resolveStaffIdentity } from '../lib/staff-api/identity.ts'
import { createStaffApiClient, StaffApiError } from '../lib/staff-api/client.ts'

const subject = '11111111-1111-4111-8111-111111111111'
const company = '22222222-2222-4222-8222-222222222222'
const reference = 'case_abcdefghijklmnopqrstuv'
const attachmentReference = 'attachment_abcdefghijklmnopqrstuv'
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
const GRIDEX_OPS_PROJECT_REF = 'piidsfebjqjmnepdpnas'
const config = { opsProjectRef: GRIDEX_OPS_PROJECT_REF, apiKey: 'gxk_staff_example_full_secret_1234567890', companyId: company, issuer: 'https://support123.gridex.se', audience: 'gridex-staff', keyId: 'support-key-1', privateKey: pem, timeoutMs: 1000 }
const environment = { GRIDEX_STAFF_API_PROJECT_REF: config.opsProjectRef, GRIDEX_STAFF_API_KEY: config.apiKey, GRIDEX_STAFF_COMPANY_ID: company, GRIDEX_STAFF_ASSERTION_ISSUER: config.issuer, GRIDEX_STAFF_ASSERTION_AUDIENCE: config.audience, GRIDEX_STAFF_ASSERTION_KID: config.keyId, GRIDEX_STAFF_ASSERTION_PRIVATE_KEY: pem }
const page = { limit: 1, offset: 0, returned: 0, has_more: false, next_cursor: null }
const envelope = data => ({ data, request_id: 'request-1', contract_schema_version: '2026-10-04.1' })
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'x-request-id': 'request-1', 'x-gridex-project-ref': GRIDEX_OPS_PROJECT_REF, ...headers } })
const event = { event_reference: 'event_abcdefghijklmnopqrstuv', event_type: 'support_staff_reply', message: 'Synthetic test reply', visibility: 'customer', author_type: 'staff', author_user_id: subject, channel: 'staff_api', kind: 'message', direction: null, verification_method: null, verification_reference: null, representative: null, created_at: '2026-10-05T09:00:00Z' }
const claims = token => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
function client(fetchImpl, override = {}) { return createStaffApiClient(subject, { config, fetchImpl, ...override }) }

test('configuration uses dedicated staff credentials and fails closed without each required setting', () => {
  assert.equal(readStaffApiConfig(environment).companyId, company)
  for (const name of Object.keys(environment)) {
    assert.throws(() => readStaffApiConfig({ ...environment, [name]: '', GRIDEX_API_KEY: 'website-secret' }), StaffApiError)
  }
  assert.throws(() => readStaffApiConfig({ ...environment, GRIDEX_STAFF_COMPANY_ID: 'not-a-company' }), StaffApiError)
  assert.throws(() => readStaffApiConfig({ ...environment, GRIDEX_STAFF_ASSERTION_PRIVATE_KEY: 'bad-key' }), StaffApiError)
})

test('RS256 assertion verifies with real RSA and has exact provider identity, bounded lifetime and fresh jti', () => {
  const now = new Date('2026-10-05T09:00:00Z')
  const first = signStaffAssertion(config, subject, now)
  const second = signStaffAssertion(config, subject, now)
  const [header, body, signature] = first.split('.')
  assert.deepEqual(JSON.parse(Buffer.from(header, 'base64url')), { alg: 'RS256', typ: 'JWT', kid: config.keyId })
  assert.equal(verify('RSA-SHA256', Buffer.from(`${header}.${body}`), publicKey, Buffer.from(signature, 'base64url')), true)
  const payload = claims(first)
  assert.deepEqual({ ...payload, jti: '<fresh>' }, { iss: config.issuer, aud: config.audience, sub: subject, company_id: company, iat: 1791190800, exp: 1791190860, jti: '<fresh>' })
  assert.notEqual(payload.jti, claims(second).jti)
  assert.match(payload.jti, /^[0-9a-f-]{36}$/)
})

test('no assertion/client or network access without a verified UUID subject or valid configuration', async () => {
  let calls = 0
  for (const value of ['', undefined, 'website-user', '//attacker.example']) {
    assert.throws(() => createStaffApiClient(value, { config, fetchImpl: async () => { calls++; return json(envelope([])) } }), StaffApiError)
    assert.throws(() => signStaffAssertion(config, value), StaffApiError)
  }
  assert.throws(() => createStaffApiClient(subject, { config: { ...config, apiKey: '' } }), StaffApiError)
  assert.equal(calls, 0)
})

test('every real request has a fresh signed assertion, fixed HTTPS URL, no cache/manual redirects, and a deadline', async () => {
  const observed = []
  const api = client(async (url, init) => { observed.push([url, init]); return json({ ...envelope([]), page }) })
  await api.listCases({ limit: 1, query: 'a&company_id=foreign', cursor: 'opaque+/=' })
  await api.listCases({ limit: 1 })
  assert.equal(observed.length, 2)
  const [url, init] = observed[0]
  assert.equal(new URL(url).origin, 'https://app.gridex.se')
  assert.equal(new URL(url).pathname, '/api/v1/staff/cases')
  assert.equal(new URL(url).searchParams.get('query'), 'a&company_id=foreign')
  assert.equal(new URL(url).searchParams.has('company_id'), false)
  assert.equal(new URL(url).searchParams.get('cursor'), 'opaque+/=')
  assert.equal(init.cache, 'no-store'); assert.equal(init.redirect, 'manual'); assert.ok(init.signal instanceof AbortSignal)
  const headers = new Headers(init.headers)
  assert.equal(headers.get('authorization'), `Bearer ${config.apiKey}`)
  assert.equal(headers.has('cookie'), false)
  assert.equal(headers.get('x-gridex-expected-project-ref'), GRIDEX_OPS_PROJECT_REF)
  const token = headers.get('x-gridex-staff-assertion')
  assert.equal(claims(token).sub, subject); assert.equal(claims(token).company_id, company)
  assert.notEqual(claims(token).jti, claims(new Headers(observed[1][1].headers).get('x-gridex-staff-assertion')).jti)
})

test('opaque references, bounded queries, unknown query fields and missing idempotency cannot inject a URL or make a request', async () => {
  let calls = 0
  const api = client(async () => { calls++; return json(envelope(event), 201) })
  for (const value of ['https://attacker.example', '../customers', reference + '/../../', reference + '?company_id=foreign', reference + '%2F']) {
    await assert.rejects(() => api.getCase(value), StaffApiError)
  }
  await assert.rejects(() => api.listCases({ limit: 101 }), StaffApiError)
  await assert.rejects(() => api.listCases({ company_id: company }), StaffApiError)
  await assert.rejects(() => api.reply(reference, { message: 'test' }, ''), StaffApiError)
  assert.equal(calls, 0)
})

test('cursor continuation is passed unchanged and server pagination is exposed without fabricating completeness', async () => {
  let calls = 0
  const api = client(async url => {
    calls++
    assert.equal(new URL(url).pathname, `/api/v1/staff/cases/${reference}/events`)
    assert.equal(new URL(url).searchParams.get('cursor'), calls === 1 ? null : 'cursor-opaque')
    return json({ ...envelope(calls === 1 ? [event] : []), page: { ...page, returned: calls === 1 ? 1 : 0, has_more: calls === 1, next_cursor: calls === 1 ? 'cursor-opaque' : null } })
  })
  const first = await api.listEvents(reference, { limit: 1 })
  assert.equal(first.page.has_more, true); assert.equal(first.data.length, 1)
  const last = await api.listEvents(reference, { limit: 1, cursor: first.page.next_cursor })
  assert.equal(last.page.has_more, false); assert.equal(last.page.next_cursor, null)
})

for (const [status, code] of [[403, 'api_scope_missing'], [409, 'version_conflict'], [503, 'service_unavailable']]) {
  test(`upstream ${status} retains safe code/request ID, redacts details/message and never retries writes`, async () => {
    let calls = 0
    const api = client(async () => { calls++; return json({ error: { code, message: 'private backend text ' + config.apiKey, details: { secret: pem }, retryable: true }, request_id: 'request-error' }, status, { 'x-request-id': 'request-error' }) })
    await assert.rejects(() => api.reply(reference, { message: 'test' }, 'stable-idempotency-key'), error => {
      assert.ok(error instanceof StaffApiError); assert.equal(error.status, status); assert.equal(error.code, code); assert.equal(error.requestId, 'request-error')
      assert.equal(error.message.includes('private backend'), false); assert.equal(JSON.stringify(error).includes(config.apiKey), false); assert.equal(JSON.stringify(error).includes(pem), false)
      return true
    })
    assert.equal(calls, 1)
  })
}

test('manual redirect is refused without following its Location or disclosing credentials', async () => {
  let calls = 0
  const api = client(async () => { calls++; return new Response(null, { status: 307, headers: { location: 'https://attacker.example' } }) })
  await assert.rejects(() => api.listCases(), error => error.code === 'staff_api_redirect_blocked' && error.status === 502)
  assert.equal(calls, 1)
})

test('network rejection is redacted and aborted requests finish at the configured deadline', async () => {
  await assert.rejects(() => client(async () => { throw new Error(pem) }).listCases(), error => error.code === 'staff_api_unavailable' && !error.message.includes('PRIVATE KEY'))
  const api = client(async (_url, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })), { config: { ...config, timeoutMs: 20 } })
  await assert.rejects(() => api.listCases(), error => error.code === 'staff_api_timeout' && error.status === 504)
})

test('JSON content type, schema/version, closed DTO and page consistency are checked before returning data', async () => {
  for (const response of [new Response('<html>private</html>', { status: 200, headers: { 'x-gridex-project-ref': GRIDEX_OPS_PROJECT_REF } }), json({ ...envelope([]), page, contract_schema_version: 'wrong' }), json({ ...envelope([]), page, private_column: 'secret' }), json({ ...envelope([]), page: { ...page, returned: 3 } }), json({ ...envelope([]), page: { ...page, has_more: true } })]) {
    await assert.rejects(() => client(async () => response).listCases(), error => error.code === 'staff_api_response_invalid' && error.status === 502)
  }
})

test('case commands use actual contract paths/body/method and require a stable idempotency key', async () => {
  const seen = []
  const api = client(async (url, init) => { seen.push([new URL(url).pathname, init.method, JSON.parse(init.body), new Headers(init.headers).get('idempotency-key')]); return json(envelope(event), 201) })
  await api.reply(reference, { message: 'Reply', kind: 'message' }, 'reply-key')
  await api.addNote(reference, { message: 'Note' }, 'note-key')
  await api.logPhone(reference, { direction: 'inbound', summary: 'Call', verification_method: 'unverified' }, 'phone-key')
  assert.deepEqual(seen.map(x => [x[0].split('/').at(-1), x[1], x[3]]), [['messages', 'POST', 'reply-key'], ['notes', 'POST', 'note-key'], ['phone-interactions', 'POST', 'phone-key']])
})

test('download restricts MIME, size and SHA-256 and returns only safe response metadata', async () => {
  const bytes = Buffer.from('%PDF-1.7\nsynthetic\n%%EOF')
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const api = client(async () => new Response(bytes, { status: 200, headers: { 'x-gridex-project-ref': GRIDEX_OPS_PROJECT_REF, 'content-type': 'application/pdf', 'x-gridex-sha256': sha256, 'content-disposition': 'attachment; filename="test.pdf"', 'x-request-id': 'file-request' } }))
  const file = await api.downloadAttachment(reference, attachmentReference)
  assert.deepEqual(Buffer.from(file.bytes), bytes); assert.equal(file.mimeType, 'application/pdf'); assert.equal(file.sha256, sha256); assert.equal(file.requestId, 'file-request')
  for (const [type, hash] of [['text/html', sha256], ['application/pdf', '0'.repeat(64)]]) {
    await assert.rejects(() => client(async () => new Response(bytes, { status: 200, headers: { 'x-gridex-project-ref': GRIDEX_OPS_PROJECT_REF, 'content-type': type, 'x-gridex-sha256': hash } })).downloadAttachment(reference, attachmentReference), error => error.code === 'staff_api_response_invalid')
  }
})

test('successful JSON and binary responses require the configured central OPS project attestation', async () => {
  for (const project of [null, 'ayiuxjlfazkjmmtlvhsl']) {
    for (const binary of [false, true]) {
      let calls = 0
      const api = client(async (_url, init) => {
        calls++
        assert.equal(new Headers(init.headers).get('x-gridex-expected-project-ref'), GRIDEX_OPS_PROJECT_REF)
        const response = binary ? new Response(Buffer.from('%PDF synthetic'), { headers: { 'content-type': 'application/pdf' } }) : json({ ...envelope([]), page })
        if (project === null) response.headers.delete('x-gridex-project-ref')
        else response.headers.set('x-gridex-project-ref', project)
        return response
      })
      await assert.rejects(() => binary ? api.downloadAttachment(reference, attachmentReference) : api.listCases(), error => error instanceof StaffApiError && error.status === 503 && error.code === 'staff_storage_target_unverified')
      assert.equal(calls, 1)
    }
  }
})

const localSubject = '55555555-5555-4555-8555-555555555555'
const identityBinding = { actorUserId: subject, bindingId: '88888888-8888-4888-8888-888888888888', bindingVersion: 1,
  localAuthSubject: localSubject, localAuthIssuer: 'https://ayiuxjlfazkjmmtlvhsl.supabase.co/auth/v1' }
const resolvedEnvelope = () => ({ data: { actor_user_id: subject, binding_id: identityBinding.bindingId, binding_version: 1 }, request_id: 'identity-request', contract_schema_version: '2026-10-05.2' })
const identityInput = { config, fetchImpl: async () => json(resolvedEnvelope()) }
const identity = deps => resolveStaffIdentity(localSubject, 'opaque-local-auth-bearer-123456', identityBinding.localAuthIssuer, { ...identityInput, ...deps })

test('purpose-specific local proof cannot impersonate the resolved central actor; normal proof binds both distinct IDs', () => {
  for (const tokenUse of ['staff_identity_resolution', 'staff_invitation_acceptance']) {
    const proof = claims(signLocalStaffAssertion(config, localSubject, tokenUse))
    assert.equal(proof.sub, localSubject); assert.equal(proof.token_use, tokenUse)
    assert.equal('staff_binding_id' in proof, false)
  }
  const proof = claims(signStaffAssertion(config, subject, new Date(), identityBinding))
  assert.equal(proof.sub, subject); assert.notEqual(proof.sub, localSubject)
  assert.equal(proof.token_use, 'staff_access'); assert.equal(proof.staff_binding_id, identityBinding.bindingId)
  assert.equal(proof.staff_binding_version, 1); assert.equal(proof.local_auth_subject, localSubject)
  assert.equal(proof.local_auth_issuer, identityBinding.localAuthIssuer)
  for (const invalid of [{ ...identityBinding, actorUserId: localSubject }, { ...identityBinding, bindingVersion: 0 }, { ...identityBinding, localAuthIssuer: 'https://unregistered.invalid/auth/v1' }]) {
    assert.throws(() => signStaffAssertion(config, subject, new Date(), invalid), StaffApiError)
  }
  assert.throws(() => signLocalStaffAssertion(config, localSubject, 'staff_access'), StaffApiError)
})

test('identity transport uses fixed POST{}, verified bearer and fresh local purpose proof with central project attestation', async () => {
  const requests = []
  const fetchImpl = async (url, init) => { requests.push([url, init]); return json(resolvedEnvelope()) }
  const binding = await identity({ fetchImpl }); await identity({ fetchImpl })
  assert.deepEqual(binding, identityBinding)
  assert.equal(requests.length, 2)
  for (const [url, init] of requests) {
    assert.equal(url, 'https://app.gridex.se/api/v1/staff-onboarding/identity/resolve')
    assert.equal(init.method, 'POST'); assert.equal(init.body, '{}'); assert.equal(init.cache, 'no-store'); assert.equal(init.redirect, 'manual')
    const headers = new Headers(init.headers)
    assert.equal(headers.get('x-gridex-expected-project-ref'), config.opsProjectRef)
    assert.equal(headers.get('x-gridex-support-auth-token'), 'opaque-local-auth-bearer-123456')
    assert.equal(headers.has('cookie'), false)
    const proof = claims(headers.get('x-gridex-staff-assertion'))
    assert.equal(proof.sub, localSubject); assert.equal(proof.token_use, 'staff_identity_resolution')
  }
  assert.notEqual(claims(new Headers(requests[0][1].headers).get('x-gridex-staff-assertion')).jti, claims(new Headers(requests[1][1].headers).get('x-gridex-staff-assertion')).jti)
})

test('identity resolution rejects unverified storage, wrong versions and nonclosed or malformed bindings', async () => {
  const baseline = resolvedEnvelope()
  for (const response of [json(baseline, 200, { 'x-gridex-project-ref': 'ayiuxjlfazkjmmtlvhsl' }),
    json({ ...baseline, contract_schema_version: '2026-10-05.1' }), json({ ...baseline, role_key: 'company_admin' }),
    json({ ...baseline, data: { ...baseline.data, binding_version: 0 } }), json({ ...baseline, data: { ...baseline.data, actor_user_id: 'invented' } }),
    json({ ...baseline, data: { ...baseline.data, local_auth_subject: localSubject } }), json({ ...baseline, data: null }),
    new Response('x'.repeat(16_385), { headers: { 'content-type': 'application/json', 'x-gridex-project-ref': config.opsProjectRef } })]) {
    await assert.rejects(() => identity({ fetchImpl: async () => response }), StaffApiError)
  }
})

test('identity errors do not disclose upstream detail or retry; redirects never forward the local bearer', async () => {
  for (const status of [401, 403, 503]) {
    let count = 0
    await assert.rejects(() => identity({ fetchImpl: async () => { count++; return json({ error: { code: 'staff_identity_unbound', message: 'private-secret-details' } }, status) } }), error => error.status === status && error.code === 'staff_identity_unbound' && !error.message.includes('private-secret'))
    assert.equal(count, 1)
  }
  await assert.rejects(() => identity({ fetchImpl: async (_url, init) => { assert.equal(init.redirect, 'manual'); return new Response(null, { status: 302, headers: { location: 'https://attacker.invalid' } }) } }), error => error.code === 'staff_api_redirect_blocked')
  await assert.rejects(() => identity({ fetchImpl: async () => { throw new Error('private-connection-details') } }), error => error.code === 'staff_api_unavailable' && !error.message.includes('private-connection'))
})

const supportCase = { case_reference: reference, customer_reference: 'customer_abcdefghijklmnopqrstuv', title: 'Synthetic case', description: null, status: 'open', priority: 'normal', category: null, assignee_user_id: null, channel: 'staff_api', created_at: '2026-10-05T09:00:00Z', updated_at: '2026-10-05T09:00:00Z', resolved_at: null, closed_at: null }

test('queue/detail/users/customer search and create/status/assignment use their distinct contract envelopes', async () => {
  const calls = []
  const api = client(async (url, init) => {
    const parsed = new URL(url); calls.push([parsed.pathname, parsed.search, init.method, init.body && JSON.parse(init.body)])
    if (parsed.pathname.endsWith('/users')) return json({ ...envelope([{ user_id: subject, email: null, full_name: null, role_key: 'customer_service_agent', membership_role: 'member', status: 'active', invited_at: null, accepted_at: null, disabled_at: null }]), pagination: { page: 2, page_size: 1, total: 2, has_more: false } })
    if (parsed.pathname.endsWith('/customers')) return json(envelope({ customers: [], pagination: { page: 2, page_size: 1, total: 1, total_pages: 1 } }))
    if (parsed.pathname.endsWith('/attachments')) return json({ ...envelope([]), page })
    if (parsed.pathname === '/api/v1/staff/cases' && init.method === 'GET') return json({ ...envelope([supportCase]), page: { ...page, returned: 1 } })
    if (parsed.pathname.endsWith('/' + reference)) return json(envelope({ ...supportCase, events: [], attachments: [], events_page: page, attachments_page: page }))
    return json(envelope(supportCase), init.method === 'POST' ? 201 : 200)
  })
  assert.equal((await api.listCases({ limit: 1 })).data[0].case_reference, reference)
  assert.equal((await api.getCase(reference)).data.events_page.has_more, false)
  assert.equal((await api.listUsers({ page: 2, page_size: 1, status: 'active' })).pagination.page, 2)
  assert.equal((await api.searchCustomers({ q: 'Ada & Bob', page: 2, page_size: 1 })).data.pagination.page, 2)
  assert.equal((await api.listAttachments(reference, { limit: 1 })).page.next_cursor, null)
  await api.createCase({ customer_reference: supportCase.customer_reference, title: 'Synthetic case' }, 'create-key')
  await api.setStatus(reference, { status: 'resolved', message: 'Resolved' }, 'status-key')
  await api.setAssignee(reference, { assignee_user_id: subject }, 'assign-key')
  assert.deepEqual(calls.slice(-3).map(x => [x[0].split('/').at(-1), x[2]]), [['cases', 'POST'], ['status', 'PATCH'], ['assignee', 'PATCH']])
  assert.equal(calls[3][1].includes('q=Ada+%26+Bob'), true)
})

test('controlled commands reject extra actor/company fields and invalid statuses before submitting', async () => {
  let calls = 0
  const api = client(async () => { calls++; return json(envelope(supportCase), 201) })
  await assert.rejects(() => api.createCase({ customer_reference: supportCase.customer_reference, title: 'test', actor_user_id: subject }, 'create-key'), StaffApiError)
  await assert.rejects(() => api.setStatus(reference, { status: 'billing_blocked' }, 'status-key'), StaffApiError)
  await assert.rejects(() => api.setAssignee(reference, { assignee_user_id: 'not-a-uuid' }, 'assign-key'), StaffApiError)
  await assert.rejects(() => api.reply(reference, { message: 'test', company_id: company }, 'reply-key'), StaffApiError)
  assert.equal(calls, 0)
})

test('body and attachment limits reject oversized declared or streamed content before it reaches the UI', async () => {
  await assert.rejects(() => client(async () => json(envelope([]), 200, { 'content-length': String(2 * 1024 * 1024 + 1) })).listCases(), error => error.code === 'staff_api_response_invalid')
  const oversized = new Uint8Array(4 * 1024 * 1024 + 1)
  await assert.rejects(() => client(async () => new Response(oversized, { status: 200, headers: { 'x-gridex-project-ref': GRIDEX_OPS_PROJECT_REF, 'content-type': 'application/pdf', 'x-gridex-sha256': 'a'.repeat(64) } })).downloadAttachment(reference, attachmentReference), error => error.code === 'staff_api_response_invalid')
})

const customerReference = 'customer_abcdefghijklmnopqrstuv'
const customer = { customer_reference: customerReference, customer_number: null, customer_type: 'private', status: 'active', display_name: 'Synthetic person', first_name: null, last_name: null, company_name: null, email: null, phone: null, personal_number_masked: null, org_number_masked: null, created_at: null, invoice_email: null, preferred_language: null, apartment_number: null, updated_at: '2026-10-05T09:00:00Z', contacts: [], addresses: [], sites: [], contacts_page: { limit: 100, returned: 0, has_more: false }, addresses_page: { limit: 100, returned: 0, has_more: false }, sites_page: { limit: 100, returned: 0, has_more: false } }

test('customer read/contact/identity and tenant staff management use only documented methods, paths and result schemas', async () => {
  const observed = []
  const api = client(async (url, init) => {
    const path = new URL(url).pathname; observed.push([path, init.method, init.body && JSON.parse(init.body)])
    let data; let status = 200
    if (path.endsWith('/roles')) data = [{ key: 'customer_service_agent', label: 'Support', description: 'Support staff', permissions: ['cases.read'], assignable: true }]
    else if (path.endsWith('/contact')) data = { customer_reference: customerReference, changed: true, customer_updated_at: '2026-10-05T09:01:00Z' }
    else if (path.endsWith('/identity-change')) { data = { request_reference: 'identity_abcdefghijklmnopqrstuv', status: 'pending_customer_approval', recipient_masked: 's***@example.invalid', expires_at: null, contract_count: 1, takeover_required: false }; status = 201 }
    else if (path.endsWith('/users')) { data = { email: 'test@example.invalid', role_key: 'customer_service_agent', membership_role: 'member', status: 'pending' }; status = 201 }
    else if (path.includes('/users/')) data = { user_id: subject, role_key: 'customer_service_agent', membership_role: 'member', status: path.endsWith('/disable') ? 'disabled' : 'active' }
    else data = { customer }
    return json(envelope(data), status)
  })
  assert.equal((await api.getCustomer(customerReference)).data.customer.customer_reference, customerReference)
  assert.equal((await api.updateContact(customerReference, { expectedUpdatedAt: customer.updated_at, phone: null }, 'contact-key')).data.changed, true)
  assert.equal((await api.requestIdentityChange(customerReference, { field: 'personal_number', new_value: '19800101-0000', reason: 'Synthetic request' }, 'identity-key')).data.status, 'pending_customer_approval')
  assert.equal((await api.listRoles()).data[0].assignable, true)
  assert.equal((await api.inviteUser({ email: 'test@example.invalid', role_key: 'customer_service_agent' }, 'invite-key')).data.status, 'pending')
  await api.changeUserRole(subject, { role_key: 'customer_service_agent' }, 'role-key')
  await api.disableUser(subject, { reason: 'Synthetic test' }, 'disable-key')
  await api.enableUser(subject, 'enable-key')
  assert.deepEqual(observed.map(x => [x[0].split('/').at(-1), x[1]]), [
    [customerReference, 'GET'], ['contact', 'PATCH'], ['identity-change', 'POST'], ['roles', 'GET'], ['users', 'POST'], [subject, 'PATCH'], ['disable', 'POST'], ['enable', 'POST'],
  ])
  assert.deepEqual(observed.at(-1)[2], {})
})

test('staff target UUIDs and versioned contact shapes are validated before any request', async () => {
  let count = 0
  const api = client(async () => { count++; return json(envelope({})) })
  for (const target of ['../company', 'https://attacker.example', subject + '?company=other']) {
    await assert.rejects(() => api.changeUserRole(target, { role_key: 'admin' }, 'role-key'), StaffApiError)
    await assert.rejects(() => api.disableUser(target, {}, 'disable-key'), StaffApiError)
    await assert.rejects(() => api.enableUser(target, 'enable-key'), StaffApiError)
  }
  await assert.rejects(() => api.updateContact(customerReference, { expectedUpdatedAt: customer.updated_at }, 'contact-key'), StaffApiError)
  await assert.rejects(() => api.updateContact(customerReference, { phone: 'test' }, 'contact-key'), StaffApiError)
  await assert.rejects(() => api.inviteUser({ email: 'test@example.invalid', role_key: 'admin', company_id: company }, 'invite-key'), StaffApiError)
  assert.equal(count, 0)
})

test('tenant user/contact authorization and stale conflicts propagate with no retries or role authority invented by portal', async () => {
  for (const [method, args, code, status] of [
    ['inviteUser', [{ email: 'test@example.invalid', role_key: 'admin' }, 'invite-key'], 'staff_role_ceiling', 403],
    ['changeUserRole', [subject, { role_key: 'admin' }, 'role-key'], 'last_admin_guard', 409],
    ['disableUser', [subject, {}, 'disable-key'], 'staff_self_disable', 409],
    ['updateContact', [customerReference, { expectedUpdatedAt: customer.updated_at, phone: 'test' }, 'contact-key'], 'version_conflict', 409],
  ]) {
    let count = 0
    const api = client(async () => { count++; return json({ error: { code, message: 'private', retryable: false }, request_id: 'request-control' }, status) })
    await assert.rejects(() => api[method](...args), error => error instanceof StaffApiError && error.status === status && error.code === code)
    assert.equal(count, 1)
  }
})
