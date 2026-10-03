import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  supportCreateInput, supportReplyInput, supportReference, supportIdempotencyKey,
  supportListQuery, assertSupportFile, SUPPORT_UPLOAD_MAX_BYTES,
} from '../lib/support/validation.ts'
import {
  customerVisibleSupportCase, customerVisibleSupportMessage, customerVisibleSupportAttachment,
  fetchOpsCustomerSupportTickets, fetchOpsCustomerSupportCase, createOpsCustomerSupportCase,
  replyOpsCustomerSupportCase, uploadOpsCustomerSupportAttachment,
  downloadOpsCustomerSupportAttachment, readBoundedSupportBytes,
} from '../lib/ops/client/support.ts'
import { GRIDEX_WEBSITE_API_CONTRACT_VERSION as version } from '../lib/ops/contract.ts'
import { customerApiErrorResponse } from '../lib/customerPortal/apiErrors.ts'

const userId = '11111111-1111-4111-8111-111111111111'
const identity = { userId, email: 'verified@example.test' }
const caseReference = 'support_case_123456789012345678901234'
const messageReference = 'support_message_123456789012345678901234'
const attachmentReference = 'support_file_123456789012345678901234'
const key = 'op_123456789012345678901234'
const bytes = new TextEncoder().encode('%PDF-1.7\nDocument bytes')
const hash = createHash('sha256').update(bytes).digest('hex')
const supportCase = {
  case_reference: caseReference, title: 'Fakturafråga', description: 'Min fråga', status: 'received', channel: 'customer_portal',
  created_at: '2026-10-02T12:00:00Z', updated_at: '2026-10-02T12:00:00Z', resolved_at: null,
}
const message = { message_reference: messageReference, author_type: 'staff', kind: 'message', body: 'Svar', created_at: supportCase.created_at }
const file = { attachment_reference: attachmentReference, file_name: 'faktura.pdf', mime_type: 'application/pdf', byte_size: bytes.length, sha256: hash, uploaded_by: 'customer', created_at: supportCase.created_at }
const envelope = (data) => ({ data, request_id: 'support-request', contract_schema_version: version })
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json', 'X-Gridex-Contract-Version': version } })

assert.deepEqual(supportCreateInput({ title: ' fråga ', message: ' text ', category: 'invoice' }), { title: 'fråga', message: 'text', category: 'invoice' })
for (const field of ['user_id','customer_number','external_customer_id','auth_user_id','organization_reference','is_internal_note','priority','sender_type']) {
  assert.throws(() => supportCreateInput({ title: 'Fråga', message: 'Text', [field]: 'attacker' }), (error) => error.status === 400 && error.code === 'validation_error')
}
for (const input of [null, [], { title: '', message: 'Text' }, { title: 'x'.repeat(181), message: 'Text' }, { title: 'Fråga', message: 'x'.repeat(8001) }]) {
  assert.throws(() => supportCreateInput(input), (error) => error.status === 400)
}
assert.throws(() => supportReplyInput({ message: 'Hej', is_internal_note: true }), (error) => error.status === 400)
for (const input of ['../../secret', 'uuid-only', `${caseReference}/messages`, '%2f', null]) assert.throws(() => supportReference(input), (error) => error.status === 400)
assert.equal(supportReference(caseReference), caseReference)
for (const input of ['', 'short', 'newline\nkey', 'x'.repeat(201), null]) assert.throws(() => supportIdempotencyKey(input), (error) => error.status === 400)
assert.equal(supportIdempotencyKey(key), key)
assert.deepEqual(supportListQuery(new URLSearchParams('limit=30&cursor=opaque')), { limit: 30, cursor: 'opaque' })
for (const input of ['limit=0','limit=101','limit=1&limit=2','customer_id=attacker','limit=1.2','cursor=']) assert.throws(() => supportListQuery(new URLSearchParams(input)), (error) => error.status === 400)
assert.deepEqual(customerVisibleSupportCase({ ...supportCase, assigned_user_id: 'employee-secret', company_id: 'tenant-secret' }), supportCase)
assert.deepEqual(customerVisibleSupportMessage({ ...message, staff_name: 'Internal identity' }), message)
for (const input of [{ ...message, is_internal_note: true }, { ...message, visibility: 'internal' }, { ...message, kind: 'internal_note' }, { ...message, author_type: 'system' }]) {
  assert.throws(() => customerVisibleSupportMessage(input), (error) => error.status === 502 && error.code === 'support_response_invalid')
}
assert.deepEqual(customerVisibleSupportAttachment({ ...file, storage_path: 'private/internal.pdf' }), file)
assert.throws(() => customerVisibleSupportAttachment({ ...file, visibility: 'internal' }), (error) => error.status === 502)
assertSupportFile(bytes, 'application/pdf')
assert.throws(() => assertSupportFile(new Uint8Array(), 'application/pdf'), (error) => error.status === 413)
assert.throws(() => assertSupportFile(new Uint8Array(SUPPORT_UPLOAD_MAX_BYTES + 1), 'image/png'), (error) => error.status === 413)
assert.throws(() => assertSupportFile(bytes, 'image/png'), (error) => error.status === 422)
assert.throws(() => assertSupportFile(bytes, 'text/html'), (error) => error.status === 415)
await assert.rejects(() => readBoundedSupportBytes(new Response(bytes, { headers: { 'content-length': '100' } }), 20), (error) => error.status === 413)
const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(15)); controller.enqueue(new Uint8Array(15)); controller.close() } })
await assert.rejects(() => readBoundedSupportBytes(new Response(stream), 20), (error) => error.status === 413)

process.env.GRIDEX_API_KEY = 'gridex_live_support_runtime_secret'
process.env.GRIDEX_OPS_API_URL = 'https://app.gridex.se/api/v1'
process.env.VERCEL_ENV = 'production'
const originalFetch = globalThis.fetch
const calls = []
try {
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init, headers: new Headers(init.headers) })
    return json({ ...envelope([supportCase]), page: { limit: 20, offset: 0, returned: 1, has_more: false, next_cursor: null } })
  }
  assert.deepEqual((await fetchOpsCustomerSupportTickets(identity)).data, [supportCase])
  const read = calls.at(-1)
  assert.equal(read.url, 'https://app.gridex.se/api/v1/customer/support/cases?limit=20')
  assert.equal(read.headers.get('authorization'), 'Bearer gridex_live_support_runtime_secret')
  assert.equal(read.headers.get('x-gridex-auth-user-id'), userId)
  assert.equal(read.headers.get('x-gridex-customer-portal-user-id'), userId)
  assert.equal(read.headers.get('x-gridex-company-id'), null)
  assert.equal(read.init.cache, 'no-store')

  globalThis.fetch = async (url, init) => { calls.push({ url: String(url), init, headers: new Headers(init.headers) }); return json(envelope(supportCase), 201) }
  await createOpsCustomerSupportCase(identity, { title: 'Fråga', message: 'Text' }, key)
  await createOpsCustomerSupportCase(identity, { title: 'Fråga', message: 'Text' }, key)
  assert.equal(calls.at(-1).headers.get('Idempotency-Key'), key)
  assert.equal(calls.at(-2).headers.get('Idempotency-Key'), key)
  assert.deepEqual(JSON.parse(calls.at(-1).init.body), { title: 'Fråga', message: 'Text' })
  assert.equal(calls.at(-1).init.method, 'POST')

  globalThis.fetch = async () => json(envelope({ ...supportCase, messages: [message] }))
  assert.equal((await fetchOpsCustomerSupportCase(identity, caseReference)).data.messages[0].body, 'Svar')
  globalThis.fetch = async () => json(envelope({ ...supportCase, case_reference: 'support_case_999999999999999999999999', messages: [] }))
  await assert.rejects(() => fetchOpsCustomerSupportCase(identity, caseReference), (error) => error.code === 'support_response_invalid')

  globalThis.fetch = async () => json({ error: { code: 'support_case_closed', message: 'Ärendet är avslutat.', request_id: 'closed-trace' } }, 409)
  await assert.rejects(() => replyOpsCustomerSupportCase(identity, caseReference, { message: 'Hej' }, key), (error) => error.status === 409 && error.code === 'support_case_closed')

  globalThis.fetch = async (url, init) => { calls.push({ url: String(url), init, headers: new Headers(init.headers) }); return json(envelope(file), 201) }
  assert.deepEqual((await uploadOpsCustomerSupportAttachment(identity, caseReference, { bytes, contentType: 'application/pdf', fileName: 'min faktura.pdf' }, key)).data, file)
  assert.equal(calls.at(-1).headers.get('Content-Type'), 'application/pdf')
  assert.equal(calls.at(-1).headers.get('X-File-Name'), 'min%20faktura.pdf')
  assert.equal(calls.at(-1).headers.get('x-gridex-auth-user-id'), userId)
  assert.deepEqual(new Uint8Array(calls.at(-1).init.body), bytes)

  globalThis.fetch = async (url, init) => { calls.push({ url: String(url), init, headers: new Headers(init.headers) }); return new Response(bytes, { headers: { 'Content-Type': 'application/pdf', 'X-Gridex-Sha256': hash } }) }
  assert.deepEqual((await downloadOpsCustomerSupportAttachment(identity, caseReference, attachmentReference)).bytes, bytes)
  assert.equal(calls.at(-1).init.redirect, 'manual')
  assert.equal(calls.at(-1).init.cache, 'no-store')
  const blockers = [{ code: 'attachment_not_released', message: 'Bilagan inväntar kontroll.', field: null, recommended_action: 'contact_support' }]
  let errorCalls = 0
  globalThis.fetch = async () => {
    errorCalls++
    return new Response(JSON.stringify({
      error: { code: 'attachment_not_released', message: 'Bilagan inväntar kontroll.', retryable: false, field: null, blockers },
      request_id: 'download-payload-request', correlation_id: 'download-payload-correlation', contract_schema_version: version,
    }), { status: 503, headers: { 'content-type': 'application/json', 'Retry-After': '45' } })
  }
  let downloadError
  try { await downloadOpsCustomerSupportAttachment(identity, caseReference, attachmentReference) }
  catch (error) { downloadError = error }
  assert.equal(downloadError.status, 503)
  assert.equal(downloadError.retryable, false, 'binary download honors the canonical non-retryable decision even on HTTP 503')
  assert.equal(downloadError.requestId, 'download-payload-request', 'canonical envelope request ID survives without HTTP ID headers')
  assert.equal(downloadError.correlationId, 'download-payload-correlation')
  assert.deepEqual(downloadError.details.blockers, blockers)
  assert.equal(errorCalls, 1, 'download never silently repeats a single-use assertion')
  const downloadErrorResponse = customerApiErrorResponse(downloadError, { logLabel: 'support-download-regression', fallbackMessage: 'Fel' })
  const downloadErrorBody = await downloadErrorResponse.json()
  assert.equal(downloadErrorResponse.headers.get('retry-after'), '45')
  assert.equal(downloadErrorBody.error.request_id, 'download-payload-request')
  assert.equal(downloadErrorBody.error.correlation_id, 'download-payload-correlation')
  assert.equal(downloadErrorBody.error.retryable, false)
  assert.deepEqual(downloadErrorBody.error.blockers, blockers)

  globalThis.fetch = async () => new Response(JSON.stringify({
    error: { code: 'rate_limited', message: 'Vänta innan du försöker igen.', retryable: true, blockers: [] },
    request_id: 'payload-request', correlation_id: 'payload-correlation',
  }), { status: 429, headers: { 'content-type': 'application/json', 'Retry-After': '60', 'X-Request-Id': 'header-request', 'X-Correlation-Id': 'header-correlation' } })
  await assert.rejects(() => downloadOpsCustomerSupportAttachment(identity, caseReference, attachmentReference), (error) =>
    error.retryable && error.requestId === 'header-request' && error.correlationId === 'header-correlation' && error.details.retry_after === '60')

  globalThis.fetch = async () => new Response(bytes, { headers: { 'Content-Type': 'application/pdf', 'X-Gridex-Sha256': 'f'.repeat(64) } })
  await assert.rejects(() => downloadOpsCustomerSupportAttachment(identity, caseReference, attachmentReference), (error) => error.code === 'attachment_integrity_failed')
  globalThis.fetch = async () => new Response('<script>alert(1)</script>', { headers: { 'Content-Type': 'text/html', 'X-Gridex-Sha256': hash } })
  await assert.rejects(() => downloadOpsCustomerSupportAttachment(identity, caseReference, attachmentReference), (error) => error.code === 'support_response_invalid')
  globalThis.fetch = async () => new Response(null, { status: 302, headers: { location: 'https://attacker.invalid' } })
  await assert.rejects(() => downloadOpsCustomerSupportAttachment(identity, caseReference, attachmentReference), (error) => error.status === 502)
} finally { globalThis.fetch = originalFetch }

console.log('Support API runtime regressions passed: verified identity, source API, idempotency, internal visibility, cursor, upload bounds, download integrity and redirects.')
