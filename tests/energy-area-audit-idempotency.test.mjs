import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const nativeRequire = createRequire(import.meta.url)

function resolutionInput() {
  const input = {
    location: { postalCode: '582 22', city: 'Linköping', address: 'Syntetisk gata 1' },
    resolution: {
      status: 'resolved', resolution_status: 'resolved',
      resolution_id: '11111111-1111-4111-8111-111111111111',
      resolution_reference: 'resolution-opaque-1',
      price_area_code: 'SE3', grid_area_code: 'GRID-SE3', grid_owner_name: 'Synthetic Grid AB',
      resolver_version: 'resolver-2026-10-09', geodata_version: 'geodata-2026-10',
      contract_version: '2026-10-09.1',
      resolved_at: '2026-10-18T12:00:00.000Z', valid_until: '2026-10-18T14:00:00.000Z',
      price_area_assurance: {
        status: 'verified', price_area: 'SE3', confidence: 1, source: 'address_polygon',
        candidate_count: 1, unique_price_area_count: 1, source_version: 'polygon-2026-10',
        evidence: { polygon_reference: 'polygon-opaque-1', matched_address: 'Syntetisk gata 1' },
      },
      capabilities: { pricing_ready: true, quote_ready: true, facility_lookup_ready: false, switch_request_creatable: false, switch_dispatch_ready: false },
      blockers: { pricing: [], quote: [], facility_lookup: [], switch_creation: [], switch_dispatch: [] },
      retryable: false, warnings: [], source_chain: ['address_polygon'],
      source: { provider: 'ops', reference: 'polygon-opaque-1', resolved_by: 'address_polygon', raw: {} },
    },
  }
  refreshRaw(input)
  return input
}

function refreshRaw(input) {
  const { raw: ignored, ...data } = input.resolution
  void ignored
  input.resolution.raw = { request_id: 'ops-request-first', correlation_id: 'ops-correlation-first', data: structuredClone(data) }
}

// The SDK fixture preserves the actual unique-key behavior and PostgREST
// timestamptz representation. Only persistence is replaced; field selection,
// fingerprinting, hashes and retry decisions execute in the real application.
function fixture({ postgresTimestamps = false } = {}) {
  const state = { rows: new Map(), now: Date.parse('2026-10-18T12:00:00.000Z'), readError: null, writeError: null }
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [state.now])) }
    static now() { return state.now }
  }
  class Query {
    constructor() { this.filters = []; this.columns = '*' }
    insert(row) { this.inserted = structuredClone(row); return this }
    select(columns = '*') { this.columns = columns; return this }
    eq(key, value) { this.filters.push(row => row[key] === value); return this }
    maybeSingle() { this.one = true; return this }
    then(resolvePromise, rejectPromise) {
      try { return Promise.resolve(this.execute()).then(resolvePromise, rejectPromise) }
      catch (error) { return Promise.reject(error).then(resolvePromise, rejectPromise) }
    }
    execute() {
      if (this.inserted) {
        if (state.writeError) return { data: null, error: state.writeError }
        const key = this.inserted.ops_resolution_reference
        if (state.rows.has(key)) return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "website_price_area_resolutions_ops_reference_uidx"' } }
        const row = { id: 'audit-row-1', created_at: new Clock().toISOString(), ...this.inserted }
        if (postgresTimestamps) for (const field of ['resolved_at', 'valid_until', 'ops_valid_until']) {
          if (typeof row[field] === 'string') row[field] = row[field].replace(/\.000Z$/, '+00:00')
        }
        state.rows.set(key, row)
        return { data: null, error: null }
      }
      if (state.readError) return { data: null, error: state.readError }
      const rows = [...state.rows.values()].filter(row => this.filters.every(predicate => predicate(row)))
      const selected = rows.map(row => this.columns === '*' ? structuredClone(row)
        : Object.fromEntries(this.columns.split(',').map(key => [key, structuredClone(row[key])])))
      return { data: this.one ? selected[0] ?? null : selected, error: null }
    }
  }
  const modules = new Map()
  const sdk = { createClient(url, key) {
    assert.equal(url, 'https://energy-area-fixture.example.invalid')
    assert.equal(key, 'synthetic-offline-key')
    return { from(table) { assert.equal(table, 'website_price_area_resolutions'); return new Query() } }
  } }
  function load(file) {
    if (modules.has(file)) return modules.get(file).exports
    const loadedModule = { exports: {} }
    modules.set(file, loadedModule)
    const source = ts.transpileModule(readFileSync(file, 'utf8'), {
      fileName: file,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText
    vm.runInNewContext(source, {
      module: loadedModule, exports: loadedModule.exports,
      require(specifier) {
        if (specifier === '@supabase/supabase-js') return sdk
        if (specifier === 'node:crypto') return nativeRequire('node:crypto')
        if (specifier.startsWith('@/') || specifier.startsWith('.')) {
          const candidate = specifier.startsWith('@/') ? resolve(root, specifier.slice(2)) : resolve(dirname(file), specifier)
          const path = [candidate, `${candidate}.ts`, `${candidate}.js`].find(value => existsSync(value))
          if (path) return load(path)
        }
        throw new Error(`Unexpected boundary import: ${specifier}`)
      },
      Date: Clock, Error, TypeError, RangeError, URL, console,
      process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://energy-area-fixture.example.invalid', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-offline-key', GRIDEX_WEBSITE_HASH_PEPPER: 'synthetic-address-fingerprint-secret' } },
      fetch() { throw new Error('Unexpected outbound network request') },
    }, { filename: file })
    return loadedModule.exports
  }
  return { state, ...load(resolve(root, 'lib/website/energyAreaStore.ts')) }
}

test('an unchanged resolution survives only the PostgreSQL timestamptz wire-format change', async () => {
  const f = fixture({ postgresTimestamps: true })
  const input = resolutionInput()
  await f.persistOpsEnergyAreaResolution(input)
  const first = structuredClone(f.state.rows.get(input.resolution.resolution_reference))
  assert.equal(first.ops_valid_until, '2026-10-18T14:00:00+00:00')
  await f.persistOpsEnergyAreaResolution(structuredClone(input))
  assert.deepEqual(f.state.rows.get(input.resolution.resolution_reference), first)
})

for (const field of ['request_id', 'correlation_id']) {
  test(`an unchanged resolution survives only a new root transport ${field}`, async () => {
    const f = fixture()
    const input = resolutionInput()
    await f.persistOpsEnergyAreaResolution(input)
    const first = structuredClone(f.state.rows.get(input.resolution.resolution_reference))
    const retry = structuredClone(input)
    retry.resolution.raw[field] = `different-${field}`
    f.state.now += 60_000
    await f.persistOpsEnergyAreaResolution(retry)
    assert.equal(f.state.rows.size, 1)
    assert.deepEqual(f.state.rows.get(input.resolution.resolution_reference), first, 'original raw hash and audit time stay immutable')
  })
}

test('concurrent copies of one canonical resolution converge despite PostgreSQL timestamp normalization', async () => {
  const f = fixture({ postgresTimestamps: true })
  const input = resolutionInput()
  const results = await Promise.allSettled([
    f.persistOpsEnergyAreaResolution(structuredClone(input)),
    f.persistOpsEnergyAreaResolution(structuredClone(input)),
  ])
  assert.deepEqual(results.map(result => result.status), ['fulfilled', 'fulfilled'])
  assert.equal(f.state.rows.size, 1)
})

const conflicts = [
  ['address', input => { input.location.address = 'Annan gata 99' }],
  ['price area', input => { input.resolution.price_area_code = 'SE4'; input.resolution.price_area_assurance.price_area = 'SE4' }],
  ['resolver', input => { input.resolution.resolver_version = 'different-resolver' }],
  ['assurance status', input => { input.resolution.price_area_assurance.status = 'estimated' }],
  ['assurance confidence', input => { input.resolution.price_area_assurance.confidence = 0.75 }],
  ['assurance source', input => { input.resolution.price_area_assurance.source = 'postal_consensus' }],
  ['assurance evidence', input => { input.resolution.price_area_assurance.evidence.polygon_reference = 'different-polygon' }],
]
for (const [label, change] of conflicts) {
  test(`a reused resolution reference with a different ${label} is rejected without changing its first audit row`, async () => {
    const f = fixture()
    const input = resolutionInput()
    await f.persistOpsEnergyAreaResolution(input)
    const first = structuredClone(f.state.rows.get(input.resolution.resolution_reference))
    const conflicting = structuredClone(input)
    change(conflicting)
    refreshRaw(conflicting)
    await assert.rejects(() => f.persistOpsEnergyAreaResolution(conflicting))
    assert.equal(f.state.rows.size, 1)
    assert.deepEqual(f.state.rows.get(input.resolution.resolution_reference), first)
  })
}

test('first-time resolution audit succeeds and stores the original raw-response hash and time', async () => {
  const f = fixture()
  const input = resolutionInput()
  await f.persistOpsEnergyAreaResolution(input)
  const row = f.state.rows.get(input.resolution.resolution_reference)
  assert.equal(f.state.rows.size, 1)
  assert.equal(row.ops_resolution_payload_sha256, nativeRequire('node:crypto').createHash('sha256').update(JSON.stringify(input.resolution.raw)).digest('hex'))
  assert.equal(row.resolved_at, input.resolution.resolved_at)
  assert.equal(row.created_at, '2026-10-18T12:00:00.000Z')
})

test('a duplicate audit lookup failure remains an error without mutating the stored evidence', async () => {
  const f = fixture()
  const input = resolutionInput()
  await f.persistOpsEnergyAreaResolution(input)
  const first = structuredClone(f.state.rows.get(input.resolution.resolution_reference))
  f.state.readError = { code: '08006', message: 'Synthetic audit lookup failure' }
  await assert.rejects(() => f.persistOpsEnergyAreaResolution(structuredClone(input)))
  assert.deepEqual(f.state.rows.get(input.resolution.resolution_reference), first)
})
