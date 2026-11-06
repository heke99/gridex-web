import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'

const migration = await readFile(new URL('../supabase/migrations/20261020095158_customer_privacy_requests.sql', import.meta.url), 'utf8')
const base = await readFile(new URL('../supabase/migrations/20260710090000_customer_portal_api_hardening.sql', import.meta.url), 'utf8')
const unlinkedMigration = await readFile(new URL('../supabase/migrations/20261020105722_unlinked_customer_privacy_requests.sql', import.meta.url), 'utf8')
const inquiryMigration = await readFile(new URL('../supabase/migrations/20261006205027_public_support_durable_receipts.sql', import.meta.url), 'utf8')
const outboxDDL = base.slice(base.indexOf('create table if not exists public.customer_portal_write_outbox ('), base.indexOf('alter table public.customer_portal_write_outbox'))
const user = '11111111-1111-4111-8111-111111111111'
const otherUser = '22222222-2222-4222-8222-222222222222'
const identity = { userId: user, email: 'privacy@example.invalid', customerNumber: 'TEST-ONLY' }
const reference = `support_case_${'a'.repeat(32)}`
async function fixture() {
  const db = new PGlite()
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    insert into auth.users values('${user}'),('${otherUser}');`)
  await db.exec(outboxDDL)
  await db.exec('alter table public.customer_portal_write_outbox add column payload_hash text; grant select,insert,update on public.customer_portal_write_outbox to service_role;')
  await db.exec(`create table customer_support_tickets(id uuid primary key default gen_random_uuid(),user_id uuid,subject text,description text,category text,priority text,status text,metadata jsonb);
    create table customer_support_messages(id uuid primary key default gen_random_uuid(),ticket_id uuid,sender_user_id uuid,sender_type text,body text);`)
  await db.exec(inquiryMigration)
  await db.exec(migration)
  await db.exec(unlinkedMigration)
  return db
}
async function enqueue(db, kind = 'access', operation = randomUUID(), person = user) {
  return (await db.query('select public.gridex_enqueue_privacy_request_v1($1,$2,$3,$4::jsonb) as value',
    [person, kind, operation, JSON.stringify({ ...identity, userId: person })])).rows[0].value
}
async function counts(db) {
  return (await db.query('select (select count(*)::int from customer_privacy_requests) requests,(select count(*)::int from customer_portal_write_outbox) jobs')).rows[0]
}

test('actual privacy migration restricts browser access and commits one request with one durable job', async () => {
  const db = await fixture()
  try {
    for (const role of ['anon', 'authenticated']) {
      const acl = (await db.query(`select has_function_privilege($1,'public.gridex_enqueue_privacy_request_v1(uuid,text,uuid,jsonb)','execute') enqueue,
        has_function_privilege($1,'public.gridex_complete_privacy_request_v1(uuid,integer,timestamptz,text)','execute') complete,
        has_table_privilege($1,'public.customer_privacy_requests','select,insert,update,delete') direct`, [role])).rows[0]
      assert.deepEqual(acl, { enqueue: false, complete: false, direct: false })
      await db.exec(`set role ${role}`)
      await assert.rejects(enqueue(db), /permission denied/)
      await db.exec('reset role')
    }
    await db.exec('set role service_role')
    const operation = randomUUID()
    const receipt = await enqueue(db, 'access', operation)
    assert.equal(receipt.replayed, false)
    assert.equal((await enqueue(db, 'access', operation)).id, receipt.id)
    assert.equal((await enqueue(db, 'access', operation)).replayed, true)
    await assert.rejects(enqueue(db, 'erasure', operation), /privacy_idempotency_conflict/)
    assert.deepEqual(await counts(db), { requests: 1, jobs: 1 })
    const queue = (await db.query('select operation_type,idempotency_key,identity,payload,payload_hash from customer_portal_write_outbox')).rows[0]
    assert.equal(queue.operation_type, 'privacy_request')
    assert.equal(queue.idempotency_key, `portal-privacy:${user}:${operation}`)
    assert.equal(queue.payload.privacy_request_id, receipt.id)
    assert.match(queue.payload_hash, /^[a-f0-9]{64}$/)
    assert.equal(queue.identity.userId, user)
    assert.equal((await enqueue(db, 'access', operation, otherUser)).replayed, false)
  } finally { await db.close() }
})

test('request insert failure rolls back the job; retries bypass quota but fresh intents do not', async () => {
  const db = await fixture()
  try {
    await db.exec("alter table customer_privacy_requests add constraint injected_failure check(kind<>'erasure')")
    await assert.rejects(enqueue(db, 'erasure'), /injected_failure/)
    assert.deepEqual(await counts(db), { requests: 0, jobs: 0 })
    const operation = randomUUID()
    await enqueue(db, 'access', operation)
    for (let n = 0; n < 4; n++) await enqueue(db)
    await assert.rejects(enqueue(db), /privacy_request_limit/)
    assert.equal((await enqueue(db, 'access', operation)).replayed, true)
    assert.deepEqual(await counts(db), { requests: 5, jobs: 5 })
  } finally { await db.close() }
})

test('receipt and completion commit atomically and stale workers cannot settle another lease', async () => {
  const db = await fixture()
  try {
    await enqueue(db)
    const q = (await db.query("update customer_portal_write_outbox set status='processing',attempt_count=1,last_attempt_at=now() returning id,last_attempt_at")).rows[0]
    const complete = async (attempt = 1, at = q.last_attempt_at, ref = reference) =>
      (await db.query('select gridex_complete_privacy_request_v1($1,$2,$3,$4) value', [q.id, attempt, at, ref])).rows[0].value
    assert.equal(await complete(2), false)
    assert.equal(await complete(1, '2020-01-01T00:00:00Z'), false)
    await assert.rejects(complete(1, q.last_attempt_at, 'not-a-reference'), /privacy_receipt_invalid/)
    await db.exec("alter table customer_portal_write_outbox add constraint injected_completion_failure check(status<>'completed')")
    await assert.rejects(complete(), /injected_completion_failure/)
    assert.equal((await db.query('select ops_case_reference from customer_privacy_requests')).rows[0].ops_case_reference, null)
    await db.exec('alter table customer_portal_write_outbox drop constraint injected_completion_failure')
    assert.equal(await complete(), true)
    assert.equal(await complete(), true)
    assert.equal(await complete(1, q.last_attempt_at, `support_case_${'b'.repeat(32)}`), false)
    const state = (await db.query('select q.status,r.ops_case_reference,r.submitted_at from customer_portal_write_outbox q join customer_privacy_requests r on r.outbox_id=q.id')).rows[0]
    assert.equal(state.status, 'completed')
    assert.equal(state.ops_case_reference, reference)
    assert.ok(state.submitted_at)
    // These are requests/receipts: no customer/Auth deletion function is created.
    assert.equal((await db.query('select count(*)::int n from auth.users')).rows[0].n, 2)
  } finally { await db.close() }
})

test('an Auth-only account atomically creates one real staff inquiry, receipt and completed handoff', async () => {
  const db = await fixture()
  try {
    await db.exec('set role service_role')
    const operation = randomUUID()
    const call = async person => (await db.query('select gridex_enqueue_privacy_request_v1($1,$2,$3,$4::jsonb) value',
      [person, 'access', operation, JSON.stringify({ userId: person, email: 'privacy@example.invalid' })])).rows[0].value
    const first = await call(user)
    assert.equal((await call(user)).id, first.id)
    await db.exec('reset role')
    const request = (await db.query('select * from customer_privacy_requests')).rows[0]
    assert.ok(request.local_ticket_id)
    assert.equal(request.ops_case_reference, null)
    assert.ok(request.submitted_at)
    assert.equal((await db.query('select status from customer_portal_write_outbox')).rows[0].status, 'completed')
    const inquiry = (await db.query('select * from customer_support_tickets')).rows[0]
    assert.equal(inquiry.id, request.local_ticket_id)
    assert.equal(inquiry.user_id, null, 'existing Support123 public inbox requires null user_id')
    assert.equal(inquiry.metadata.source, 'public_kundservice_form')
    assert.equal(inquiry.category, 'data_protection')
    assert.equal(inquiry.metadata.customer_email, 'privacy@example.invalid')
    assert.match(inquiry.description, new RegExp(first.id))
    assert.equal((await db.query('select count(*)::int n from public_support_receipts')).rows[0].n, 1)
    assert.equal((await db.query('select count(*)::int n from customer_support_messages')).rows[0].n, 1)
    assert.deepEqual(await counts(db), { requests: 1, jobs: 1 })
    // Equal client UUIDs from different users must not share a contact ticket.
    const second = await call(otherUser)
    assert.notEqual(first.id, second.id)
    assert.equal((await db.query('select count(*)::int n from customer_support_tickets')).rows[0].n, 2)
  } finally { await db.close() }
})
test('local inquiry failure rolls back request, queue, message and email receipt together', async () => {
  const db = await fixture()
  try {
    await db.exec("alter table customer_privacy_requests add constraint injected_local_failure check(local_ticket_id is null)")
    await assert.rejects(db.query('select gridex_enqueue_privacy_request_v1($1,$2,$3,$4::jsonb)',
      [user, 'erasure', randomUUID(), JSON.stringify({ userId: user, email: 'privacy@example.invalid' })]), /injected_local_failure/)
    assert.deepEqual(await counts(db), { requests: 0, jobs: 0 })
    for (const table of ['customer_support_tickets','customer_support_messages','public_support_receipts']) {
      assert.equal((await db.query(`select count(*)::int n from ${table}`)).rows[0].n, 0)
    }
  } finally { await db.close() }
})
