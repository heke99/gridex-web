import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readAttachmentRequest } from '../lib/support/attachmentRequest.ts'
import { attachmentFileName } from '../lib/support/attachmentRules.ts'
import { readWebJson } from '../lib/api/webBoundary.ts'

const request = (headers = {}, body = '%PDF-1.7\nSynthetic\n%%EOF') => new Request('https://support123.gridex.se/cases/example/attachments', {
  method: 'POST', body, headers: { Origin: 'https://support123.gridex.se', 'Content-Type': 'application/pdf', 'Idempotency-Key': 'attachment-operation-1', ...headers },
})
test('upload boundary rejects cross-origin, oversized, unsupported, malformed and empty bodies', async () => {
  for (const [input, status] of [[request({ Origin: 'https://evil.example' }), 403], [request({ 'Sec-Fetch-Site': 'cross-site' }), 403],
    [request({ 'Content-Length': '4194305' }), 413], [request({ 'Content-Type': 'text/html' }), 415],
    [request({ 'X-File-Name': '%zz' }), 400], [request({ 'Idempotency-Key': 'short' }), 400], [request({}, ''), 400]]) {
    assert.equal((await readAttachmentRequest(input)).response.status, status)
  }
})
test('upload boundary preserves exact bytes and retry key; encoded Swedish filenames fit the contract', async () => {
  const upload = await readAttachmentRequest(request())
  assert.equal(upload.response, undefined)
  assert.equal(new TextDecoder().decode(upload.bytes), '%PDF-1.7\nSynthetic\n%%EOF')
  assert.equal(upload.key, 'attachment-operation-1')
  const encoded = attachmentFileName('räkning'.repeat(100) + '.pdf')
  assert.ok(encoded.length <= 200)
  assert.doesNotThrow(() => decodeURIComponent(encoded))
})

test('checkout JSON rejects streamed overflow early and cancels unread input', async () => {
  let cancelled = false
  const body = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('x'.repeat(100))) }, cancel() { cancelled = true } })
  const input = new Request('https://gridex.se/api/checkout/quote', { method: 'POST', body, duplex: 'half', headers: { 'Content-Type': 'application/json', Origin: 'https://gridex.se' } })
  const result = await readWebJson(input, { maxBytes: 50 })
  assert.equal(result.response.status, 413)
  assert.equal(cancelled, true)
  for (const headers of [{ Origin: 'invalid origin' }, { 'Content-Type': 'application/json-untrusted' }]) {
    const denied = await readWebJson(new Request('https://gridex.se/api/checkout/quote', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json', ...headers } }))
    assert.equal(denied.ok, false)
  }
})
