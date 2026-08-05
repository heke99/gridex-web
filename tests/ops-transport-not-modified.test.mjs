import assert from 'node:assert/strict'

process.env.GRIDEX_API_KEY = 'gridex_live_transport_regression_secret'
process.env.GRIDEX_OPS_API_URL = 'https://app.gridex.se/api/v1'
process.env.VERCEL_ENV = 'production'

const originalFetch = globalThis.fetch
const { opsRequest } = await import('../lib/ops/transport.ts')

try {
  let observedUrl = null
  let observedRedirectMode = null
  globalThis.fetch = async (input, init) => {
    observedUrl = String(input)
    observedRedirectMode = init?.redirect ?? null
    return new Response(null, {
      status: 304,
      headers: {
        ETag: '"contracts-test-etag"',
        'X-Request-ID': '00000000-0000-4000-8000-000000000304',
      },
    })
  }

  const notModified = await opsRequest(
    '/api/v1/website/public-contracts',
    {
      method: 'GET',
      headers: { 'If-None-Match': '"contracts-test-etag"' },
    },
    { allowNotModified: true, cache: 'no-store' },
  )

  assert.equal(observedUrl, 'https://app.gridex.se/api/v1/website/public-contracts')
  assert.equal(observedRedirectMode, 'manual')
  assert.equal(notModified.status, 304)
  assert.equal(notModified.payload, null)
  assert.equal(notModified.contractVersion, null)
  assert.equal(notModified.headers.get('etag'), '"contracts-test-etag"')

  globalThis.fetch = async () => new Response(null, {
    status: 307,
    headers: { Location: 'https://example.invalid/credential-forwarding-target' },
  })

  await assert.rejects(
    () => opsRequest('/api/v1/website/public-contracts', { method: 'GET' }, { allowNotModified: true }),
    (error) => {
      assert.equal(error?.code, 'ops_redirect_blocked')
      assert.equal(error?.status, 502)
      assert.equal(error?.details?.status, 307)
      assert.equal(error?.details?.location, 'https://example.invalid/credential-forwarding-target')
      return true
    },
  )

  globalThis.fetch = async () => new Response(null, { status: 304 })
  await assert.rejects(
    () => opsRequest('/api/v1/integration/context', { method: 'GET' }),
    (error) => {
      assert.equal(error?.code, 'ops_not_modified_unexpected')
      assert.equal(error?.status, 502)
      return true
    },
  )

  globalThis.fetch = async () => new Response(JSON.stringify({
    error: {
      code: 'quote_reference_mismatch',
      message: 'Quote-underlaget har ändrats efter att det skapades.',
      action: 'refresh_quote',
      hint: 'Create a new canonical quote.',
      blockers: ['quote_basis_changed'],
      details: {
        expected_reference: 'quote_expected',
        received_reference: 'quote_received',
      },
    },
  }), {
    status: 409,
    headers: {
      'content-type': 'application/json',
      'x-request-id': '00000000-0000-4000-8000-000000000409',
    },
  })

  await assert.rejects(
    () => opsRequest('/api/v1/website/quote/validate', {
      method: 'POST',
      body: JSON.stringify({ quote_reference: 'quote_received' }),
    }),
    (error) => {
      assert.equal(error?.code, 'quote_reference_mismatch')
      assert.equal(error?.status, 409)
      assert.equal(error?.requestId, '00000000-0000-4000-8000-000000000409')
      assert.equal(error?.details?.action, 'refresh_quote')
      assert.equal(error?.details?.hint, 'Create a new canonical quote.')
      assert.deepEqual(error?.details?.blockers, ['quote_basis_changed'])
      assert.deepEqual(error?.details?.details, {
        expected_reference: 'quote_expected',
        received_reference: 'quote_received',
      })
      return true
    },
  )

  console.log('OPS transport 304/redirect/error-details regression tests: passed')
} finally {
  globalThis.fetch = originalFetch
}
