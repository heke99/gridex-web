import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { AsyncLocalStorage } from 'node:async_hooks'
import { createHash, createHmac } from 'node:crypto'
import test from 'node:test'

// Next initializes its actual shared async stores from this runtime global.
globalThis.AsyncLocalStorage = AsyncLocalStorage
const { workAsyncStorage } = await import('next/dist/server/app-render/work-async-storage.external.js')
const { workUnitAsyncStorage } = await import('next/dist/server/app-render/work-unit-async-storage.external.js')
const { createPatchedFetcher } = await import('next/dist/server/lib/patch-fetch.js')
const { loadWebsitePublicContractFeed } = await import('../lib/website/publicContractFeed.ts')
const { WEBSITE_PUBLIC_CONTRACTS_CACHE_TAG } = await import('../lib/website/publicContractCache.ts')
const { GRIDEX_WEBSITE_API_CONTRACT_VERSION: version } = await import('../lib/ops/contract.ts')

process.env.GRIDEX_API_KEY = 'gridex_refresh_synthetic_private_key'
process.env.GRIDEX_OPS_API_URL = 'https://app.gridex.se/api/v1'
process.env.VERCEL_ENV = 'production'
process.env.GRIDEX_OPS_TIMEOUT_MS = '1000'

function fixture(t) {
  const original = { fetch: globalThis.fetch, info: console.info, warn: console.warn, error: console.error }
  const entries = new Map(), warnings = [], errors = [], nativeScopes = []
  let calls = 0, status = 200, gate = null, clock = 0
  const state = globalThis.__contractRefreshFixture = {
    identity: 'synthetic-tenant-a', providerOptions: [], persisted: [], snapshotReads: 0, storeResult: { stored: true, result: 'stored' },
    snapshot: {
      contracts: [], blocked_contracts: [], warnings: [], compatibility_issues: [],
      stale: false, feed_state: 'canonical_empty', publication_revision: 42,
      fetched_at: new Date(Date.now() - 20_000).toISOString(),
      contract_version: version, parser_version: 'synthetic', schema_sha256: 'a'.repeat(64),
      empty_feed_authorization: { authorized: true, reason: 'no_published_offers' },
      upstream_status: 200, etag: '"synthetic-42"', source: 'cache',
    },
  }
  console.info = () => {}
  console.warn = (...args) => warnings.push(args)
  console.error = (...args) => errors.push(args)
  globalThis.fetch = createPatchedFetcher(async () => {
    calls++
    nativeScopes.push(workUnitAsyncStorage.getStore()?.type)
    if (gate) await gate
    return Response.json(status === 200 ? {} : { error: { code: 'TEMPORARILY_UNAVAILABLE', retryable: true } }, {
      status, headers: { 'X-Gridex-Contract-Version': version, 'Retry-After': '120' },
    })
  }, { workAsyncStorage, workUnitAsyncStorage })
  // Fake only incremental-cache persistence and time; Next owns keying,
  // expiry decisions, tagged entries, callback scopes and revalidation.
  const incrementalCache = {
    generateSimpleCacheKey: async key => createHash('sha256').update(key).digest('hex'),
    async get(key) {
      const entry = entries.get(key)
      return entry ? { value: entry.value, isStale: clock >= entry.expires } : null
    },
    async set(key, value, options) {
      entries.set(key, { value, tags: options.tags, expires: clock + value.revalidate * 1000 })
    },
  }
  t.after(() => {
    Object.assign(console, { info: original.info, warn: original.warn, error: original.error })
    globalThis.fetch = original.fetch
    delete globalThis.__contractRefreshFixture
  })
  function request(isStaticGeneration = true) {
    const tasks = []
    const store = { route: '/', isStaticGeneration, incrementalCache, nextFetchId: 1,
      pendingRevalidates: {}, afterContext: { after: task => tasks.push(task) } }
    const unit = { type: 'prerender-legacy', phase: 'render', revalidate: 15, tags: [], implicitTags: { tags: [] } }
    if (!isStaticGeneration) Object.assign(unit, { type: 'request', url: { pathname: '/api/web/contracts', search: '' } })
    const run = task => workAsyncStorage.run(store, () => workUnitAsyncStorage.run(unit, task))
    return {
      tasks, unit,
      load: input => run(() => loadWebsitePublicContractFeed({ context: 'refresh-test', ...input })),
      async drain() {
        unit.phase = 'after'
        await run(async () => {
          await Promise.all(tasks.splice(0).map(task => task()))
          await Promise.all(Object.values(store.pendingRevalidates))
        })
      },
    }
  }
  return { request, entries, state, warnings, errors, nativeScopes,
    get calls() { return calls }, set status(value) { status = value }, set gate(value) { gate = value },
    advance: ms => { clock += ms },
    invalidate: tag => { for (const [key, entry] of entries) if (entry.tags.includes(tag)) entries.delete(key) },
  }
}

test('ISR post-response catalogue refresh reaches OPS through real Next patched fetch', async t => {
  const f = fixture(t), r = f.request()
  const feed = await r.load()
  assert.equal(feed.snapshot.publication_revision, 42)
  assert.equal(f.calls, 0, 'stored snapshot serves the render without an upstream request')
  await r.drain()
  assert.equal(f.calls, 1, 'background refresh must reach the native provider, not fail with DYNAMIC_SERVER_USAGE')
  assert.deepEqual(f.nativeScopes, ['unstable-cache'])
  assert.equal(r.unit.revalidate, 15, 'home page ISR interval stays intact')
  assert.equal(f.warnings.length, 0)
  assert.equal(f.errors.length, 0)
})

test('successful refreshes are bounded, tenant/type scoped and invalidated by the catalogue tag', async t => {
  const f = fixture(t)
  async function read(type) { const r = f.request(); await r.load({ customerType: type }); await r.drain() }
  await read('private'); await read('private')
  assert.equal(f.calls, 1)
  await read('business')
  assert.equal(f.calls, 2)
  f.state.identity = 'synthetic-tenant-b'
  await read('private')
  assert.equal(f.calls, 3)
  f.invalidate(WEBSITE_PUBLIC_CONTRACTS_CACHE_TAG)
  assert.equal(f.entries.size, 0)
  await read('private')
  assert.equal(f.calls, 4)
  f.advance(15_001)
  await read('private')
  assert.equal(f.calls, 5, 'expired successful marker permits another upstream refresh')
})

test('a failed refresh stores no successful marker and the next request can recover', async t => {
  const f = fixture(t)
  f.status = 503
  const first = f.request(); await first.load(); await first.drain()
  assert.equal(f.calls, 1, 'long Retry-After is respected without an immediate retry')
  assert.equal(f.warnings.length, 1)
  assert.equal(f.warnings[0][1].status, 503)
  f.status = 200
  const second = f.request(); await second.load(); await second.drain()
  assert.equal(f.calls, 2)
  const third = f.request(); await third.load(); await third.drain()
  assert.equal(f.calls, 2)
})

test('overlapping background work coalesces while explicit fresh validation always bypasses the marker', async t => {
  const f = fixture(t)
  let release
  f.gate = new Promise(resolve => { release = resolve })
  const first = f.request(); await first.load()
  const running = first.drain()
  const second = f.request(); await second.load()
  assert.equal(second.tasks.length, 0)
  release(); await running; await second.drain()
  assert.equal(f.calls, 1)
  // Final price validation runs in an ordinary dynamic request, not an ISR render.
  await loadWebsitePublicContractFeed({ context: 'fresh-test', forceFresh: true })
  await loadWebsitePublicContractFeed({ context: 'fresh-test', forceFresh: true })
  assert.equal(f.calls, 3)
  assert.ok(f.state.providerOptions.slice(-2).every(call => call.options.forceFresh === true))
})

test('background refresh uses the conditional catalogue path while final validation stays fresh', async t => {
  const f = fixture(t), r = f.request()
  await r.load(); await r.drain()
  assert.notEqual(f.state.providerOptions[0].options?.forceFresh, true)
})

test('validated 304 refreshes freshness only through the existing atomic snapshot guard', async t => {
  const f = fixture(t)
  f.state.providerSnapshot = { ...f.state.snapshot, upstream_status: 304, not_modified: true }
  const oldTime = Date.parse(f.state.snapshot.fetched_at)
  const r = f.request(); await r.load({ customerType: 'private' }); await r.drain()
  assert.equal(f.state.persisted.length, 1)
  const stored = f.state.persisted[0]
  assert.equal(stored.cacheKey, 'synthetic-tenant-a:private')
  assert.equal(stored.customerType, 'private')
  assert.ok(Date.parse(stored.snapshot.fetched_at) > oldTime)
  assert.equal(stored.snapshot.etag, f.state.snapshot.etag)
  assert.equal(stored.snapshot.publication_revision, 42)
  assert.deepEqual(stored.snapshot.contracts, f.state.snapshot.contracts)
  assert.equal(f.warnings.length, 0)
})

test('a rejected durable 304 refresh cannot become a cached success marker', async t => {
  const f = fixture(t)
  f.state.providerSnapshot = { ...f.state.snapshot, upstream_status: 304, not_modified: true }
  f.state.storeResult = { stored: false, result: 'rejected_older_than_local_publication_state' }
  const first = f.request(); await first.load(); await first.drain()
  const second = f.request(); await second.load(); await second.drain()
  assert.equal(f.calls, 2)
  assert.equal(f.state.persisted.length, 2)
  assert.equal(f.warnings.length, 2)
})

test('a transient stale fallback cannot become a cached success or renew durable freshness', async t => {
  const f = fixture(t)
  f.state.providerSnapshot = { ...f.state.snapshot, stale: true, stale_reason: 'ops_request_timeout' }
  const first = f.request(); await first.load(); await first.drain()
  const second = f.request(); await second.load(); await second.drain()
  assert.equal(f.calls, 2)
  assert.equal(f.state.persisted.length, 0)
  assert.equal(f.warnings.length, 2)
})

test('expired markers retain upstream coalescing across dynamic stale-while-revalidate requests', async t => {
  const f = fixture(t)
  const seeded = f.request(false); await seeded.load(); await seeded.drain()
  assert.equal(f.calls, 1)
  f.advance(15_001)
  let release
  f.gate = new Promise(resolve => { release = resolve })
  t.after(() => release())
  const first = f.request(false); await first.load()
  const running = first.drain()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(f.calls, 2)
  const second = f.request(false); await second.load()
  const secondRunning = second.drain()
  await new Promise(resolve => setImmediate(resolve))
  const observed = f.calls
  release(); await running; await secondRunning
  assert.equal(observed, 2, 'an expired marker must not release the pending OPS request')
  assert.equal(f.warnings.length, 0)
  assert.equal(f.errors.length, 0)
})

test('public card presentation is cached and publication and validity changes are reflected', async t => {
  const f = fixture(t)
  const now = Date.now()
  let elapsed = 0
  const NativeDate = Date
  globalThis.Date = class extends NativeDate {
    constructor(...args) { super(...(args.length ? args : [now + elapsed])) }
    static now() { return now + elapsed }
  }
  t.after(() => { globalThis.Date = NativeDate })
  const { normalizePublicContractApiPayload } = await import('../lib/website/publicContractContract.ts')
  const wire = JSON.parse(readFileSync(new URL('./fixtures/public-contracts.ops-2026-10-04.1.json', import.meta.url), 'utf8'))
  const contract = normalizePublicContractApiPayload(wire.data[0])
  assert.ok(contract)
  const validUntil = new Date(now + 5_000).toISOString()
  f.state.snapshot.contracts = [{ ...contract, name: 'Publicerad version A', valid_to: validUntil }]
  f.state.snapshot.fetched_at = new Date(now).toISOString()
  f.state.snapshot.feed_state = 'published'
  const coldStart = performance.now()
  const cold = await f.request(false).load()
  const coldMs = performance.now() - coldStart
  assert.equal(cold.cards[0]?.display.headline, 'Publicerad version A', JSON.stringify(cold.blockedContracts))
  assert.equal(f.state.snapshotReads, 1)
  const [entry] = [...f.entries.values()]
  assert.ok(entry.tags.includes(WEBSITE_PUBLIC_CONTRACTS_CACHE_TAG))
  assert.equal(JSON.parse(entry.value.data.body).presentation[0].headline, 'Publicerad version A')
  f.state.snapshot.contracts = [{ ...contract, name: 'Publicerad version B', valid_to: validUntil }]
  const warmStart = performance.now()
  const warm = await f.request(false).load()
  const warmMs = performance.now() - warmStart
  assert.equal(warm.cards[0]?.display.headline, 'Publicerad version A')
  assert.equal(f.state.snapshotReads, 1)
  const publicationStart = performance.now()
  f.invalidate(WEBSITE_PUBLIC_CONTRACTS_CACHE_TAG)
  const published = await f.request(false).load()
  const publicationMs = performance.now() - publicationStart
  assert.equal(published.cards[0]?.display.headline, 'Publicerad version B')
  assert.equal(f.state.snapshotReads, 2)
  elapsed = 5_001
  assert.equal((await f.request(false).load()).cards.length, 0)
  assert.equal(f.calls, 0)
  t.diagnostic(`Synthetic catalogue load in ms (cold / warm / invalidated): ${coldMs.toFixed(2)} / ${warmMs.toFixed(2)} / ${publicationMs.toFixed(2)}`)
})

test('catalogue age is enforced on a Next cache hit independently of background refresh', async t => {
  const f = fixture(t)
  const originalNow = Date.now
  const clock = originalNow()
  let elapsed = 0
  Date.now = () => clock + elapsed
  t.after(() => { Date.now = originalNow })
  f.state.snapshot.fetched_at = new Date(clock - 20_000).toISOString()
  const first = await f.request(false).load()
  assert.equal(first.snapshot.stale, false)

  elapsed = 60_000
  const second = await f.request(false).load()
  assert.equal(second.snapshot.stale, true)
  assert.equal(second.snapshot.stale_reason, 'cached_snapshot_age')

  elapsed = 901_000
  await assert.rejects(f.request(false).load(), { code: 'public_contract_snapshot_expired', status: 503 })
  assert.equal(f.calls, 0)
})

test('public monthly spot averages reuse the Next data cache independently of the process cache', async t => {
  const { stockholmDayBounds } = await import('../lib/website/businessDate.ts')
  const { getGenericMonthlyMarketInformation } = await import('../lib/website/marketInformationAdapter.ts')
  const f = fixture(t)
  const originalNow = Date.now
  let now = originalNow()
  Date.now = () => now
  t.after(() => { Date.now = originalNow })
  const store = f.request(false)
  const run = input => workAsyncStorage.run({
    route: '/elpriser/elpris-idag',
    incrementalCache: {
      generateSimpleCacheKey: async key => createHash('sha256').update(key).digest('hex'),
      get: async key => f.entries.get(key) ?? null,
      set: async (key, value) => { f.entries.set(key, { value, isStale: false }) },
    },
    nextFetchId: 1,
    pendingRevalidates: {},
  }, () => workUnitAsyncStorage.run(store.unit, () => getGenericMonthlyMarketInformation(input)))

  let calls = 0
  let published = true
  globalThis.fetch = async url => {
    calls++
    if (!published) return new Response(null, { status: 404 })
    const [, year, month, day, area] = String(url).match(/\/(\d{4})\/(\d{2})-(\d{2})_(SE\d)\.json$/)
    const bounds = stockholmDayBounds(`${year}-${month}-${day}`)
    const hour = 3_600_000
    return Response.json(Array.from({ length: (bounds.end - bounds.start) / hour }, (_, index) => ({
      SEK_per_kWh: area === 'SE3' ? 0.1 : 0.2,
      time_start: new Date(bounds.start + index * hour).toISOString(),
      time_end: new Date(bounds.start + (index + 1) * hour).toISOString(),
    })))
  }

  const period = { year: 2032, month: 3, priceArea: 'SE3' }
  assert.equal((await run(period)).avgSpotOre, 10)
  assert.equal(calls, 31)
  assert.equal(f.entries.size, 1)
  now += 301_000
  assert.equal((await run(period)).avgSpotOre, 10)
  assert.equal(calls, 31, 'a new request still hits shared cache after the process entry expires')
  assert.equal((await run({ ...period, priceArea: 'SE4' })).avgSpotOre, 20)
  assert.equal(calls, 62, 'the elområde is part of the key')

  published = false
  const unpublished = { ...period, month: 4 }
  assert.equal(await run(unpublished), null)
  assert.equal(f.entries.size, 2, 'an unpublished month does not create a shared cache entry')
  published = true
  now += 301_000
  assert.equal((await run(unpublished)).avgSpotOre, 10)
  assert.equal(f.entries.size, 3)
})

test('publication webhook asks for another delivery if website cache revalidation failed', async t => {
  const { POST } = await import('../app/webhooks/contracts.publication.changed/route.ts')
  const { WEBSITE_PUBLIC_CONTRACT_PATHS } = await import('../lib/website/publicContractCache.ts')
  const secret = 'synthetic-offline-publication-signature-only'
  const keys = ['GRIDEX_WEBHOOK_SIGNING_SECRET', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
  const original = Object.fromEntries(keys.map(key => [key, process.env[key]]))
  process.env.GRIDEX_WEBHOOK_SIGNING_SECRET = secret
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://synthetic.invalid'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-offline-credential'
  const originalError = console.error
  console.error = () => {}
  t.after(() => {
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key]
      else process.env[key] = original[key]
    }
    console.error = originalError
    delete globalThis.__publicationWebhook
  })

  let failRevalidation = true
  const stored = new Map()
  const paths = []
  const organization = 'organization_' + 'a'.repeat(24)
  globalThis.__publicationWebhook = {
    organization,
    invalidate() {},
    revalidateTag(tag, profile) {
      assert.equal(tag, WEBSITE_PUBLIC_CONTRACTS_CACHE_TAG)
      assert.deepEqual(profile, { expire: 0 })
      if (failRevalidation) throw Error('synthetic revalidation dependency unavailable')
    },
    revalidatePath(path) { paths.push(path) },
    async rpc(name, input) {
      assert.equal(name, 'apply_ops_publication_event')
      const duplicate = stored.has(input.p_event_id)
      if (duplicate) assert.deepEqual(input, stored.get(input.p_event_id))
      else stored.set(input.p_event_id, input)
      const website = input.p_channel === 'website'
      return {
        data: [{ result: duplicate ? 'duplicate' : website ? 'applied' : 'ignored',
          cache_invalidated: website && !duplicate, stored_revision: input.p_publication_revision }],
        error: null,
      }
    },
  }
  const time = new Date()
  const payload = {
    event_id: 'event_' + 'a'.repeat(32),
    delivery_id: 'delivery_' + 'b'.repeat(32),
    event_type: 'contracts.publication.changed',
    created_at: time.toISOString(),
    organization_reference: organization,
    aggregate: { type: 'contract_publication', reference: 'synthetic-publication' },
    data: { channel: 'website', publication_revision: 42, revision_token: 'offline-42', reason: 'test', timestamp: time.toISOString() },
    contract_schema_version: version,
  }
  const send = async body => {
    const raw = JSON.stringify(body)
    const timestamp = String(Math.floor(time.getTime() / 1000))
    return POST(new Request('https://site.invalid/webhooks/contracts.publication.changed', {
      method: 'POST',
      body: raw,
      headers: {
        'content-type': 'application/json',
        'x-gridex-event-id': body.event_id,
        'x-gridex-delivery-id': body.delivery_id,
        'x-gridex-timestamp': timestamp,
        'x-gridex-signature': 'sha256=' + createHmac('sha256', secret).update(timestamp + '.' + raw).digest('hex'),
      },
    }))
  }
  const first = await send(payload)
  assert.equal(first.status, 503)
  const failure = await first.json()
  assert.equal(failure.ok, false)
  assert.equal(failure.error.retryable, true)
  assert.equal(failure.cache_revalidated, false)
  assert.equal(failure.publication_revision, 42)
  assert.equal(stored.size, 1)

  failRevalidation = false
  const retry = await send(payload)
  assert.equal(retry.status, 200)
  const success = await retry.json()
  assert.equal(success.result, 'duplicate')
  assert.equal(success.cache_revalidated, true)
  assert.deepEqual(paths, [...WEBSITE_PUBLIC_CONTRACT_PATHS])
  assert.equal(stored.size, 1)

  const otherChannel = await send({
    ...payload,
    event_id: 'event_' + 'c'.repeat(32),
    delivery_id: 'delivery_' + 'd'.repeat(32),
    data: { ...payload.data, channel: 'internal' },
  })
  assert.equal(otherChannel.status, 200)
  assert.equal((await otherChannel.json()).cache_revalidated, false)
  assert.deepEqual(paths, [...WEBSITE_PUBLIC_CONTRACT_PATHS])
})
