import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const nativeRequire = createRequire(import.meta.url)

// Execute both actual HTTP handlers and their shared error module. OPS I/O,
// signature verification and admission control are isolated synthetic boundaries;
// no external network, account or business operation is reachable.
function harness(route, { wait = 25, nested = false, localLimit = false, startWindow, observeAbort, knownOffer = true, catalogueEmpty = false, catalogueGate, observeQuote } = {}) {
  const modules = new Map(), counts = { snapshots: 0, quotes: 0 }
  const now = Date.now()
  let upstream
  const boundaries = {
    '@/lib/observability/apiPerformance': { observeApiOperation: (_name, call) => call() },
    '@/lib/security/rateLimit': { clientIpFromHeaders: () => '192.0.2.1', checkRateLimit: async () => ({ allowed: !localLimit, resetAt: now + 60_000 }) },
    '@/lib/ops/client': {
      isOpsError: error => load('lib/ops/errors.ts').isOpsError(error),
      getOpsClientStatus: () => ({ configured: true }),
      hasRecentlySeenPublicOffer: () => knownOffer,
      fetchOpsPublicContractsSnapshot: async (_customerType, options) => {
        counts.snapshots++
        if (observeAbort) await observeAbort(options.signal)
        if (catalogueGate) await catalogueGate
        if (catalogueEmpty) return { contracts: [] }
        if (!startWindow) throw upstream
        return { contracts: [{ offer_reference: 'offer_synthetic', price_options: [
          { price_option_reference: 'synthetic-default', customer_type: 'private', earliest_start_date: '2026-12-01', area_prices: [] },
        ] }] }
      },
      fetchOpsWebsiteQuoteAutoSelect: async (input, signal) => {
        counts.quotes++
        if (observeQuote) await observeQuote(signal)
        if (observeAbort) await observeAbort(signal)
        if (!startWindow) throw upstream
        assert.equal(input.start_date, '2026-11-30')
        return { start_date: startWindow, resolution_id: 'synthetic-resolution', contract: { offer_reference: 'offer_synthetic' }, priceArea: 'SE3',
          price_option_reference: 'synthetic-default', area_price_reference: null, annual_consumption_kwh: 12000 }
      },
    },
    '@/lib/website/pricingQuote': { MAX_WEBSITE_PRICING_TOKEN_LENGTH: 24_000, websitePricingQuoteConfigured: () => true, verifyWebsitePricingQuote: () => ({ ok: true }), issueWebsitePricingQuote: ({ preview }) => ({ quote: preview, token: 'signed-test-quote' }), quoteToWebsitePricingPreview: quote => quote },
    '@/lib/website/energyAreaToken': { verifyWebsiteEnergyAreaToken: () => ({ ok: true, payload: { quote_ready: true, price_area_code: 'SE3', resolution_id: 'synthetic-resolution' } }) },
    '@/lib/website/canonicalQuoteValidation': { validateCanonicalWebsiteQuote: () => { throw Error('Quote validation must not proceed after failed catalogue check') } },
    '@/lib/website/publicContractDisplay': { buildPublicContractDisplay: () => ({ onlineReady: true }) },
    '@/lib/website/pricingSnapshotStore': { persistWebsitePricingSnapshot: async () => { assert.equal(observeAbort, undefined, 'aborted requests must bypass snapshot storage'); return 'test-snapshot' } },
  }
  function load(relative) {
    const file = resolve(root, relative)
    if (modules.has(file)) return modules.get(file).exports
    const mod = { exports: {} }; modules.set(file, mod)
    const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
    vm.runInNewContext(code, { module: mod, exports: mod.exports, require(name) {
      if (Object.hasOwn(boundaries, name)) return boundaries[name]
      if (name === 'next/server') return nativeRequire('next/server.js')
      if (name.startsWith('@/') || name.startsWith('.')) {
        const candidate = name.startsWith('@/') ? resolve(root, name.slice(2)) : resolve(dirname(file), name)
        const target = [candidate, candidate + '.ts'].find(path => existsSync(path))
        if (!target) throw Error('Missing dependency: ' + name)
        return load(target)
      }
      throw Error('Unexpected external dependency: ' + name)
    }, Request, Response, Headers, URL, TextDecoder, TextEncoder, Uint8Array, ArrayBuffer,
    ReadableStream, AbortSignal, AbortController, Error, RangeError, TypeError, SyntaxError,
    ...(startWindow ? { Date: class extends Date { constructor(...args) { super(...(args.length ? args : ['2026-11-30T12:00:00Z'])) } } } : {}),
    crypto: webcrypto, process: { env: {} }, console: { error() {} },
    fetch() { throw Error('Network prohibited') }, setTimeout, clearTimeout }, { filename: file })
    return mod.exports
  }
  const { OpsError } = load('lib/ops/errors.ts')
  const details = { code: 'rate_limited', retry_after_seconds: wait, request_id: 'synthetic-upstream', retryable: false }
  upstream = new OpsError('Synthetic rate limit', 429, nested ? { error: details } : details)
  const { POST } = load(route)
  return { counts, call: (overrides = {}, signal) => POST(new Request('https://gridex.test/api/checkout/quote', { method: 'POST',
    signal, headers: { 'Content-Type': 'application/json', Origin: 'https://gridex.test' },
    body: JSON.stringify({ customer_type: 'private', offer_reference: 'offer_synthetic', postal_code: '11151', city: 'Stockholm', address: 'Testgatan 1',
      estimated_monthly_kwh: 1000, annual_consumption_kwh: 12000, requested_start_mode: 'earliest_possible',
      quote_attempt_id: '33333333-3333-4333-8333-333333333333', resolution_token: 'synthetic-area-token', pricing_token: 'synthetic-pricing-token', price_area_code: 'SE3', ...overrides }) })) }
}

for (const route of ['app/api/checkout/quote/route.ts', 'app/api/checkout/quote/validate/route.ts']) {
  for (const nested of [false, true]) test(`${route} preserves upstream wait and 429 (${nested ? 'nested' : 'flat'}) without retry`, async () => {
    const h = harness(route, { wait: 25.2, nested })
    const response = await h.call()
    assert.equal(response.status, 429)
    assert.equal(response.headers.get('Retry-After'), '26')
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
    const body = await response.json()
    assert.equal(typeof body.error === 'object' ? body.error.code : body.code, 'rate_limited')
    assert.equal(h.counts.snapshots, 1)
    assert.equal(h.counts.quotes, route.includes('/validate/') ? 0 : 1)
  })
  for (const wait of [null, '120', -1, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) test(`${route} rejects invalid wait ${String(wait)}`, async () => {
    const response = await harness(route, { wait }).call()
    assert.equal(response.status, 429)
    assert.equal(response.headers.get('Retry-After'), null)
  })
}
test('local quote-validation admission limit exposes its own reset without reaching OPS', async () => {
  const h = harness('app/api/checkout/quote/validate/route.ts', { localLimit: true })
  const response = await h.call()
  assert.equal(response.status, 429)
  const wait = Number(response.headers.get('Retry-After'))
  assert.ok(wait >= 59 && wait <= 60)
  assert.equal(h.counts.snapshots, 0)
})

test('a new quote rejects a past start date before any OPS requests', async () => {
  const h = harness('app/api/checkout/quote/route.ts')
  const response = await h.call({ requested_start_mode: 'specific_date', requested_start_date: '2000-01-01' })
  assert.equal(response.status, 400)
  assert.match((await response.json()).error.message, /Startdatumet har passerat/)
  assert.deepEqual(h.counts, { snapshots: 0, quotes: 0 })
})

test('earliest mode verifies the public price window against the effective OPS date', async () => {
  const route = 'app/api/checkout/quote/route.ts'
  const accepted = await harness(route, { startWindow: '2026-12-14' }).call()
  assert.equal(accepted.status, 200)
  assert.equal((await accepted.json()).data.start_date, '2026-12-14')
  const rejected = await harness(route, { startWindow: '2026-11-30' }).call()
  assert.equal(rejected.status, 409)
  assert.equal((await rejected.json()).code, 'price_option_invalid')
})

test('aborting a quote forwards cancellation to the catalogue and OPS quote before storage', async () => {
  const controller = new AbortController()
  const signals = []
  const h = harness('app/api/checkout/quote/route.ts', {
    startWindow: '2026-12-14',
    observeAbort: signal => new Promise((resolve, reject) => {
      signals.push(signal)
      signal.addEventListener('abort', () => reject(signal.reason), { once: true })
      if (signals.length === 2) controller.abort()
    }),
  })
  const response = await h.call({}, controller.signal)
  assert.equal(response.status, 499)
  assert.equal(signals.length, 2)
  assert.ok(signals.every(signal => signal.aborted))
})

test('an unknown offering is rejected from the catalogue without an OPS quote', async () => {
  const h = harness('app/api/checkout/quote/route.ts', { knownOffer: false, catalogueEmpty: true })
  assert.equal((await h.call()).status, 404)
  assert.deepEqual(h.counts, { snapshots: 1, quotes: 0 })
})

test('known offers start both reads in parallel while cold offers first await the catalogue', async () => {
  for (const knownOffer of [true, false]) {
    const catalogue = Promise.withResolvers()
    const h = harness('app/api/checkout/quote/route.ts', {
      startWindow: '2026-12-14',
      knownOffer,
      catalogueGate: catalogue.promise,
    })
    const response = h.call()
    await new Promise(resolve => setImmediate(resolve))
    try {
      assert.deepEqual(h.counts, { snapshots: 1, quotes: knownOffer ? 1 : 0 })
    } finally {
      catalogue.resolve()
    }
    assert.equal((await response).status, 200)
    assert.deepEqual(h.counts, { snapshots: 1, quotes: 1 })
  }
})

test('a recently seen offer withdrawn from the current catalogue cancels the speculative quote', async () => {
  let quoteSignal
  const h = harness('app/api/checkout/quote/route.ts', {
    knownOffer: true,
    catalogueEmpty: true,
    observeQuote: signal => new Promise((resolve, reject) => {
      quoteSignal = signal
      signal.addEventListener('abort', () => reject(signal.reason), { once: true })
    }),
  })
  assert.equal((await h.call()).status, 404)
  assert.deepEqual(h.counts, { snapshots: 1, quotes: 1 })
  assert.equal(quoteSignal.aborted, true)
})

test('quote issuance and validation reject overly long streets before reaching OPS', async () => {
  for (const route of ['app/api/checkout/quote/route.ts', 'app/api/checkout/quote/validate/route.ts']) {
    const fixture = harness(route)
    const response = await fixture.call({ address: 'a'.repeat(181) })
    assert.equal(response.status, 400)
    assert.equal((await response.json()).error.field, 'address')
    assert.equal(fixture.counts.snapshots + fixture.counts.quotes, 0)
  }
})
