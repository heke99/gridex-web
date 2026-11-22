import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { checkOpsIntegrationReadiness } from '../lib/ops/readiness.ts'
import { checkOpsCustomerPortalReadiness } from '../lib/ops/portalReadiness.ts'
import test from 'node:test'
import { opsRequest } from '../lib/ops/transport.ts'
import { POST as resolveEnergyArea } from '../app/api/checkout/energy-area/resolve/route.ts'
import { POST as marketPrice } from '../app/api/web/market-price/current/route.ts'
import { getVerifiedOpsIntegrationContext } from '../lib/ops/client.ts'
import { GRIDEX_WEBSITE_API_CONTRACT_VERSION as version } from '../lib/ops/contract.ts'
import { API_PERFORMANCE_PREFIX, API_PERFORMANCE_SCHEMA, observeApiOperation, recordApiCache, recordOpsPerformance } from '../lib/observability/apiPerformance.ts'
import { parseApiPerformanceEvents, summarizeApiPerformance } from '../scripts/summarize-api-performance.mjs'

process.env.GRIDEX_API_KEY = 'gridex_performance_synthetic_private_key'
process.env.GRIDEX_OPS_API_URL = 'https://app.gridex.se/api/v1'
process.env.VERCEL_ENV = 'production'
process.env.GRIDEX_OPS_TIMEOUT_MS = '1000'

function capture(t) {
  const info = console.info, fetch = globalThis.fetch, lines = []
  console.info = (...args) => { if (String(args[0]).startsWith(API_PERFORMANCE_PREFIX)) lines.push(args[0]) }
  t.after(() => { console.info = info; globalThis.fetch = fetch })
  return { lines, events: () => parseApiPerformanceEvents(lines.join('\n')) }
}
function ok(payload = {}) {
  return Response.json(payload, { headers: { 'X-Gridex-Contract-Version': version } })
}
function deferred() {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}
const context = {
  data: {
    organization_reference: 'organization_performance_01234567890123456789',
    api_client_reference: 'api_client_performance_0123456789',
    api_version: 'v1', authoritative_identity: 'api_key', contract_version: version,
    active_scopes: ['integration_context.read', 'website_public_contracts.read'],
    configuration: {
      required_environment_variables: ['GRIDEX_API_KEY'], api_base_url: 'https://app.gridex.se/api/v1',
      authentication: { header: 'Authorization', scheme: 'Bearer', server_side_only: true },
      openapi_url: 'https://app.gridex.se/api/v1/openapi/website-integration-v1.json',
      customer_portal_openapi_url: 'https://app.gridex.se/api/v1/openapi/customer-portal-v1.json',
      application_reference_location: 'top_level',
    },
    capabilities: {
      website_checkout_ready: true, customer_portal_ready: false, complete_integration_ready: false,
      missing_website_scopes: [], missing_customer_portal_scopes: ['customer_profile.read'], missing_recommended_scopes: [],
    },
  },
  request_id: '00000000-0000-4000-8000-000000000123', contract_schema_version: version,
}

test('one operation record contains actual transport calls without request or response secrets', async t => {
  const log = capture(t)
  let calls = 0
  globalThis.fetch = async () => { calls++; return ok({ private_payload: 'NEVER_LOG_RESPONSE' }) }
  const result = await observeApiOperation('quote', () => observeApiOperation('contracts_feed', async () => {
    recordApiCache('integration_context', 'hit')
    await opsRequest('/api/v1/website/quote?address=NEVER_LOG_QUERY', {
      method: 'POST', body: JSON.stringify({ address: 'NEVER_LOG_BODY' }),
      headers: { 'Idempotency-Key': 'NEVER_LOG_IDEMPOTENCY' },
    })
    return Response.json({ preserved: true }, { status: 201, headers: { 'Cache-Control': 'private, no-store' } })
  }))
  assert.equal(calls, 1)
  assert.equal(result.status, 201)
  assert.equal(result.headers.get('cache-control'), 'private, no-store')
  assert.deepEqual(await result.json(), { preserved: true })
  const events = log.events()
  assert.equal(events.length, 1, 'nested measurements do not duplicate upstream counts')
  assert.equal(events[0].surface, 'quote')
  assert.equal(events[0].upstream[0].route, '/website/quote')
  assert.equal(events[0].upstream[0].attempts, 1)
  assert.equal(events[0].cache[0].result, 'hit')
  assert.equal(events[0].outcome, 'success')
  assert.ok(events[0].duration_ms >= events[0].upstream[0].duration_ms - .1)
  assert.doesNotMatch(log.lines.join(''), /NEVER_LOG|gridex_performance_synthetic_private_key|Authorization|Idempotency/)
})

test('concurrent operations keep their upstream and cache observations isolated', async t => {
  const log = capture(t), gate = deferred()
  globalThis.fetch = async () => { await gate.promise; return ok() }
  const a = observeApiOperation('energy_area', async () => {
    recordApiCache('integration_context', 'hit')
    await opsRequest('/api/v1/website/energy-area/resolve', { method: 'POST', body: '{}' })
  })
  const b = observeApiOperation('market_price', async () => {
    recordApiCache('integration_context', 'miss')
    await opsRequest('/api/v1/website/market-price/current', { method: 'POST', body: '{}' })
  })
  gate.resolve(); await Promise.all([a, b])
  const events = log.events()
  assert.equal(events.length, 2)
  const first = events.find(event => event.surface === 'energy_area')
  const second = events.find(event => event.surface === 'market_price')
  assert.equal(first.upstream.length, 1); assert.equal(second.upstream.length, 1)
  assert.equal(first.upstream[0].route, '/website/energy-area/resolve')
  assert.equal(second.upstream[0].route, '/website/market-price/current')
  assert.equal(first.cache[0].result, 'hit'); assert.equal(second.cache[0].result, 'miss')
})

test('actual context cache branches distinguish a miss, shared pending reads, memory hit and forced verification', async t => {
  const log = capture(t), gate = deferred()
  let calls = 0
  globalThis.fetch = async () => { calls++; await gate.promise; return ok(context) }
  await observeApiOperation('contracts_endpoint', async () => {
    const reads = Array.from({ length: 10 }, () => getVerifiedOpsIntegrationContext())
    gate.resolve(); await Promise.all(reads)
    await getVerifiedOpsIntegrationContext()
    await getVerifiedOpsIntegrationContext(true)
  })
  assert.equal(calls, 2)
  const report = summarizeApiPerformance(log.events())
  assert.equal(report.upstream['GET /integration/context'].network_attempts, 2)
  assert.equal(report.cache.integration_context.miss, 1)
  assert.equal(report.cache.integration_context.join, 9)
  assert.equal(report.cache.integration_context.hit, 1)
  assert.equal(report.cache.integration_context.bypass, 1)
})

test('a read retry counts both network attempts and the intermediate 429', async t => {
  const log = capture(t)
  let calls = 0
  globalThis.fetch = async () => ++calls === 1
    ? Response.json({ error: { code: 'rate_limited', retryable: true } }, { status: 429, headers: { 'Retry-After': '0' } })
    : ok()
  await observeApiOperation('contracts_endpoint', () => opsRequest('/api/v1/website/public-contracts'))
  const item = log.events()[0].upstream[0]
  assert.equal(calls, 2); assert.equal(item.attempts, 2)
  assert.equal(item.rate_limited_responses, 1)
  assert.equal(item.outcome, 'success'); assert.equal(item.status, 200)
})

test('failed writes remain one attempt and keep the original business error', async t => {
  const log = capture(t)
  let calls = 0
  globalThis.fetch = async () => { calls++; return Response.json({ error: { code: 'service_unavailable', retryable: true } }, { status: 503 }) }
  await assert.rejects(observeApiOperation('quote', () => opsRequest('/api/v1/website/quote', { method: 'POST', body: '{}' })), error => error.status === 503)
  const event = log.events()[0]
  assert.equal(calls, 1); assert.equal(event.outcome, 'error')
  assert.equal(event.upstream[0].attempts, 1); assert.equal(event.upstream[0].status, 503)
})

test('timeout and response validation failures remain failures even after HTTP success', async t => {
  const log = capture(t)
  globalThis.fetch = async () => new Response('invalid json', { headers: { 'Content-Type': 'application/json' } })
  await assert.rejects(observeApiOperation('quote', () => opsRequest('/api/v1/website/quote', { method: 'POST', body: '{}' })), error => error.code === 'ops_response_json_invalid')
  assert.equal(log.events()[0].upstream[0].status, 200)
  assert.equal(log.events()[0].upstream[0].outcome, 'error')
  globalThis.fetch = async () => new Promise(() => {})
  await assert.rejects(observeApiOperation('market_price', () => opsRequest('/api/v1/website/market-price/current', { method: 'POST', body: '{}' })), error => error.status === 504)
  const item = log.events()[1].upstream[0]
  assert.equal(item.attempts, 1); assert.equal(item.status, null); assert.equal(item.outcome, 'error')
})

test('allowed 304, response errors and post-response work are counted without being lost or duplicated', async t => {
  const log = capture(t), gate = deferred()
  let after
  globalThis.fetch = async () => new Response(null, { status: 304 })
  const result = await observeApiOperation('contracts_endpoint', async () => {
    after = gate.promise.then(() => opsRequest('/api/v1/website/public-contracts', undefined, { allowNotModified: true }))
    return Response.json({ error: true }, { status: 429 })
  })
  assert.equal(result.status, 429)
  assert.equal(log.events()[0].outcome, 'error')
  gate.resolve(); await after
  const events = log.events()
  assert.equal(events.length, 2); assert.equal(events[1].kind, 'upstream')
  assert.equal(events[1].upstream[0].status, 304)
  assert.equal(events[1].upstream[0].outcome, 'success')
})

test('logging failure never changes successful requests or causes a write retry', async t => {
  capture(t)
  let calls = 0
  console.info = () => { throw Error('Modeled log exporter failure') }
  globalThis.fetch = async () => { calls++; return ok() }
  const result = await observeApiOperation('quote', async () => {
    recordApiCache('integration_context', 'hit')
    await opsRequest('/api/v1/website/quote', { method: 'POST', body: '{}' })
    return new Response(null, { status: 202 })
  })
  assert.equal(result.status, 202); assert.equal(calls, 1)
})

test('observation size is bounded and dynamic identifiers are replaced by fixed labels', async t => {
  const log = capture(t)
  await observeApiOperation('energy_area', async () => {
    for (let i = 0; i < 40; i++) recordOpsPerformance({ path: '/api/v1/customer/NEVER_LOG_CUSTOMER?token=NEVER_LOG_TOKEN', method: 'GET', durationMs: 1, attempts: 1, rateLimitedResponses: 0, status: 200, success: true })
    recordApiCache('NEVER_LOG_LAYER', 'hit')
  })
  const event = log.events()[0]
  assert.equal(event.upstream.length, 32); assert.equal(event.upstream_truncated, 8)
  assert.equal(event.upstream[0].route, '/customer/*')
  assert.doesNotMatch(log.lines.join(''), /NEVER_LOG/)
})

test('report percentiles, cache denominators and retries use supplied records only', () => {
  const rows = Array.from({ length: 100 }, (_, i) => ({
    schema: API_PERFORMANCE_SCHEMA, kind: 'operation', surface: 'quote', duration_ms: i + 1, outcome: 'success',
    upstream: [{ route: '/website/quote', method: 'POST', duration_ms: i + 1, attempts: 1, rate_limited_responses: 0, status: 200, outcome: 'success' }],
    cache: [],
  }))
  rows[0].cache = [
    { layer: 'integration_context', result: 'hit', count: 8 }, { layer: 'integration_context', result: 'miss', count: 2 },
    { layer: 'integration_context', result: 'join', count: 4 }, { layer: 'integration_context', result: 'bypass', count: 1 },
    { layer: 'public_contract_data', result: 'lookup', count: 10 }, { layer: 'public_contract_data', result: 'fill', count: 3 },
  ]
  const exported = { content: [{ type: 'text', text: JSON.stringify({ result: { logs: rows.map(row => ({ message: API_PERFORMANCE_PREFIX + JSON.stringify(row) })) } }) }] }
  const events = parseApiPerformanceEvents(JSON.stringify(exported))
  const report = summarizeApiPerformance(events)
  assert.equal(report.records, 100)
  assert.equal(report.operations.quote.p50_ms, 50); assert.equal(report.operations.quote.p95_ms, 95)
  assert.equal(report.upstream['POST /website/quote'].network_attempts, 100)
  assert.equal(report.cache.integration_context.direct_hit_rate, 57.1)
  assert.equal(report.cache.integration_context.network_or_database_reads_avoided_rate, 85.7)
  assert.equal(Object.hasOwn(report.cache.public_contract_data, 'direct_hit_rate'), false)
  assert.equal(parseApiPerformanceEvents('irrelevant or malformed logs').length, 0)
  const hostile = parseApiPerformanceEvents(JSON.stringify({ schema: API_PERFORMANCE_SCHEMA, kind: 'operation', surface: 'PRIVATE_EMAIL', duration_ms: -1, upstream: [{ route: '/PRIVATE_ADDRESS', method: 'PRIVATE_PASSWORD' }], cache: [{ layer: 'PRIVATE_IP', result: 'hit', count: 1 }] }))
  assert.doesNotMatch(JSON.stringify(summarizeApiPerformance(hostile)), /PRIVATE_/)
})

test('market price distinguishes quota exhaustion, limiter failure and OPS rate limiting', async t => {
  capture(t)
  const previous = Object.fromEntries(['NODE_ENV', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].map(key => [key, process.env[key]]))
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })
  Object.assign(process.env, {
    NODE_ENV: 'production',
    NEXT_PUBLIC_SUPABASE_URL: 'https://db.example.test',
    SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-key',
  })
  for (const scenario of ['quota', 'unavailable', 'ops']) {
    let opsCalls = 0
    globalThis.fetch = async input => {
      const url = new URL(input)
      if (url.hostname === 'db.example.test') {
        assert.match(url.pathname, /consume_distributed_rate_limit$/)
        return scenario === 'unavailable'
          ? Response.json({ message: 'unavailable' }, { status: 503 })
          : Response.json([{ allowed: scenario === 'ops', remaining: 0, reset_at: new Date(Date.now() + 60_000).toISOString() }])
      }
      if (url.pathname.endsWith('/integration/context')) return ok(context)
      assert.match(url.pathname, /\/website\/market-price\/current$/)
      opsCalls += 1
      return Response.json({ error: { code: 'rate_limited' } }, {
        status: 429, headers: { 'Retry-After': '120', 'X-Request-Id': 'market-ops-request' },
      })
    }
    const response = await marketPrice(new Request('https://gridex.example.test/api/web/market-price/current', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolution_id: '11111111-1111-4111-8111-111111111111' }),
    }))
    const body = await response.json()
    assert.equal(response.status, scenario === 'unavailable' ? 503 : 429, JSON.stringify(body))
    assert.equal(body.error.code, scenario === 'unavailable' ? 'rate_limit_unavailable' : 'rate_limited')
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
    if (scenario === 'ops') {
      assert.equal(response.headers.get('retry-after'), '120')
      assert.equal(body.error.request_id, 'market-ops-request')
      assert.equal(opsCalls, 1)
    } else {
      assert.ok(Number(response.headers.get('retry-after')) > 0)
      assert.match(body.error.request_id, /^[a-f0-9-]{36}$/)
      assert.equal(opsCalls, 0)
    }
  }
})

test('cancelled address checks stop before the next boundary and abort the OPS transport', async t => {
  capture(t)
  const settings = {
    NEXT_PUBLIC_SUPABASE_URL: 'https://address-db.example.test',
    SUPABASE_SERVICE_ROLE_KEY: 'synthetic-address-db-key',
    GRIDEX_WEBSITE_STATE_SIGNING_SECRET: 'synthetic-address-signing-secret-for-tests',
  }
  const previous = Object.entries(settings).map(([key, value]) => [key, process.env[key], value])
  for (const [key, , value] of previous) process.env[key] = value
  t.after(() => {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })
  for (const phase of ['before-request', 'quota', 'ops']) {
    const controller = new AbortController()
    const calls = []
    let opsSignal
    if (phase === 'before-request') controller.abort()
    globalThis.fetch = async (input, init) => {
      const url = new URL(input)
      if (url.pathname.endsWith('/consume_distributed_rate_limit')) {
        calls.push('quota')
        if (phase === 'quota') controller.abort()
        return Response.json([{ allowed: true, remaining: 29, reset_at: new Date().toISOString() }])
      }
      if (url.pathname.endsWith('/integration/context')) return ok(context)
      calls.push(url.pathname)
      if (url.pathname !== '/api/v1/website/energy-area/resolve') throw Error('Unexpected request')
      opsSignal = init.signal
      return new Promise((_, reject) => {
        opsSignal.addEventListener('abort', () => reject(opsSignal.reason), { once: true })
        controller.abort()
      })
    }
    const response = await resolveEnergyArea(new Request('https://gridex.example.test/api/checkout/energy-area/resolve', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postal_code: '11151', city: 'Stockholm', street: 'Testgatan 1', requested_start_mode: 'earliest_possible' }),
    }))
    assert.equal(response.status, 499, await response.text())
    const expected = { 'before-request': [], quota: ['quota'], ops: ['quota', '/api/v1/website/energy-area/resolve'] }
    assert.deepEqual(calls, expected[phase])
    if (phase === 'ops') assert.equal(opsSignal.aborted, true)
  }
  const operations = []
  globalThis.fetch = async input => {
    const pathname = new URL(input).pathname
    operations.push(pathname)
    assert.match(pathname, /consume_distributed_rate_limit$/)
    return Response.json([{ allowed: true, remaining: 29, reset_at: new Date().toISOString() }])
  }
  const oversized = await resolveEnergyArea(new Request('https://gridex.example.test/api/checkout/energy-area/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ street: 'a'.repeat(181), facility_id: 'synthetic-facility' }),
  }))
  assert.equal(oversized.status, 400)
  assert.equal((await oversized.json()).error.field, 'address')
  assert.equal(operations.length, 1)
})

test('website readiness shares one fresh context and one catalogue and labels a failed dependency', async t => {
  capture(t)
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/public-contracts.ops-2026-10-04.1.json', import.meta.url), 'utf8')
    .replaceAll('2026-10-04.1', version))
  const fixtureContext = { ...context, data: { ...context.data, organization_reference: fixture.meta.organization_reference } }
  for (const catalogueOk of [true, false]) {
    const paths = []
    globalThis.fetch = async input => {
      const url = new URL(input)
      paths.push(url.pathname)
      if (url.pathname.endsWith('/integration/context')) return ok(fixtureContext)
      if (url.pathname.endsWith('/website/public-contracts')) {
        return catalogueOk ? ok(fixture) : Response.json({ error: { code: 'catalogue_denied' } }, { status: 403 })
      }
      if (url.pathname.endsWith('/legal-bundle')) {
        assert.equal(url.searchParams.get('offer_reference'), 'offer_example')
        return Response.json({ error: { code: 'legal_denied' } }, { status: 403 })
      }
      return Response.json({ error: { code: 'validation_error' } }, { status: 400 })
    }
    const result = await checkOpsIntegrationReadiness()
    assert.equal(paths.filter(path => path.endsWith('/integration/context')).length, 1)
    assert.equal(paths.filter(path => path.endsWith('/website/public-contracts')).length, 1)
    assert.equal(paths.filter(path => path.endsWith('/legal-bundle')).length, Number(catalogueOk))
    assert.equal(result.probes.find(probe => probe.name === 'website_contracts.read').ok, catalogueOk)
    assert.equal(result.probes.find(probe => probe.name === 'website_legal.read').code,
      catalogueOk ? 'legal_denied' : 'legal_readiness_catalogue_unavailable')
  }
})

test('portal readiness overlaps support and portal probes without exceeding five in flight', async t => {
  const log = capture(t)
  let active = 0
  let peak = 0
  const activeSupport = new Set()
  let overlapped = false
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
  globalThis.fetch = async (input, init) => {
    const url = new URL(input)
    if (url.pathname.endsWith('/integration/context')) {
      await delay(20)
      return ok(context)
    }
    const support = url.pathname.includes('/support/')
    const token = Symbol()
    if (support) activeSupport.add(token)
    else overlapped ||= activeSupport.size > 0
    active += 1
    peak = Math.max(peak, active)
    await delay(support ? 35 : 25)
    active -= 1
    activeSupport.delete(token)
    if (support && init.method === 'POST') {
      return Response.json({ error: { code: 'rate_limited' } }, { status: 429, headers: { 'Retry-After': '120' } })
    }
    return Response.json({ error: { code: 'validation_error' } }, { status: 400 })
  }
  const start = performance.now()
  const result = await checkOpsCustomerPortalReadiness()
  console.log(`Synthetic portal readiness ${(performance.now() - start).toFixed(1)} ms, peak ${peak}`)
  assert.equal(overlapped, true)
  assert.equal(peak, 5)
  assert.equal(result.probes.length, 5)
  assert.ok(result.probes.every(probe => probe.ok))
  assert.deepEqual(result.support.probes.map(probe => probe.status), [400, 429])
  assert.equal(result.support.ready, false)
  assert.equal(log.events().flatMap(event => event.upstream).reduce((sum, row) => sum + row.rate_limited_responses, 0), 1)
})
