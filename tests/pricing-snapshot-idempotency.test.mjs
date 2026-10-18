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

function quote() {
  return {
    customerType: 'private',
    contract: { offer_reference: 'offer-opaque-1', type: 'fixed', pricing_model: 'fixed_price' },
    preview: {
      pricing_snapshot_reference: 'wps_canonical_ops_snapshot_1', ops_quote_reference: 'quote-opaque-1',
      resolution_id: 'resolution-opaque-1', priceArea: 'SE3', price_area_code: 'SE3',
      annual_consumption_kwh: 1200, kwh: 100, pricePerKwhOre: 100,
      totalMonthlyCostSek: 149, totalMonthlyCostInclVatSek: 186.25, totalYearlyCostSek: 2235,
      customer_type: 'private', energy_direction: 'consumption', production_pricing: null,
      start_date: '2026-11-01', requested_start_mode: 'specific_date',
      contract: { slug: 'fixed', offer_reference: 'offer-opaque-1', name: 'Syntetiskt fastpris', contractType: 'fixed' },
      price_option_reference: 'price-option-opaque-1', area_price_reference: 'area-price-opaque-1',
      invoice_delivery_method: 'e_invoice', selected_component_references: [], site_count: 1,
      public_contract_etag: 'contracts-etag-1', publication_revision: 10,
      contract_payload_sha256: 'a'.repeat(64), pricing_snapshot_schema_version: '2026-10-09.1',
      valid_until: '2026-10-18T14:00:00.000Z',
      specification: {
        basis: { annualConsumptionKwh: 1200, estimatedMonthlyKwh: 100 },
        fees: { monthlyFeeSek: 49, vatIncluded: false },
        canonicalLines: [{ code: 'energy', name: 'El', quantity: 100, unit: 'kwh', unitPriceExVat: 1, amountExVat: 100, amountIncVat: 125 }],
      },
      settlement: {
        model: 'fixed_price', customer_accepts: 'fixed_energy_price', energy_price_locked_at_signup: true,
        uses_actual_metered_consumption: true, market_data_role: 'not_applicable', settlement_resolution: 'fixed',
      },
      raw: { request_id: 'ops-request-first', data: { quote_reference: 'quote-opaque-1', pricing_snapshot_reference: 'wps_canonical_ops_snapshot_1' } },
    },
  }
}

// Only the SDK/PostgREST boundary is synthetic. The real persistence function
// builds/hashes its own snapshot, chooses its write/read operations and handles
// collisions. The fixture enforces both production unique indexes atomically.
function fixture() {
  const state = { rows: new Map(), now: Date.parse('2026-10-18T12:00:00.000Z'), writeError: null, readError: null }
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [state.now])) }
    static now() { return state.now }
  }
  const duplicate = constraint => ({ data: null, error: { code: '23505', message: `duplicate key value violates unique constraint "${constraint}"` } })
  class Query {
    constructor() { this.filters = []; this.columns = '*' }
    select(columns = '*') { this.columns = columns; return this }
    eq(key, value) { this.filters.push(row => row[key] === value); return this }
    insert(row) { this.newRow = structuredClone(row); return this }
    upsert(row, options = {}) { this.newRow = structuredClone(row); this.upsertOptions = options; return this }
    update(patch) { this.patch = patch; return this }
    maybeSingle() { this.one = true; return this }
    single() { this.one = true; return this }
    then(resolvePromise, rejectPromise) {
      try { return Promise.resolve(this.execute()).then(resolvePromise, rejectPromise) }
      catch (error) { return Promise.reject(error).then(resolvePromise, rejectPromise) }
    }
    execute() {
      if (this.newRow) {
        if (state.writeError) return { data: null, error: state.writeError }
        const reference = this.newRow.pricing_snapshot_reference
        const existing = state.rows.get(reference)
        if (existing) {
          if (!this.upsertOptions) return duplicate('website_pricing_snapshots_pricing_snapshot_reference_key')
          assert.equal(this.upsertOptions.onConflict, 'pricing_snapshot_reference')
          if (this.upsertOptions.ignoreDuplicates) return { data: null, error: null }
        }
        if (this.newRow.ops_quote_reference && [...state.rows.values()].some(row =>
          row.pricing_snapshot_reference !== reference && row.ops_quote_reference === this.newRow.ops_quote_reference)) {
          return duplicate('website_pricing_snapshots_ops_quote_reference_uidx')
        }
        state.rows.set(reference, { id: existing?.id ?? 'snapshot-row-1', ...this.newRow })
        return { data: null, error: null }
      }
      if (state.readError) return { data: null, error: state.readError }
      const rows = [...state.rows.values()].filter(row => this.filters.every(predicate => predicate(row)))
      if (this.patch) {
        if (state.writeError) return { data: null, error: state.writeError }
        for (const row of rows) Object.assign(row, structuredClone(this.patch))
      }
      const selected = rows.map(row => this.columns === '*' ? structuredClone(row)
        : Object.fromEntries(this.columns.split(',').map(key => [key, structuredClone(row[key])])))
      return { data: this.one ? selected[0] ?? null : selected, error: null }
    }
  }
  const sdk = {
    createClient(url, key) {
      assert.equal(url, 'https://snapshot-fixture.example.invalid')
      assert.equal(key, 'synthetic-offline-key')
      return { from(table) { assert.equal(table, 'website_pricing_snapshots'); return new Query() } }
    },
  }
  const modules = new Map()
  function load(file) {
    if (modules.has(file)) return modules.get(file).exports
    const module = { exports: {} }
    modules.set(file, module)
    const source = ts.transpileModule(readFileSync(file, 'utf8'), {
      fileName: file,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText
    vm.runInNewContext(source, {
      module, exports: module.exports,
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
      process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://snapshot-fixture.example.invalid', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-offline-key' } },
      fetch() { throw new Error('Unexpected outbound network request') },
    }, { filename: file })
    return module.exports
  }
  return { state, ...load(resolve(root, 'lib/website/pricingSnapshotStore.ts')) }
}

test('an identical canonical snapshot is reused by an ordinary quote retry without mutating its first row', async () => {
  const f = fixture()
  const input = quote()
  const reference = await f.persistWebsitePricingSnapshot(input)
  await f.markWebsitePricingSnapshotValidated({ pricingSnapshotReference: reference, quoteReference: input.preview.ops_quote_reference, status: 'valid' })
  const first = structuredClone(f.state.rows.get(reference))
  f.state.now += 60_000
  assert.equal(await f.persistWebsitePricingSnapshot(structuredClone(input)), reference)
  assert.equal(f.state.rows.size, 1)
  assert.deepEqual(f.state.rows.get(reference), first, 'retry preserves original issued_at and validation audit')
})

test('a new OPS request ID does not create a different canonical pricing calculation', async () => {
  const f = fixture()
  const input = quote()
  const reference = await f.persistWebsitePricingSnapshot(input)
  const first = structuredClone(f.state.rows.get(reference))
  const retry = structuredClone(input)
  retry.preview.raw.request_id = 'ops-request-retry'
  f.state.now += 60_000
  assert.equal(await f.persistWebsitePricingSnapshot(retry), reference)
  assert.deepEqual(f.state.rows.get(reference), first)
})

test('simultaneous identical canonical snapshot writes converge to one immutable row', async () => {
  const f = fixture()
  const input = quote()
  const results = await Promise.allSettled([
    f.persistWebsitePricingSnapshot(structuredClone(input)),
    f.persistWebsitePricingSnapshot(structuredClone(input)),
  ])
  assert.deepEqual(results.map(result => result.status), ['fulfilled', 'fulfilled'])
  assert.deepEqual(results.map(result => result.value), [input.preview.pricing_snapshot_reference, input.preview.pricing_snapshot_reference])
  assert.equal(f.state.rows.size, 1)
})

const changes = [
  ['OPS quote reference', input => { input.preview.ops_quote_reference = 'different-ops-quote' }],
  ['offer reference', input => { input.contract.offer_reference = 'different-offer' }],
  ['customer type', input => { input.customerType = 'business'; input.preview.customer_type = 'business' }],
  ['monthly totals', input => { input.preview.totalMonthlyCostSek = 150; input.preview.totalMonthlyCostInclVatSek = 187.5 }],
  ['energy unit price', input => { input.preview.pricePerKwhOre = 101 }],
  ['calculation component', input => { input.preview.specification.canonicalLines[0].amountExVat = 101 }],
]
for (const idempotent of [false, true]) {
  for (const [label, change] of changes) {
    test(`a conflicting ${label} under the same snapshot reference is rejected (idempotent=${idempotent})`, async () => {
      const f = fixture()
      const input = quote()
      const reference = await f.persistWebsitePricingSnapshot(input)
      const first = structuredClone(f.state.rows.get(reference))
      const changed = structuredClone(input)
      change(changed)
      await assert.rejects(() => f.persistWebsitePricingSnapshot({ ...changed, idempotent }))
      assert.equal(f.state.rows.size, 1)
      assert.deepEqual(f.state.rows.get(reference), first)
    })
  }
}

test('idempotent renewal of an identical snapshot preserves the existing row', async () => {
  const f = fixture()
  const input = { ...quote(), idempotent: true }
  const reference = await f.persistWebsitePricingSnapshot(input)
  const first = structuredClone(f.state.rows.get(reference))
  f.state.now += 60_000
  assert.equal(await f.persistWebsitePricingSnapshot(structuredClone(input)), reference)
  assert.deepEqual(f.state.rows.get(reference), first)
})

test('real storage failures never return a successful snapshot reference', async () => {
  for (const idempotent of [false, true]) {
    const f = fixture()
    f.state.writeError = { code: '08006', message: 'Synthetic database connection failure' }
    await assert.rejects(() => f.persistWebsitePricingSnapshot({ ...quote(), idempotent }))
    assert.equal(f.state.rows.size, 0)
  }
})

test('a duplicate cannot be reported as equivalent when its stored audit row cannot be read', async () => {
  const f = fixture()
  const input = quote()
  const reference = await f.persistWebsitePricingSnapshot(input)
  const first = structuredClone(f.state.rows.get(reference))
  f.state.readError = { code: '08006', message: 'Synthetic audit lookup failure' }
  await assert.rejects(() => f.persistWebsitePricingSnapshot({ ...input, idempotent: true }))
  assert.deepEqual(f.state.rows.get(reference), first)
})
