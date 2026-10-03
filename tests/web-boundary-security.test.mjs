import assert from 'node:assert/strict'
import { readWebJson } from '../lib/api/webBoundary.ts'

const url = 'https://gridex.se/api/web/customer/support/cases'
const request = (headers = {}, body = '{}') => new Request(url, {
  method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body,
})
for (const origin of ['null', 'not a url', 'https://evil.example', 'https://support123.gridex.se@evil.example', 'https://support123.gridex.se/path']) {
  const result = await readWebJson(request({ origin }))
  assert.equal(result.ok, false)
  assert.equal(result.response.status, 403)
  assert.equal(result.response.headers.get('cache-control'), 'private, no-store')
}
assert.equal((await readWebJson(request({ origin: 'https://gridex.se' }))).ok, true)
assert.equal((await readWebJson(request({ 'sec-fetch-site': 'cross-site' }))).response.status, 403)
assert.equal((await readWebJson(request({ 'content-type': 'application/jsonp' }))).response.status, 415)
assert.equal((await readWebJson(request({}, '{invalid'))).response.status, 400)
assert.equal((await readWebJson(request({ 'content-length': '100' }), { maxBytes: 10 })).response.status, 413)

let cancelled = false
let reads = 0
const stream = new ReadableStream({
  pull(controller) {
    reads++
    controller.enqueue(new Uint8Array(8))
  },
  cancel() { cancelled = true },
}, { highWaterMark: 0 })
const result = await readWebJson(new Request(url, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: stream, duplex: 'half',
}), { maxBytes: 10 })
assert.equal(result.response.status, 413)
assert.equal(cancelled, true)
assert.equal(reads, 2, 'stop reading an unbounded chunked body at the limit')
console.log('Web request origin, media-type and streaming limits passed')
