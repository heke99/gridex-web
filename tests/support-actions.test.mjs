import assert from 'node:assert/strict'
import test from 'node:test'
import { generateKeyPairSync } from 'node:crypto'
import { createSupportRuntime, FIXTURE_ADMIN, FIXTURE_READER, FIXTURE_FOREIGN, FIXTURE_COMPANY, FIXTURE_CASE, FIXTURE_CUSTOMER, FIXTURE_ATTACHMENT, FIXTURE_PASSWORD } from './fixtures/support-runtime.mjs'
import { createStaffApiClient, StaffApiError } from '../lib/staff-api/client.ts'
import { signStaffAssertion } from '../lib/staff-api/assertion.ts'
import { createSupportAuthClient, requireSupportSession } from '../apps/support/lib/session.ts'
import { createCase, caseCommand, customerContact, inviteUser, userCommand } from '../apps/support/app/actions.ts'
import { signIn, signOut, updatePassword } from '../apps/support/app/login/actions.ts'

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const config = { apiKey: 'support-test-dedicated-key-1234567890', companyId: FIXTURE_COMPANY, issuer: 'https://support123.gridex.se', audience: 'gridex-staff', keyId: 'offline-support-key', privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(), timeoutMs: 1000 }
const authUrl = 'https://ayiuxjlfazkjmmtlvhsl.supabase.co'
const environment = { GRIDEX_SUPPORT_SUPABASE_URL: authUrl, GRIDEX_SUPPORT_SUPABASE_ANON_KEY: 'sb_publishable_offline_support_key_123456', GRIDEX_STAFF_API_KEY: config.apiKey, GRIDEX_STAFF_COMPANY_ID: config.companyId, GRIDEX_STAFF_ASSERTION_ISSUER: config.issuer, GRIDEX_STAFF_ASSERTION_AUDIENCE: config.audience, GRIDEX_STAFF_ASSERTION_KID: config.keyId, GRIDEX_STAFF_ASSERTION_PRIVATE_KEY: config.privateKey }
function form(values) { const result = new FormData(); for (const [key, value] of Object.entries(values)) result.set(key, String(value)); return result }
function setup(t, actor = FIXTURE_ADMIN) {
  const runtime = createSupportRuntime({ ...config, publicKey: publicKey.export({ type: 'spki', format: 'pem' }).toString() })
  const oldFetch = globalThis.fetch; const oldEnv = Object.fromEntries(Object.keys(environment).map(key => [key, process.env[key]]))
  Object.assign(process.env, environment); globalThis.fetch = runtime.fetch
  const cookieMap = new Map(); const writes = []
  const setSession = (id, cookieUserId = id) => {
    const session = runtime.authSession(id); session.user.id = cookieUserId
    cookieMap.set('gridex-support-auth', 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url'))
  }
  if (actor) setSession(actor)
  globalThis.__supportTestCookies = { getAll: () => [...cookieMap].map(([name, value]) => ({ name, value })), set: (name, value, options) => { writes.push({ name, options }); if (value) cookieMap.set(name, value); else cookieMap.delete(name) } }
  globalThis.__supportTestRevalidations = []
  t.after(() => { globalThis.fetch = oldFetch; for (const [key, value] of Object.entries(oldEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value } delete globalThis.__supportTestCookies; delete globalThis.__supportTestRevalidations })
  const api = createStaffApiClient(actor ?? FIXTURE_ADMIN)
  return { ...runtime, api, cookieMap, writes, setSession }
}
const staff = runtime => runtime.state.traffic.filter(call => call.boundary === 'staff')
const commands = runtime => staff(runtime).filter(call => call.method !== 'GET')
const redirect = path => error => error.location === path

test('offline fixture serves all actual read DTOs, history cursor continuation and verified attachment bytes', async t => {
  const runtime = setup(t)
  assert.equal((await runtime.api.listCases({ limit: 1 })).data[0].case_reference, FIXTURE_CASE)
  const detail = (await runtime.api.getCase(FIXTURE_CASE)).data
  assert.equal(detail.events.length, 2); assert.equal(detail.attachments[0].attachment_reference, FIXTURE_ATTACHMENT)
  const first = await runtime.api.listEvents(FIXTURE_CASE, { limit: 1 }); const second = await runtime.api.listEvents(FIXTURE_CASE, { limit: 1, cursor: first.page.next_cursor })
  assert.equal(first.page.has_more, true); assert.equal(second.page.has_more, false); assert.notEqual(first.data[0].event_reference, second.data[0].event_reference)
  assert.equal((await runtime.api.listAttachments(FIXTURE_CASE, { limit: 1 })).page.has_more, false)
  assert.equal((await runtime.api.downloadAttachment(FIXTURE_CASE, FIXTURE_ATTACHMENT)).bytes.length, detail.attachments[0].byte_size)
  assert.equal((await runtime.api.searchCustomers({ q: 'Anna' })).data.customers[0].customer_reference, FIXTURE_CUSTOMER)
  assert.equal((await runtime.api.getCustomer(FIXTURE_CUSTOMER)).data.customer.display_name, 'Anna Testkund')
  assert.equal((await runtime.api.listUsers()).data.length, 2); assert.equal((await runtime.api.listRoles()).data.length, 3)
  assert.equal(runtime.state.assertions.size, staff(runtime).length)
})

test('offline fixture rejects wrong RSA, assertion replay, actor/company/key injection and outbound hosts', async t => {
  const runtime = setup(t)
  const invoke = (proof, apiKey = config.apiKey) => runtime.fetch('https://app.gridex.se/api/v1/staff/cases?limit=1', { headers: { authorization: `Bearer ${apiKey}`, 'x-gridex-expected-project-ref': 'ayiuxjlfazkjmmtlvhsl', 'x-gridex-staff-assertion': proof } })
  const proof = signStaffAssertion(config, FIXTURE_ADMIN)
  assert.equal((await invoke(proof)).status, 200); assert.equal((await invoke(proof)).status, 401)
  assert.equal((await invoke(signStaffAssertion(config, FIXTURE_ADMIN), 'website-api-key')).status, 401)
  assert.equal((await invoke(signStaffAssertion({ ...config, companyId: '44444444-4444-4444-8444-444444444444' }, FIXTURE_ADMIN))).status, 403)
  assert.equal((await invoke(signStaffAssertion(config, FIXTURE_FOREIGN))).status, 403)
  const otherKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
  assert.equal((await invoke(signStaffAssertion({ ...config, privateKey: otherKey }, FIXTURE_ADMIN))).status, 401)
  await assert.rejects(() => runtime.fetch('https://unexpected.example.invalid/'), /blocked unexpected outbound/)
  assert.equal(commands(runtime).length, 0)
})

test('offline boundary refuses wrong storage target before assertion consumption or fixture mutation', async t => {
  const runtime = setup(t); const before = JSON.stringify(runtime.state.customer)
  for (const target of [null, 'piidsfebjqjmnepdpnas']) {
    const headers = new Headers({ authorization: `Bearer ${config.apiKey}`, 'x-gridex-staff-assertion': signStaffAssertion(config, FIXTURE_ADMIN), 'idempotency-key': 'wrong-storage-key' })
    if (target) headers.set('x-gridex-expected-project-ref', target)
    const result = await runtime.fetch(`https://app.gridex.se/api/v1/staff/customers/${FIXTURE_CUSTOMER}/contact`, { method: 'PATCH', headers, body: JSON.stringify({ expectedUpdatedAt: runtime.state.customer.updated_at, phone: 'changed' }) })
    assert.equal(result.status, 412); assert.equal((await result.json()).error.code, 'staff_storage_target_mismatch')
  }
  assert.equal(runtime.state.assertions.size, 0); assert.equal(commands(runtime).length, 0); assert.equal(JSON.stringify(runtime.state.customer), before)
})

test('actual action authorization probe blocks missing/wrong response attestation before any write', async t => {
  const runtime = setup(t)
  for (const target of [null, 'piidsfebjqjmnepdpnas']) {
    const requests = []
    globalThis.fetch = async (input, init) => {
      if (String(input).startsWith(authUrl)) return runtime.fetch(input, init)
      requests.push(init.method)
      const response = await runtime.fetch(input, init)
      if (target === null) response.headers.delete('x-gridex-project-ref')
      else response.headers.set('x-gridex-project-ref', target)
      return response
    }
    await assert.rejects(() => caseCommand(FIXTURE_CASE, 'reply', {}, form({ message: 'Wrong target', idempotency_key: 'storage-probe-key' })), error => error instanceof StaffApiError && error.status === 503 && error.code === 'staff_storage_target_unverified')
    assert.deepEqual(requests, ['GET'])
  }
  assert.equal(commands(runtime).length, 0); assert.deepEqual(globalThis.__supportTestRevalidations, [])
})

test('installed Auth SDK logs in and verifies synthetic user over gridex-prod boundary with isolated cookies', async t => {
  const runtime = setup(t, null)
  const auth = await createSupportAuthClient()
  const result = await auth.auth.signInWithPassword({ email: 'support@example.invalid', password: FIXTURE_PASSWORD })
  assert.equal(result.error, null); assert.equal(result.data.user.id, FIXTURE_ADMIN)
  assert.equal((await requireSupportSession()).userId, FIXTURE_ADMIN)
  assert.ok(runtime.state.traffic.some(c => c.boundary === 'auth' && c.path === '/auth/v1/token'))
  assert.ok(runtime.state.traffic.some(c => c.boundary === 'auth' && c.path === '/auth/v1/user'))
  assert.ok(runtime.writes.length > 0)
  for (const { name, options } of runtime.writes) { assert.match(name, /^gridex-support-auth/); assert.equal(options.httpOnly, true); assert.equal(options.sameSite, 'lax'); assert.equal('domain' in options, false) }
})

test('actual login action verifies issued session before API admission and wrong credentials cannot authorize a request', async t => {
  const runtime = setup(t, null)
  const invalid = await signIn({}, form({ email: 'support@example.invalid', password: 'incorrect' }))
  assert.ok(invalid.error); assert.equal(staff(runtime).length, 0); assert.equal(runtime.cookieMap.size, 0)
  runtime.state.traffic.length = 0
  await assert.rejects(() => signIn({}, form({ email: 'SUPPORT@example.invalid', password: FIXTURE_PASSWORD, user_id: FIXTURE_FOREIGN, company_id: 'foreign' })), redirect('/'))
  assert.deepEqual(runtime.state.traffic.map(c => [c.boundary, c.method, c.path]), [['auth', 'POST', '/auth/v1/token'], ['auth', 'GET', '/auth/v1/user'], ['staff', 'GET', '/cases']])
  assert.equal(staff(runtime)[0].actor, FIXTURE_ADMIN); assert.equal(staff(runtime)[0].company, FIXTURE_COMPANY)
})

test('actual login does not admit authenticated other-company users or temporary-password credentials', async t => {
  const runtime = setup(t, null)
  await assert.rejects(() => signIn({}, form({ email: 'foreign@example.invalid', password: FIXTURE_PASSWORD })), redirect('/login?reason=access_denied'))
  assert.equal(commands(runtime).length, 0)
  runtime.cookieMap.clear(); runtime.state.traffic.length = 0
  runtime.state.users.get(FIXTURE_ADMIN).user_metadata.must_change_password = true
  await assert.rejects(() => signIn({}, form({ email: 'support@example.invalid', password: FIXTURE_PASSWORD })), redirect('/login/update-password'))
  assert.equal(staff(runtime).length, 0)
  await assert.rejects(() => caseCommand(FIXTURE_CASE, 'reply', {}, form({ message: 'Temporary credential', idempotency_key: 'temporary-key' })), redirect('/login/update-password'))
  assert.equal(commands(runtime).length, 0)
})

test('actual password update verifies authenticated subject and signout removes the isolated session', async t => {
  const runtime = setup(t)
  runtime.state.users.get(FIXTURE_ADMIN).user_metadata.must_change_password = true
  assert.ok((await updatePassword({}, form({ password: 'short', confirm: 'short' }))).error)
  assert.equal(runtime.state.traffic.length, 0)
  await assert.rejects(() => updatePassword({}, form({ password: 'ReplacementFixture!123', confirm: 'ReplacementFixture!123', user_id: FIXTURE_FOREIGN })), redirect('/'))
  assert.equal(runtime.state.users.get(FIXTURE_ADMIN).password, 'ReplacementFixture!123'); assert.equal(runtime.state.users.get(FIXTURE_ADMIN).user_metadata.must_change_password, false)
  assert.equal(runtime.state.users.get(FIXTURE_FOREIGN).password, FIXTURE_PASSWORD)
  assert.deepEqual(runtime.state.traffic.map(c => [c.boundary, c.method, c.path]), [['auth', 'GET', '/auth/v1/user'], ['auth', 'PUT', '/auth/v1/user']])
  await assert.rejects(() => signOut(), redirect('/login'))
  assert.equal(runtime.cookieMap.size, 0)
  await assert.rejects(() => requireSupportSession(), redirect('/login'))
  assert.equal(staff(runtime).length, 0)
})

test('actual reply action re-verifies Auth and cannot take actor/company/permission authority from browser fields', async t => {
  const runtime = setup(t); runtime.setSession(FIXTURE_ADMIN, FIXTURE_FOREIGN)
  for (const key of ['reply-once-1', 'reply-once-2']) {
    const result = await caseCommand(FIXTURE_CASE, 'reply', {}, form({ message: 'Svar till kunden', idempotency_key: key, user_id: FIXTURE_FOREIGN, actor_user_id: FIXTURE_FOREIGN, company_id: '44444444-4444-4444-8444-444444444444', role_key: 'platform_admin' }))
    assert.ok(result.success)
  }
  assert.equal(runtime.state.traffic.filter(c => c.boundary === 'auth' && c.path === '/auth/v1/user').length, 2)
  assert.equal(staff(runtime).length, 4); assert.equal(runtime.state.assertions.size, 4)
  assert.deepEqual(commands(runtime).map(c => ({ actor: c.actor, company: c.company, key: c.idempotencyKey, payload: c.payload })), ['reply-once-1', 'reply-once-2'].map(key => ({ actor: FIXTURE_ADMIN, company: FIXTURE_COMPANY, key, payload: { message: 'Svar till kunden' } })))
  assert.equal(runtime.state.events.get(FIXTURE_CASE).at(-1).author_user_id, FIXTURE_ADMIN)
})

test('actual commands preserve documented note/phone/status/assignee payloads and caller idempotency exactly once', async t => {
  const runtime = setup(t)
  const operations = [
    ['note', { message: 'Intern anteckning' }, 'POST', 'notes'],
    ['phone', { direction: 'inbound', summary: 'Telefonkontakt', verification_method: 'callback_registered_number', verification_reference: 'offline-callback' }, 'POST', 'phone-interactions'],
    ['status', { status: 'resolved' }, 'PATCH', 'status'],
    ['assignee', { assignee_user_id: FIXTURE_READER }, 'PATCH', 'assignee'],
  ]
  for (const [command, fields, method, path] of operations) {
    const key = `action-${command}-key`; assert.ok((await caseCommand(FIXTURE_CASE, command, {}, form({ ...fields, idempotency_key: key }))).success)
    const call = commands(runtime).at(-1); assert.equal(call.path, `/cases/${FIXTURE_CASE}/${path}`); assert.equal(call.method, method); assert.equal(call.idempotencyKey, key); assert.deepEqual(call.payload, fields)
  }
  assert.equal(commands(runtime).length, 4); assert.equal(runtime.state.cases.get(FIXTURE_CASE).status, 'resolved'); assert.equal(runtime.state.cases.get(FIXTURE_CASE).assignee_user_id, FIXTURE_READER)
})

test('actual write replay keeps one event and changed-payload409 returns safely without retries or cache revalidation', async t => {
  const runtime = setup(t); const initial = runtime.state.events.get(FIXTURE_CASE).length
  const data = form({ message: 'Samma svar', idempotency_key: 'stable-replay-key' })
  assert.ok((await caseCommand(FIXTURE_CASE, 'reply', {}, data)).success); assert.ok((await caseCommand(FIXTURE_CASE, 'reply', {}, data)).success)
  assert.equal(runtime.state.events.get(FIXTURE_CASE).length, initial + 1)
  const validations = globalThis.__supportTestRevalidations.length
  const rejected = await caseCommand(FIXTURE_CASE, 'reply', {}, form({ message: 'Ändrat svar', idempotency_key: 'stable-replay-key' }))
  assert.equal(rejected.error, new StaffApiError(409, 'idempotency_conflict').message); assert.equal(commands(runtime).length, 3); assert.equal(runtime.state.events.get(FIXTURE_CASE).length, initial + 1); assert.equal(globalThis.__supportTestRevalidations.length, validations)
})

test('readonly staff authorizes reads but API-denied action has no effect and is submitted once', async t => {
  const runtime = setup(t, FIXTURE_READER); const before = JSON.stringify(runtime.state.events.get(FIXTURE_CASE))
  const result = await caseCommand(FIXTURE_CASE, 'reply', {}, form({ message: 'Nekat svar', idempotency_key: 'denied-key' }))
  assert.equal(result.error, new StaffApiError(403, 'staff_permission_denied').message); assert.equal(commands(runtime).length, 1); assert.equal(JSON.stringify(runtime.state.events.get(FIXTURE_CASE)), before); assert.deepEqual(globalThis.__supportTestRevalidations, [])
})

test('other-company and absent sessions are rejected before command submission', async t => {
  const runtime = setup(t, FIXTURE_FOREIGN)
  await assert.rejects(() => caseCommand(FIXTURE_CASE, 'reply', {}, form({ message: 'Cross-company', idempotency_key: 'foreign-key' })), redirect('/login?reason=access_denied'))
  assert.equal(commands(runtime).length, 0)
  runtime.cookieMap.clear()
  await assert.rejects(() => caseCommand(FIXTURE_CASE, 'reply', {}, form({ message: 'No session', idempotency_key: 'missing-key' })), redirect('/login'))
  assert.equal(commands(runtime).length, 0)
})

test('actual contact action maps one allowlisted field plus optimistic version and ignores forged identity/company', async t => {
  const runtime = setup(t); const version = runtime.state.customer.updated_at
  const result = await customerContact(FIXTURE_CUSTOMER, {}, form({ field: 'phone', value: '+46 70 123 45 67', expected_updated_at: version, idempotency_key: 'contact-key', company_id: 'foreign', user_id: FIXTURE_FOREIGN, personal_number: 'forged' }))
  assert.ok(result.success); assert.equal(runtime.state.customer.phone, '+46 70 123 45 67')
  assert.deepEqual(commands(runtime).map(c => c.payload), [{ expectedUpdatedAt: version, phone: '+46 70 123 45 67' }])
})

test('actual contact stale409 and invalid-version422 retain state and never retry writes', async t => {
  const runtime = setup(t); const before = JSON.stringify(runtime.state.customer)
  const stale = await customerContact(FIXTURE_CUSTOMER, {}, form({ field: 'phone', value: 'changed', expected_updated_at: '2000-01-01T00:00:00Z', idempotency_key: 'stale-contact' }))
  assert.equal(stale.error, new StaffApiError(409, 'version_conflict').message); assert.equal(commands(runtime).length, 1); assert.equal(JSON.stringify(runtime.state.customer), before)
  const invalid = await customerContact(FIXTURE_CUSTOMER, {}, form({ field: 'phone', value: 'changed', expected_updated_at: '', idempotency_key: 'invalid-contact' }))
  assert.equal(invalid.error, new StaffApiError(422, 'staff_api_invalid_input').message); assert.equal(commands(runtime).length, 1); assert.equal(JSON.stringify(runtime.state.customer), before)
  const unallowed = await customerContact(FIXTURE_CUSTOMER, {}, form({ field: 'personal_number', value: 'forged', expected_updated_at: runtime.state.customer.updated_at, idempotency_key: 'forged-field' }))
  assert.ok(unallowed.error); assert.equal(commands(runtime).length, 1); assert.deepEqual(globalThis.__supportTestRevalidations, [])
})

test('actual team actions preserve invite intent, UUID target, role, disable and empty enable DTO with one stable key', async t => {
  const runtime = setup(t)
  assert.ok((await inviteUser({}, form({ email: 'invited@example.invalid', full_name: 'Ny personal', role_key: 'customer_service_viewer', idempotency_key: 'invite-key' }))).success)
  assert.ok((await userCommand(FIXTURE_READER, 'role', {}, form({ role_key: 'customer_service_agent', idempotency_key: 'role-key', actor_user_id: FIXTURE_FOREIGN, company_id: 'foreign' }))).success)
  assert.ok((await userCommand(FIXTURE_READER, 'disable', {}, form({ reason: 'Offline test', idempotency_key: 'disable-key' }))).success)
  assert.equal(runtime.state.users.get(FIXTURE_READER).status, 'disabled')
  assert.ok((await userCommand(FIXTURE_READER, 'enable', {}, form({ idempotency_key: 'enable-key' }))).success)
  assert.equal(runtime.state.users.get(FIXTURE_READER).status, 'active')
  assert.deepEqual(commands(runtime).map(c => [c.path, c.idempotencyKey, c.payload]), [['/users', 'invite-key', { email: 'invited@example.invalid', full_name: 'Ny personal', role_key: 'customer_service_viewer' }], [`/users/${FIXTURE_READER}`, 'role-key', { role_key: 'customer_service_agent' }], [`/users/${FIXTURE_READER}/disable`, 'disable-key', { reason: 'Offline test' }], [`/users/${FIXTURE_READER}/enable`, 'enable-key', {}]])
})

test('actual create action uses authenticated tenant/customer binding and redirects only after successful API result', async t => {
  const runtime = setup(t)
  await assert.rejects(() => createCase({}, form({ customer_reference: FIXTURE_CUSTOMER, title: 'Nytt supportärende', description: 'Offline beskrivning', priority: 'high', idempotency_key: 'create-key', actor_user_id: FIXTURE_FOREIGN, company_id: 'foreign' })), error => error.location?.startsWith('/cases/case_'))
  assert.equal(runtime.state.cases.size, 2); assert.equal(commands(runtime).length, 1)
  const created = [...runtime.state.cases.values()].at(-1); assert.equal(created.customer_reference, FIXTURE_CUSTOMER); assert.equal(runtime.state.events.get(created.case_reference)[0].author_user_id, FIXTURE_ADMIN)
  assert.deepEqual(commands(runtime)[0].payload, { customer_reference: FIXTURE_CUSTOMER, title: 'Nytt supportärende', description: 'Offline beskrivning', priority: 'high' })
})

test('missing idempotency/config and malformed target fail closed before any write fetch', async t => {
  const runtime = setup(t)
  assert.ok((await caseCommand(FIXTURE_CASE, 'reply', {}, form({ message: 'No key' }))).error)
  assert.ok((await userCommand('https://unexpected.example.invalid', 'enable', {}, form({ idempotency_key: 'bad-target' }))).error)
  assert.equal(commands(runtime).length, 0)
  delete process.env.GRIDEX_STAFF_API_KEY
  await assert.rejects(() => caseCommand(FIXTURE_CASE, 'reply', {}, form({ message: 'No config', idempotency_key: 'no-config' })), error => error instanceof StaffApiError && error.status === 503)
  assert.equal(commands(runtime).length, 0)
})
