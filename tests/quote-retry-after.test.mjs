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
function harness(route, { wait = 25, nested = false, localLimit = false } = {}) {
  const modules = new Map(), counts = { snapshots: 0, quotes: 0 }
  const now = Date.now()
  let upstream
  const boundaries = {
    '@/lib/observability/apiPerformance': { observeApiOperation: (_name, call) => call() },
    '@/lib/security/rateLimit': { clientIpFromHeaders: () => '192.0.2.1', checkRateLimit: async () => ({ allowed: !localLimit, resetAt: now + 60_000 }) },
    '@/lib/ops/client': {
      isOpsError: error => load('lib/ops/errors.ts').isOpsError(error),
      getOpsClientStatus: () => ({ configured: true }),
      fetchOpsPublicContractsSnapshot: async () => { counts.snapshots++; throw upstream },
      fetchOpsWebsiteQuoteAutoSelect: async () => { counts.quotes++; throw upstream },
    },
    '@/lib/website/pricingQuote': { websitePricingQuoteConfigured: () => true, verifyWebsitePricingQuote: () => ({ ok: true }) },
    '@/lib/website/energyAreaToken': { verifyWebsiteEnergyAreaToken: () => ({ ok: true, payload: { quote_ready: true, price_area_code: 'SE3', resolution_id: 'synthetic-resolution' } }) },
    '@/lib/website/canonicalQuoteValidation': { validateCanonicalWebsiteQuote: () => { throw Error('Quote validation must not proceed after failed catalogue check') } },
    '@/lib/website/publicContractDisplay': {},
    '@/lib/website/pricingSnapshotStore': {},
    '@/lib/website/publicContractContract': {},
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
    crypto: webcrypto, process: { env: {} }, console: { error() {} },
    fetch() { throw Error('Network prohibited') }, setTimeout, clearTimeout }, { filename: file })
    return mod.exports
  }
  const { OpsError } = load('lib/ops/errors.ts')
  const details = { code: 'rate_limited', retry_after_seconds: wait, request_id: 'synthetic-upstream', retryable: false }
  upstream = new OpsError('Synthetic rate limit', 429, nested ? { error: details } : details)
  const { POST } = load(route)
  return { counts, call: () => POST(new Request('https://gridex.test/api/checkout/quote', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://gridex.test' },
    body: JSON.stringify({ customer_type: 'private', offer_reference: 'offer_synthetic', postal_code: '11151', city: 'Stockholm', address: 'Testgatan 1',
      estimated_monthly_kwh: 1000, annual_consumption_kwh: 12000, requested_start_mode: 'earliest_possible',
      quote_attempt_id: '33333333-3333-4333-8333-333333333333', resolution_token: 'synthetic-area-token', pricing_token: 'synthetic-pricing-token', price_area_code: 'SE3' }) })) }
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
