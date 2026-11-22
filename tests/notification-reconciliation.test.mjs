import assert from 'node:assert/strict'
import test from 'node:test'
import { POST } from '../app/api/internal/customer-portal/notifications/reconcile/route.ts'

process.env.CUSTOMER_PORTAL_OUTBOX_CRON_SECRET = 'test-cron'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.test'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'

function notification(id, customer = '1') {
  return {
    id: String(id),
    external_customer_id: customer,
    customer_number: customer,
    customer_email: id % 2 ? `User${customer}@example.test` : `user${customer}@example.test`,
    identity_resolution_attempt_count: 0,
  }
}

async function run(rows, { profile = () => [{ user_id: 'owner' }], failWrites = false } = {}) {
  const lookups = []
  const updates = []
  const original = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    const url = new URL(input)
    if (url.pathname.endsWith('/customer_profiles')) {
      lookups.push(url.searchParams)
      const result = profile(url.searchParams)
      return Response.json(result ?? { message: 'Database unavailable' }, { status: result ? 200 : 503 })
    }
    assert.ok(url.pathname.endsWith('/customer_notifications'))
    if (init.method !== 'PATCH') return Response.json(rows)
    assert.equal(url.searchParams.get('identity_resolution_status'), 'eq.pending')
    assert.equal(url.searchParams.get('identity_resolution_attempt_count'), 'eq.0')
    assert.equal(url.searchParams.get('user_id'), 'is.null')
    const id = url.searchParams.get('id').slice(3)
    updates.push({ id, ...JSON.parse(init.body) })
    return failWrites
      ? Response.json({ message: 'Database unavailable' }, { status: 503 })
      : Response.json({ id })
  }
  try {
    const response = await POST(new Request('https://example.test/reconcile', {
      headers: { authorization: 'Bearer test-cron' },
    }))
    return { status: response.status, result: await response.json(), lookups, updates }
  } finally {
    globalThis.fetch = original
  }
}

test('four profile lookups for 100 repeated identities and 400 for 100 unique identities', async () => {
  for (const repeated of [true, false]) {
    const batch = await run(Array.from({ length: 100 }, (_, id) => notification(id, repeated ? '1' : String(id))))
    assert.equal(batch.status, 200)
    assert.equal(batch.result.resolved, 100)
    assert.equal(batch.lookups.length, repeated ? 4 : 400)
    assert.equal(batch.updates.length, 100)
  }
})

test('conflicting references and duplicate profiles remain ambiguous', async () => {
  const batch = await run([notification(1, '1'), notification(2, '2')], {
    profile: (params) => {
      if (params.get('email') === 'eq.user1@example.test') return [{ user_id: 'other' }]
      if (params.get('external_customer_id') === 'eq.2') return [{ user_id: 'owner' }, { user_id: 'other' }]
      return [{ user_id: 'owner' }]
    },
  })
  assert.equal(batch.result.ambiguous, 2)
  assert.ok(batch.updates.every((row) => row.user_id === undefined))
})

test('isolated lookup failure schedules retry and a shared identifier can be read again', async () => {
  let failures = 0
  const batch = await run([notification(1), notification(2)], {
    profile: (params) => params.has('external_customer_id') && failures++ === 0 ? null : [{ user_id: 'owner' }],
  })
  assert.equal(batch.status, 200)
  assert.equal(batch.result.status, 'partial')
  assert.equal(batch.result.retriesScheduled, 1)
  assert.equal(batch.result.failed, 1)
  assert.equal(batch.result.resolved, 1)
  assert.equal(batch.lookups.length, 5)
  assert.ok(Date.parse(batch.updates[0].identity_resolution_next_attempt_at) > Date.now())
  assert.equal(batch.updates[0].identity_resolution_attempt_count, 1)
  assert.equal(batch.updates[1].user_id, 'owner')
})

test('batch-wide database failure is reported even if retry writes also fail', async () => {
  const batch = await run([notification(1), notification(2)], { profile: () => null, failWrites: true })
  assert.equal(batch.status, 503)
  assert.equal(batch.result.status, 'failed')
  assert.equal(batch.result.failed, 2)
  assert.equal(batch.result.retriesScheduled, 0)
  assert.equal(batch.result.retryWriteFailures, 2)
})
