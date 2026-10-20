import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { dispatchPrivacyRequest } from '../lib/customerPortal/privacyDispatch.ts'
import { parsePrivacyIntent, privacyRequestStatus } from '../lib/customerPortal/privacyRules.ts'

const userId = '11111111-1111-4111-8111-111111111111'
const requestId = '22222222-2222-4222-8222-222222222222'
const reference = `support_case_${'a'.repeat(32)}`
const row = { user_id: userId, identity: { userId, email: 'privacy@example.invalid', customerNumber: 'TEST-ONLY' },
  idempotency_key: `portal-privacy:${userId}:${requestId}`, payload: { kind: 'erasure', privacy_request_id: requestId } }
let currentUser, authError, profile, sent
const db = {
  auth: { admin: { getUserById: async () => ({ data: { user: currentUser }, error: authError }) } },
  from() { return { select() { return this }, eq() { return this }, async maybeSingle() { return { data: profile, error: null } } } },
}
beforeEach(() => {
  currentUser = { id: userId, email: row.identity.email, email_confirmed_at: '2026-01-01T00:00:00Z' }
  profile = { customer_number: 'TEST-ONLY' }
  authError = null; sent = []
  globalThis.__privacy = { async createCase(...args) { sent.push(args); return { data: { case_reference: reference } } } }
})

test('customer intent is closed and cannot carry a forged owner, OPS reference, status or unsupported action', () => {
  const valid = { kind: 'access', client_operation_id: requestId }
  assert.deepEqual(parsePrivacyIntent(valid), { kind: 'access', operationId: requestId })
  for (const change of [{ user_id: userId }, { identity: row.identity }, { status: 'deleted' }, { kind: 'delete_staff' }, { client_operation_id: 'malformed' }]) {
    assert.equal(parsePrivacyIntent({ ...valid, ...change }), null)
  }
})
test('retry delivers the same case payload and key through the canonical support client', async () => {
  assert.equal(await dispatchPrivacyRequest(row, db), reference)
  assert.equal(await dispatchPrivacyRequest(row, db), reference)
  assert.deepEqual(sent[0], sent[1])
  assert.equal(sent[0][2], row.idempotency_key)
  assert.equal(sent[0][1].category, 'data_protection')
  assert.match(sent[0][1].message, /begär.*raderas/)
  assert.equal(Object.keys(sent[0][1]).sort().join(','), 'category,message,title')
})
test('blocked, unverified, deleted, changed-email and changed-customer identities never reach OPS', async () => {
  for (const change of [{ email: 'changed@example.invalid' }, { email_confirmed_at: null }, { banned_until: '2099-01-01T00:00:00Z' }, { deleted_at: '2026-10-20T00:00:00Z' }]) {
    const original = currentUser
    currentUser = { ...original, ...change }
    await assert.rejects(dispatchPrivacyRequest(row, db), e => e.retryable === false)
    currentUser = original
  }
  profile = { customer_number: 'OTHER-CUSTOMER' }
  await assert.rejects(dispatchPrivacyRequest(row, db), e => e.code === 'privacy_customer_link_changed')
  assert.equal(sent.length, 0)
})
test('temporary native Auth failure is retryable and never bypasses identity verification', async () => {
  authError = { status: 503 }
  await assert.rejects(dispatchPrivacyRequest(row, db), e => e.retryable === true)
  assert.equal(sent.length, 0)
})
test('a previously unlinked account cannot retarget a queued request to a newly linked customer', async () => {
  const unlinked = { ...row, identity: { userId, email: row.identity.email } }
  await assert.rejects(dispatchPrivacyRequest(unlinked, db), e => e.code === 'privacy_customer_link_changed')
  profile = { customer_number: 'TEST-ONLY', external_customer_id: 'different-stable-customer' }
  await assert.rejects(dispatchPrivacyRequest(row, db), e => e.code === 'privacy_customer_link_changed')
  assert.equal(sent.length, 0)
})
test('queue completion means case submission, never completed export or erasure', () => {
  assert.equal(privacyRequestStatus(null, 'pending'), 'queued')
  assert.equal(privacyRequestStatus(null, 'failed'), 'queued')
  assert.equal(privacyRequestStatus(null, 'dead_letter'), 'needs_attention')
  assert.equal(privacyRequestStatus(null, 'completed'), 'needs_attention')
  assert.equal(privacyRequestStatus(reference, 'completed'), 'submitted')
})
