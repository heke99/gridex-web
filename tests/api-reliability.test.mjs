import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchReleaseManifest } from '../scripts/openapi-common.mjs'
import { opsRequest } from '../lib/ops/transport.ts'

process.env.GRIDEX_API_KEY = 'gridex_live_offline_reliability_test'
process.env.GRIDEX_OPS_API_URL = 'https://app.gridex.se/api/v1'
process.env.GRIDEX_OPS_TIMEOUT_MS = '1000'
process.env.VERCEL_ENV = 'production'

test('release validation separates documentation and runtime revisions, but rejects inconsistent specifications', async t => {
  const original = globalThis.fetch
  t.after(() => { globalThis.fetch = original })
  const release = {
    release_version: '2026-10-12.1', website_openapi_version: '2026-10-12.1',
    customer_portal_openapi_version: '2026-10-12.1', runtime_contract_version: '2026-10-09.1',
    staff_openapi_version: '2026-10-12.1',
    guide_version: '2026-10-12.1', minimum_tenant_integration_version: '2026-10-02.3',
    specifications: Object.fromEntries(['website', 'customer_portal', 'staff'].map(name => [name, {
      contract_version: '2026-10-12.1', url: `https://app.gridex.se/api/v1/openapi/${name === 'staff' ? 'staff-v1' : name}.json`, sha256: 'a'.repeat(64),
    }])),
  }
  globalThis.fetch = async () => Response.json(release)
  assert.equal((await fetchReleaseManifest()).runtime_contract_version, '2026-10-09.1')
  release.specifications.website.contract_version = '2026-10-04.1'
  await assert.rejects(() => fetchReleaseManifest())
})

for (const retryAfter of ['120', '999999999999999999999999', new Date(Date.now() + 120_000).toUTCString()]) {
  test(`rate limiting never retries earlier than Retry-After: ${retryAfter}`, async t => {
    const original = globalThis.fetch
    t.after(() => { globalThis.fetch = original })
    let calls = 0
    globalThis.fetch = async () => {
      calls++
      return Response.json({ error: { code: 'rate_limited', retryable: true }, request_id: 'limit-request' }, {
        status: 429, headers: { 'retry-after': retryAfter },
      })
    }
    await assert.rejects(() => opsRequest('/api/v1/customer/me'), error => error.status === 429 && error.code === 'rate_limited')
    assert.equal(calls, 1)
  })
}

test('writes are submitted once with the original idempotency key on a retryable failure', async t => {
  const original = globalThis.fetch
  t.after(() => { globalThis.fetch = original })
  let calls = 0
  globalThis.fetch = async (_url, init) => {
    calls++
    assert.equal(init.headers.get('Idempotency-Key'), 'reliability-write-key')
    return Response.json({ error: { code: 'service_unavailable', retryable: true } }, { status: 503 })
  }
  await assert.rejects(() => opsRequest('/api/v1/customer/profile-update', {
    method: 'POST', headers: { 'Idempotency-Key': 'reliability-write-key' }, body: '{}',
  }), error => error.status === 503)
  assert.equal(calls, 1)
})

test('oversized streamed JSON is cancelled before it can exhaust server memory', async t => {
  const original = globalThis.fetch
  t.after(() => { globalThis.fetch = original })
  let cancelled = false
  let chunks = 0
  globalThis.fetch = async () => new Response(new ReadableStream({
    pull(controller) {
      if (chunks++ === 12) controller.close()
      else controller.enqueue(new Uint8Array(1024 * 1024).fill(32))
    },
    cancel() { cancelled = true },
  }), { headers: { 'content-type': 'application/json' } })
  await assert.rejects(() => opsRequest('/api/v1/customer/me'), error => error.code === 'ops_response_too_large' && error.status === 502)
  assert.equal(cancelled, true)
})
