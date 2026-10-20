import assert from 'node:assert/strict'
import { AsyncLocalStorage } from 'node:async_hooks'
import { createHash } from 'node:crypto'
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
    identity: 'synthetic-tenant-a', providerOptions: [],
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
  assert.ok(f.state.providerOptions.every(call => call.options.forceFresh === true))
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
