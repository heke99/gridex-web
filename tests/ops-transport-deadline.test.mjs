import assert from 'node:assert/strict'
import { opsRequest } from '../lib/ops/transport.ts'
import { GRIDEX_WEBSITE_API_CONTRACT_VERSION as version } from '../lib/ops/contract.ts'

process.env.GRIDEX_API_KEY = 'gridex_live_deadline_regression'
process.env.GRIDEX_OPS_API_URL = 'https://app.gridex.se/api/v1'
process.env.VERCEL_ENV = 'production'
process.env.GRIDEX_OPS_TIMEOUT_MS = '1000'
const originalFetch = globalThis.fetch
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'X-Gridex-Contract-Version': version },
})

try {
  let calls = 0
  globalThis.fetch = async () => {
    calls += 1
    const response = json({ data: 'never arrives' })
    response.json = () => new Promise(() => {})
    return response
  }
  const started = Date.now()
  await assert.rejects(() => opsRequest('/api/v1/customer/profile-update', { method: 'POST', body: '{}' }),
    (error) => error.code === 'ops_request_timeout' && error.status === 504)
  assert.equal(calls, 1, 'mutations never retry after an uncertain response')
  assert.ok(Date.now() - started < 2000, 'a stalled JSON body is covered by the request deadline')

  globalThis.fetch = async () => new Response('{broken', {
    headers: { 'content-type': 'application/json', 'X-Gridex-Contract-Version': version },
  })
  await assert.rejects(() => opsRequest('/api/v1/customer/me'),
    (error) => error.code === 'ops_response_json_invalid' && error.retryable === false)

  calls = 0
  globalThis.fetch = async () => {
    calls += 1
    return json({ error: { code: 'tenant_disabled', message: 'Tenant disabled.', retryable: false } }, 503)
  }
  await assert.rejects(() => opsRequest('/api/v1/customer/me'), (error) => error.code === 'tenant_disabled')
  assert.equal(calls, 1, 'an explicit non-retryable API decision is respected')

  calls = 0
  globalThis.fetch = async () => {
    calls += 1
    const response = json({ error: { code: 'rate_limited', message: 'Try later.', retryable: true } }, 429)
    response.headers.set('Retry-After', '30')
    return response
  }
  await assert.rejects(() => opsRequest('/api/v1/customer/me'),
    (error) => error.code === 'rate_limited' && error.details.retry_after === '30')
  assert.equal(calls, 1, 'a long Retry-After is returned without prematurely retrying')

  const assertions = []
  globalThis.fetch = async (_url, init) => {
    assertions.push(new Headers(init.headers).get('x-gridex-customer-assertion'))
    return assertions.length === 1
      ? json({ error: { code: 'temporary', message: 'Retry.', retryable: true } }, 503)
      : json({ data: 'success' })
  }
  const result = await opsRequest('/api/v1/customer/me', {}, {
    headersForAttempt: (attempt) => ({ 'x-gridex-customer-assertion': `assertion-${attempt}` }),
  })
  assert.equal(result.payload.data, 'success')
  assert.deepEqual(assertions, ['assertion-1', 'assertion-2'])

  const controller = new AbortController()
  calls = 0
  globalThis.fetch = async () => {
    calls += 1
    setTimeout(() => controller.abort(new Error('caller_cancelled')), 10)
    return json({ error: { code: 'temporary', message: 'Retry.', retryable: true } }, 503)
  }
  await assert.rejects(() => opsRequest('/api/v1/customer/me', { signal: controller.signal }), /caller_cancelled/)
  assert.equal(calls, 1, 'caller cancellation also interrupts the retry backoff')
  console.log('OPS body deadlines, invalid JSON, retry decisions, fresh assertions and cancellation regressions passed')
} finally {
  globalThis.fetch = originalFetch
}
