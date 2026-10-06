import assert from 'node:assert/strict'
import { test, after } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { writeFile } from 'node:fs/promises'

// Exercise the real Supabase query builder and PostgreSQL filters with synthetic data.
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://performance.invalid'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-performance-service-key'
const db = new PGlite()
await db.exec(`create table website_public_contract_snapshots (
  cache_key text primary key, contract_version text, parser_version text,
  schema_sha256 text, organization_reference text, fetched_at timestamptz, snapshot jsonb
)`)
const organization = 'organization_' + 'a'.repeat(32)
const expected = { organizationReference: organization, contractVersion: 'test-v1', parserVersion: 'test-parser', schemaSha256: 'a'.repeat(64), maxAgeMs: 60_000 }
const snapshot = {
  contracts: Array.from({ length: 40 }, (_, i) => ({ offer_reference: 'offer_' + i, description: 'synthetic public contract '.repeat(100) })),
  blocked_contracts: [], feed_state: 'contracts_present', empty_feed_authorization: null,
  warnings: [], compatibility_issues: [], parser_version: expected.parserVersion,
  schema_sha256: expected.schemaSha256, organization_reference: organization,
  contract_version: expected.contractVersion, publication_revision: 42,
  fetched_at: new Date().toISOString(), upstream_status: 200, etag: 'test-etag',
}
async function insert(key, { columns = {}, payload = {} } = {}) {
  const row = { contract_version: expected.contractVersion, parser_version: expected.parserVersion, schema_sha256: expected.schemaSha256, organization_reference: organization, fetched_at: snapshot.fetched_at, ...columns }
  await db.query('insert into website_public_contract_snapshots values ($1,$2,$3,$4,$5,$6,$7)', [key, row.contract_version, row.parser_version, row.schema_sha256, row.organization_reference, row.fetched_at, JSON.stringify({ ...snapshot, ...payload })])
}
await insert('valid')
await insert('expired', { columns: { fetched_at: '2020-01-01' }, payload: { fetched_at: '2020-01-01' } })
await insert('wrong-organization', { columns: { organization_reference: 'organization_' + 'b'.repeat(32) } })
await insert('wrong-parser', { columns: { parser_version: 'old-parser' } })
await insert('wrong-contract', { columns: { contract_version: 'old-contract' } })
await insert('wrong-schema', { columns: { schema_sha256: 'b'.repeat(64) } })
await insert('corrupt-payload', { payload: { organization_reference: 'organization_' + 'b'.repeat(32) } })
let bytes = 0, lastUrl, simulateFailure = false
const originalFetch = globalThis.fetch
globalThis.fetch = async (input) => {
  const url = new URL(String(input)); lastUrl = url
  assert.equal(url.origin, 'https://performance.invalid', 'no live service may be contacted')
  if (simulateFailure) return new Response(JSON.stringify({ message: 'Modeled database outage', code: 'XX000' }), { status: 500 })
  const clauses = [], parameters = []
  for (const [key, value] of url.searchParams) {
    if (key === 'select') { assert.equal(value, 'snapshot'); continue }
    assert.ok(['cache_key', 'contract_version', 'parser_version', 'schema_sha256', 'organization_reference', 'fetched_at'].includes(key))
    const operation = value.slice(0, value.indexOf('.'))
    assert.ok(['eq', 'gte'].includes(operation))
    parameters.push(value.slice(value.indexOf('.') + 1))
    clauses.push(`${key} ${operation === 'eq' ? '=' : '>='} $${parameters.length}`)
  }
  const { rows } = await db.query(`select snapshot from website_public_contract_snapshots where ${clauses.join(' and ')}`, parameters)
  const body = JSON.stringify(rows); bytes += Buffer.byteLength(body)
  return new Response(body, { headers: { 'content-type': 'application/json' } })
}
after(async () => { globalThis.fetch = originalFetch; await db.close() })
const { readWebsitePublicContractSnapshot } = await import('../lib/website/publicContractSnapshotStore.ts')
test('eligible public snapshots keep their payload and identity checks', async () => {
  const result = await readWebsitePublicContractSnapshot('valid', expected)
  assert.equal(result.contracts.length, 40)
  assert.equal(result.publication_revision, 42)
  assert.equal(result.stale, false)
  assert.equal(lastUrl.searchParams.get('organization_reference'), `eq.${organization}`)
  assert.equal(await readWebsitePublicContractSnapshot('corrupt-payload', expected), null)
})
test('expired or incompatible snapshots transfer no contract payload', async () => {
  for (const key of ['expired', 'wrong-organization', 'wrong-parser', 'wrong-contract', 'wrong-schema', 'missing']) {
    const baseline = JSON.stringify((await db.query('select snapshot from website_public_contract_snapshots where cache_key=$1', [key])).rows)
    const beforeBytes = bytes
    assert.equal(await readWebsitePublicContractSnapshot(key, expected), null)
    assert.equal(bytes - beforeBytes, 2)
    if (key === 'expired') {
      const evidence = { baselineResponseBytes: Buffer.byteLength(baseline), optimizedResponseBytes: bytes - beforeBytes, contractRowsTransferred: { before: 40, after: 0 }, liveDatabaseChanged: false }
      console.log('Expired snapshot transfer:', JSON.stringify(evidence))
      if (process.env.GRIDEX_PERF_SNAPSHOT_OUTPUT) await writeFile(process.env.GRIDEX_PERF_SNAPSHOT_OUTPUT, JSON.stringify(evidence, null, 2) + '\n')
    }
  }
})
test('an unavailable snapshot database still rejects the read', async () => {
  simulateFailure = true
  await assert.rejects(() => readWebsitePublicContractSnapshot('valid', expected), /snapshot read failed/)
  simulateFailure = false
})
