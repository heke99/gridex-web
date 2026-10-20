import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const read = (file) => readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8')
const schema = await read('20260803102000_public_contract_snapshot_portable_schema.sql')
const legacy = await read('20260819193000_ops_organization_reference_expand.sql')
const migration = await read('20261020190500_public_contract_snapshot_revision_race.sql')
const rpcStart = 'create or replace function public.store_website_public_contract_snapshot_v2('
const originalRpc = legacy.slice(legacy.indexOf(rpcStart), legacy.indexOf('create or replace function public.apply_ops_publication_event_v2('))
const fixedRpc = migration.slice(migration.indexOf(rpcStart), migration.lastIndexOf('commit;'))
const snapshotTable = schema.slice(schema.indexOf('create table if not exists public.website_public_contract_snapshots ('), schema.indexOf('create index if not exists website_public_contract_snapshots_tenant_lookup_idx'))
const db = new PGlite()
after(() => db.close())
await db.exec(`create role anon; create role authenticated; create role service_role;
  create table public.ops_publication_state (
    tenant_reference text not null, organization_reference text, channel text not null,
    publication_revision bigint, changed_at timestamptz, updated_at timestamptz,
    primary key(tenant_reference, channel)
  );
  ${snapshotTable}
  alter table public.website_public_contract_snapshots add column organization_reference text;
  ${originalRpc}`)
const org = 'organization_' + 'a'.repeat(32)
const other = 'organization_' + 'b'.repeat(32)
const stamp = '2026-10-20T18:00:00Z'
async function store({ key = 'fixture|private', revision = 42, organization = org, empty = true, fetchedAt = stamp } = {}) {
  const proof = empty ? {
    authorized: true, reason: 'no_canonical_publications', publication_revision: revision,
    canonical_source: 'canonical_public_contract_delivery_readiness_v', affected_offer_references: [], blockers: [],
  } : null
  const snapshot = {
    organization_reference: organization, contract_version: 'test-v1', publication_revision: revision,
    feed_state: empty ? 'canonical_empty' : 'contracts_present', empty_feed_authorization: proof,
    contracts: empty ? [] : [{ offer_reference: 'synthetic-offer' }], blocked_contracts: [], fetched_at: fetchedAt,
  }
  return (await db.query(`select * from public.store_website_public_contract_snapshot_v2(${Array.from({ length: 15 }, (_, i) => '$' + (i + 1)).join(',')})`, [
    key, organization, 'private', revision, 'test-v1', 'parser-v1', 'a'.repeat(64), 'test-etag',
    JSON.stringify(snapshot), empty ? 0 : 1, 0, empty ? 0 : 1, snapshot.feed_state,
    proof ? JSON.stringify(proof) : null, fetchedAt,
  ])).rows[0]
}
const interleavingPoint = '  if v_local_revision is null or p_publication_revision > v_local_revision then'
function modeledInterleaving(rpc) {
  // PGlite has one session. Inject a newer committed state at the exact point
  // an absent-row SELECT could race a webhook; this is not a parallel-session test.
  assert.equal(rpc.split(interleavingPoint).length, 2)
  return rpc.replace(interleavingPoint, `
    if v_local_revision is null then
      insert into public.ops_publication_state(tenant_reference,organization_reference,channel,publication_revision)
      values(p_organization_reference,p_organization_reference,'website',p_publication_revision+1);
    end if;
${interleavingPoint}`)
}

test('baseline reproduces an older snapshot accepted after a missing-state interleaving', async () => {
  await db.exec(modeledInterleaving(originalRpc))
  assert.equal((await store()).stored, true)
  assert.equal(Number((await db.query('select publication_revision from ops_publication_state')).rows[0].publication_revision), 43)
  assert.equal(Number((await db.query('select publication_revision from website_public_contract_snapshots')).rows[0].publication_revision), 42)
  await db.exec('truncate public.website_public_contract_snapshots, public.ops_publication_state')
  await db.exec(originalRpc)
})

test('forward migration applies to the exact baseline and keeps service-only execution', async () => {
  await db.exec(migration)
  for (const role of ['anon', 'authenticated', 'service_role']) {
    const { rows } = await db.query("select has_function_privilege($1,'public.store_website_public_contract_snapshot_v2(text,text,text,bigint,text,text,text,text,jsonb,integer,integer,integer,text,jsonb,timestamptz)','execute') allowed", [role])
    assert.equal(rows[0].allowed, role === 'service_role')
  }
})

test('newer state wins the missing-row race for both full and confirmed-empty snapshots', async () => {
  await db.exec(modeledInterleaving(fixedRpc))
  for (const empty of [true, false]) {
    await db.exec('truncate public.website_public_contract_snapshots, public.ops_publication_state')
    const result = await store({ empty })
    assert.equal(result.stored, false)
    assert.equal(result.result, 'rejected_older_than_local_publication_state')
    assert.equal(Number(result.stored_revision), 43)
    assert.equal((await db.query('select count(*)::int n from website_public_contract_snapshots')).rows[0].n, 0)
    assert.equal(Number((await db.query('select publication_revision from ops_publication_state')).rows[0].publication_revision), 43)
  }
  await db.exec(fixedRpc)
})

test('normal store, same-revision freshness renewal, newer revision and identity guard remain', async () => {
  await db.exec('truncate public.website_public_contract_snapshots, public.ops_publication_state')
  for (const empty of [true, false]) {
    const key = `fixture|${empty ? 'empty' : 'full'}`
    assert.equal((await store({ key, empty })).stored, true)
    const nextStamp = '2026-10-20T18:10:00Z'
    assert.equal((await store({ key, empty, fetchedAt: nextStamp })).stored, true)
    const saved = (await db.query('select snapshot from website_public_contract_snapshots where cache_key=$1', [key])).rows[0].snapshot
    assert.equal(saved.fetched_at, nextStamp)
    assert.equal(saved.feed_state, empty ? 'canonical_empty' : 'contracts_present')
  }
  assert.equal((await store({ revision: 43 })).stored, true)
  assert.equal((await store({ revision: 42 })).stored, false)
  await assert.rejects(() => store({ revision: 43, organization: other }), error => error.code === '23505')
})

test('an unexpected concurrent function edit is not overwritten by the migration', async () => {
  await assert.rejects(() => db.exec(migration), /Public contract snapshot RPC source changed/)
  await db.exec('rollback')
})
