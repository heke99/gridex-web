import assert from 'node:assert/strict'
import test from 'node:test'
import { generateKeyPairSync } from 'node:crypto'
import { createSupportRuntime, FIXTURE_COMPANY, FIXTURE_ADMIN, FIXTURE_LOCAL_ADMIN, FIXTURE_OPS_PROJECT_REF, FIXTURE_CUSTOMER_AUTH, FIXTURE_FOREIGN_CUSTOMER_AUTH } from './fixtures/support-runtime.mjs'
import { createStaffApiClient } from '../lib/staff-api/client.ts'
import { createSupportTicketAction, addSupportMessageAction } from '../app/dashboard/support/actions.ts'
import { getCustomerTicketPage, getCustomerTickets, getTicketMessages } from '../lib/customerPortal/service.ts'
import { fetchOpsCustomerSupportCase, listOpsCustomerSupportCases, listOpsCustomerSupportMessages, sendOpsCustomerSupportMessage } from '../lib/ops/client/customerSupport.ts'

const CUSTOMER_AUTH = FIXTURE_CUSTOMER_AUTH
const FOREIGN_CUSTOMER_AUTH = FIXTURE_FOREIGN_CUSTOMER_AUTH
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const config = { opsProjectRef: FIXTURE_OPS_PROJECT_REF, apiKey: 'support-test-dedicated-key-1234567890', companyId: FIXTURE_COMPANY, issuer: 'https://support123.gridex.se', audience: 'gridex-staff', keyId: 'offline-handoff-key', privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(), timeoutMs: 1000 }
const environment = { GRIDEX_API_KEY: 'support-test-customer', GRIDEX_OPS_API_URL: 'https://app.gridex.se/api/v1', GRIDEX_STAFF_API_PROJECT_REF: config.opsProjectRef, GRIDEX_STAFF_API_KEY: config.apiKey, GRIDEX_STAFF_COMPANY_ID: config.companyId, GRIDEX_STAFF_ASSERTION_ISSUER: config.issuer, GRIDEX_STAFF_ASSERTION_AUDIENCE: config.audience, GRIDEX_STAFF_ASSERTION_KID: config.keyId, GRIDEX_STAFF_ASSERTION_PRIVATE_KEY: config.privateKey }
const form = values => { const data = new FormData(); for (const [key, value] of Object.entries(values)) data.set(key, String(value)); return data }
function setup(t, id = CUSTOMER_AUTH) {
  const runtime = createSupportRuntime({ ...config, publicKey: publicKey.export({ type: 'spki', format: 'pem' }).toString() })
  const oldFetch = globalThis.fetch; const oldEnv = Object.fromEntries(Object.keys(environment).map(key => [key, process.env[key]]))
  Object.assign(process.env, environment); globalThis.fetch = runtime.fetch
  const boundary = { user: id ? { id, email: id === CUSTOMER_AUTH ? 'anna@example.invalid' : 'foreign-customer@example.invalid', user_metadata: {} } : null, authReads: 0, localQueries: [], localWrites: [], revalidations: [], rates: [], rateAllowed: true }
  boundary.sdk = { auth: { getUser: async () => { boundary.authReads++; return { data: { user: boundary.user }, error: null } } }, from(table) {
    boundary.localQueries.push(table)
    if (table !== 'customer_profiles') { boundary.localWrites.push(table); throw new Error('Local support persistence forbidden') }
    let own
    return { select(columns) { assert.equal(columns, '*'); return this }, eq(column, value) { assert.equal(column, 'user_id'); assert.equal(value, boundary.user.id); own = value; return this }, async maybeSingle() { assert.equal(own, boundary.user.id); return { data: { user_id: own, email: boundary.user.email, customer_number: own === CUSTOMER_AUTH ? 'TEST-1001' : 'TEST-FOREIGN', metadata: {} }, error: null } } }
  } }
  globalThis.__customerHandoff = boundary
  t.after(() => { globalThis.fetch = oldFetch; for (const [key, value] of Object.entries(oldEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value } delete globalThis.__customerHandoff })
  return { ...runtime, boundary, staff: createStaffApiClient(FIXTURE_ADMIN, { binding: runtime.binding(FIXTURE_ADMIN) }) }
}
const create = (id = '11111111-aaaa-4aaa-8aaa-111111111111', extra = {}) => form({ subject: 'Kanoniskt kundärende', description: 'Kunden frågar om sin faktura.', category: 'faktura', priority: 'high', client_request_id: id, user_id: FIXTURE_LOCAL_ADMIN, actor_user_id: FIXTURE_ADMIN, company_id: 'foreign', ...extra })
const createdRedirect = error => error.location === '/dashboard/support?status=created'
const messageSentRedirect = error => error.location === '/dashboard/support?status=message-sent'
const reply = (reference, id = '22222222-aaaa-4aaa-8aaa-222222222222', body = 'Kundens uppföljning') => form({ ticket_id: reference, body, client_request_id: id, user_id: FIXTURE_ADMIN, actor_user_id: FIXTURE_ADMIN, company_id: 'foreign' })
const identity = id => ({ userId: id, email: id === CUSTOMER_AUTH ? 'anna@example.invalid' : 'foreign-customer@example.invalid', customerNumber: id === CUSTOMER_AUTH ? 'TEST-1001' : 'TEST-FOREIGN' })
const customerCalls = runtime => runtime.state.traffic.filter(call => call.boundary === 'customer')
const snapshot = runtime => JSON.stringify({ cases: [...runtime.state.cases], events: [...runtime.state.events] })
const noLocalSupport = runtime => assert.deepEqual(runtime.boundary.localWrites, [])

test('actual dashboard create writes one canonical case visible to signed Staff API, never legacy support tables', async t => {
  const runtime = setup(t); const initial = runtime.state.cases.size
  await assert.rejects(() => createSupportTicketAction(create()), createdRedirect)
  assert.ok(runtime.boundary.authReads >= 1); noLocalSupport(runtime)
  assert.equal(runtime.state.cases.size, initial + 1)
  const created = [...runtime.state.cases.values()].at(-1)
  assert.equal(created.title, 'Kanoniskt kundärende'); assert.equal(created.channel, 'customer_portal')
  assert.equal((await runtime.staff.getCase(created.case_reference)).data.case_reference, created.case_reference)
  assert.equal(customerCalls(runtime)[0].authId, CUSTOMER_AUTH)
  assert.notEqual(customerCalls(runtime)[0].authId, FIXTURE_ADMIN)
  assert.deepEqual(customerCalls(runtime)[0].payload, { title: 'Kanoniskt kundärende', message: 'Kunden frågar om sin faktura.', category: 'faktura' })
  assert.equal(runtime.state.events.get(created.case_reference)[0].author_type, 'customer')
  assert.equal(runtime.state.events.get(created.case_reference)[0].event_type, 'support_customer_message')
  assert.equal(runtime.state.events.get(created.case_reference)[0].author_user_id, null)
  assert.equal(runtime.state.events.get(created.case_reference)[0].kind, null)
  assert.match(runtime.state.events.get(created.case_reference)[0].event_reference, /^support_message_\d{32}$/)
  assert.match(created.case_reference, /^support_case_\d{32}$/)
  const firstKey = customerCalls(runtime)[0].idempotencyKey
  await assert.rejects(() => createSupportTicketAction(create()), createdRedirect)
  assert.equal(customerCalls(runtime)[1].idempotencyKey, firstKey)
  assert.equal(runtime.state.cases.size, initial + 1)
  assert.equal(runtime.state.events.get(created.case_reference).length, 1)
  assert.ok((await runtime.staff.listCases()).data.some(item => item.case_reference === created.case_reference))
  const listed = await listOpsCustomerSupportCases(identity(CUSTOMER_AUTH), { limit: 1 })
  assert.equal(listed.data.length, 1); assert.equal(listed.page.has_more, true)
  const rest = await listOpsCustomerSupportCases(identity(CUSTOMER_AUTH), { limit: 1, cursor: listed.page.next_cursor })
  assert.equal(rest.data[0].case_reference, created.case_reference); assert.equal(rest.page.has_more, false)
  const serviceFirst = await getCustomerTicketPage(runtime.boundary.sdk, CUSTOMER_AUTH, { limit: 1 })
  assert.equal(serviceFirst.data[0].case_reference, listed.data[0].case_reference); assert.equal(serviceFirst.page.has_more, true)
  const serviceNext = await getCustomerTicketPage(runtime.boundary.sdk, CUSTOMER_AUTH, { limit: 1, cursor: serviceFirst.page.next_cursor })
  assert.equal(serviceNext.data[0].case_reference, created.case_reference); assert.equal(serviceNext.page.has_more, false)
  assert.ok((await getCustomerTickets(runtime.boundary.sdk, CUSTOMER_AUTH)).some(item => item.case_reference === created.case_reference))
  noLocalSupport(runtime)
})

test('real customer reply and Staff reply share history while internal notes stay outside Customer DTOs and actual service', async t => {
  const runtime = setup(t)
  await assert.rejects(() => createSupportTicketAction(create()), createdRedirect)
  const ref = [...runtime.state.cases.keys()].at(-1)
  await assert.rejects(() => addSupportMessageAction(reply(ref)), messageSentRedirect)
  assert.equal(customerCalls(runtime).filter(call => call.method === 'POST').length, 2)
  const staffDetail = (await runtime.staff.getCase(ref)).data
  assert.ok(staffDetail.events.some(event => event.message === 'Kundens uppföljning' && event.event_type === 'support_customer_message' && event.author_type === 'customer' && event.author_user_id === null && event.kind === null))
  assert.ok(customerCalls(runtime).every(call => call.authId === CUSTOMER_AUTH))
  await runtime.staff.reply(ref, { message: 'Personalens svar' }, 'staff-public-reply-key')
  await runtime.staff.addNote(ref, { message: 'Hemlig intern anteckning' }, 'staff-private-note-key')
  runtime.state.events.get(ref).push({ ...staffDetail.events[0], event_reference: 'support_message_ffffffffffffffffffffffffffffffff', event_type: 'status_changed', visibility: 'customer', kind: 'message', message: 'Teknisk händelse ska aldrig visas som kundmeddelande' })
  const detail = (await fetchOpsCustomerSupportCase(identity(CUSTOMER_AUTH), ref)).data
  assert.deepEqual(detail.messages.map(message => message.body), ['Kunden frågar om sin faktura.', 'Kundens uppföljning', 'Personalens svar'])
  assert.equal(detail.messages.at(-1).author_type, 'staff')
  assert.ok(detail.messages.every(message => message.kind === 'message'))
  const messages = (await listOpsCustomerSupportMessages(identity(CUSTOMER_AUTH), ref)).data
  assert.deepEqual(messages, detail.messages)
  assert.ok((await getTicketMessages(runtime.boundary.sdk, ref)).some(message => message.body === 'Personalens svar'))
  assert.ok(!(await getTicketMessages(runtime.boundary.sdk, ref)).some(message => message.body.includes('Hemlig')))
  assert.ok((await runtime.staff.getCase(ref)).data.events.some(event => event.message === 'Hemlig intern anteckning' && event.visibility === 'internal'))
  assert.equal(JSON.stringify(detail).includes(FIXTURE_ADMIN), false)
  assert.equal(runtime.state.assertions.size, runtime.state.traffic.filter(call => call.boundary === 'staff').length)
  noLocalSupport(runtime)
})

test('Staff-created case uses explicit canonical customer binding and frozen Customer DTO while keeping internal description and notes private', async t => {
  const runtime = setup(t)
  const created = (await runtime.staff.createCase({ customer_reference: runtime.state.customer.customer_reference,
    title: 'Personalupprättat kundärende', description: 'Intern bakgrund som aldrig ska visas för kunden', priority: 'normal' }, 'staff-create-owned-customer-key')).data
  assert.equal(created.channel, 'staff_api')
  assert.equal(runtime.state.customerOwners.get(created.case_reference), CUSTOMER_AUTH)
  await runtime.staff.reply(created.case_reference, { message: 'Personalsvar på personalupprättat ärende' }, 'staff-created-case-reply-key')
  await runtime.staff.addNote(created.case_reference, { message: 'Privat anteckning på personalupprättat ärende' }, 'staff-created-case-note-key')
  const customerView = (await fetchOpsCustomerSupportCase(identity(CUSTOMER_AUTH), created.case_reference)).data
  assert.equal(customerView.case_reference, created.case_reference); assert.equal(customerView.title, created.title)
  assert.equal(customerView.channel, 'admin'); assert.equal(customerView.description, null)
  assert.equal(customerView.status, 'received')
  assert.deepEqual(customerView.messages.map(message => ({ body: message.body, author_type: message.author_type, kind: message.kind })),
    [{ body: 'Personalsvar på personalupprättat ärende', author_type: 'staff', kind: 'message' }])
  assert.ok((await getCustomerTickets(runtime.boundary.sdk, CUSTOMER_AUTH)).some(item => item.case_reference === created.case_reference))
  assert.deepEqual((await getTicketMessages(runtime.boundary.sdk, created.case_reference)).map(message => message.body), ['Personalsvar på personalupprättat ärende'])
  assert.equal(JSON.stringify(customerView).includes('Intern bakgrund'), false)
  assert.equal(JSON.stringify(customerView).includes('Privat anteckning'), false)
  const before = snapshot(runtime)
  await assert.rejects(() => fetchOpsCustomerSupportCase(identity(FOREIGN_CUSTOMER_AUTH), created.case_reference), error => error.status === 404)
  assert.equal(snapshot(runtime), before); noLocalSupport(runtime)
})

test('customer stable reply replay yields one event; changed payload conflicts409 without retry or side effect', async t => {
  const runtime = setup(t)
  await assert.rejects(() => createSupportTicketAction(create()), createdRedirect)
  const ref = [...runtime.state.cases.keys()].at(-1)
  await assert.rejects(() => addSupportMessageAction(reply(ref)), messageSentRedirect)
  await assert.rejects(() => addSupportMessageAction(reply(ref)), messageSentRedirect)
  assert.equal(runtime.state.events.get(ref).length, 2)
  const keys = customerCalls(runtime).filter(call => call.path.endsWith('/messages') && call.method === 'POST').map(call => call.idempotencyKey)
  assert.equal(keys.length, 2); assert.equal(keys[0], keys[1])
  const before = snapshot(runtime); const count = customerCalls(runtime).length
  await assert.rejects(() => addSupportMessageAction(reply(ref, '22222222-aaaa-4aaa-8aaa-222222222222', 'Ändrat innehåll')), error => error.status === 409)
  assert.equal(customerCalls(runtime).length, count + 1); assert.equal(snapshot(runtime), before); noLocalSupport(runtime)
})

test('foreign verified customer cannot read or mutate an owned case through real helper, service or forged form', async t => {
  const runtime = setup(t)
  await assert.rejects(() => createSupportTicketAction(create()), createdRedirect)
  const ref = [...runtime.state.cases.keys()].at(-1); const before = snapshot(runtime)
  runtime.boundary.user = { id: FOREIGN_CUSTOMER_AUTH, email: 'foreign-customer@example.invalid', user_metadata: { actor_user_id: FIXTURE_ADMIN } }
  await assert.rejects(() => fetchOpsCustomerSupportCase(identity(FOREIGN_CUSTOMER_AUTH), ref), error => error.status === 404 || error.status === 403)
  await assert.rejects(() => listOpsCustomerSupportMessages(identity(FOREIGN_CUSTOMER_AUTH), ref), error => error.status === 404 || error.status === 403)
  await assert.rejects(() => sendOpsCustomerSupportMessage(identity(FOREIGN_CUSTOMER_AUTH), ref, { message: 'Olovligt svar' }, 'foreign-reply-key'), error => error.status === 404 || error.status === 403)
  await assert.rejects(() => addSupportMessageAction(reply(ref)), error => error.status === 404 || error.status === 403)
  await assert.rejects(() => getTicketMessages(runtime.boundary.sdk, ref), error => error.status === 404 || error.status === 403)
  assert.deepEqual(await getCustomerTickets(runtime.boundary.sdk, FOREIGN_CUSTOMER_AUTH), [])
  assert.equal(snapshot(runtime), before)
  assert.ok(customerCalls(runtime).slice(1).every(call => call.authId === FOREIGN_CUSTOMER_AUTH))
  noLocalSupport(runtime)
})

test('absent verified own Auth rejects actual actions and service before any Customer API or local query', async t => {
  const runtime = setup(t, null)
  for (const run of [() => createSupportTicketAction(create()), () => addSupportMessageAction(reply('case_aaaaaaaaaaaaaaaaaaaaaaaa')),
    () => getCustomerTickets(runtime.boundary.sdk, CUSTOMER_AUTH), () => getTicketMessages(runtime.boundary.sdk, 'case_aaaaaaaaaaaaaaaaaaaaaaaa')]) await assert.rejects(run)
  assert.ok(runtime.boundary.authReads >= 4); assert.equal(customerCalls(runtime).length, 0)
  assert.deepEqual(runtime.boundary.localQueries, []); noLocalSupport(runtime)
})

test('API503 is propagated by real dashboard mutations once each with zero local fallback or canonical effects', async t => {
  const runtime = setup(t); const before = snapshot(runtime)
  runtime.state.customerRealm.unavailable = true
  await assert.rejects(() => createSupportTicketAction(create()), error => error.status === 503)
  await assert.rejects(() => addSupportMessageAction(reply('case_aaaaaaaaaaaaaaaaaaaaaaaa')), error => error.status === 503)
  assert.equal(customerCalls(runtime).length, 2); assert.ok(customerCalls(runtime).every(call => call.method === 'POST'))
  assert.equal(snapshot(runtime), before); assert.deepEqual(runtime.boundary.revalidations, []); noLocalSupport(runtime)
})

test('caller identity mismatch at actual service is denied, and malformed IDs/rate rejection cannot reach either persistence surface', async t => {
  const runtime = setup(t); const before = snapshot(runtime)
  await assert.rejects(() => getCustomerTickets(runtime.boundary.sdk, FOREIGN_CUSTOMER_AUTH))
  assert.equal(customerCalls(runtime).length, 0)
  await assert.rejects(() => createSupportTicketAction(create('')))
  await assert.rejects(() => addSupportMessageAction(reply('local-legacy-uuid')))
  runtime.boundary.rateAllowed = false
  await assert.rejects(() => createSupportTicketAction(create()))
  assert.equal(customerCalls(runtime).length, 0); assert.equal(snapshot(runtime), before); noLocalSupport(runtime)
})

test('actual Customer response schema rejects malformed success data rather than trusting a legacy ticket or leaking an extra internal field', async t => {
  const runtime = setup(t)
  globalThis.fetch = async (input, init) => {
    const response = await runtime.fetch(input, init)
    const body = await response.json()
    if (response.ok) body.data = { id: 'legacy-local-id', user_id: FIXTURE_ADMIN, internal_note: 'must not render' }
    return new Response(JSON.stringify(body), { status: response.status, headers: response.headers })
  }
  await assert.rejects(() => fetchOpsCustomerSupportCase(identity(CUSTOMER_AUTH), 'case_aaaaaaaaaaaaaaaaaaaaaaaa'))
  noLocalSupport(runtime)
})
