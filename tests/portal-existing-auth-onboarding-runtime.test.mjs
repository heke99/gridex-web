import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const userId = '11111111-1111-4111-8111-111111111111'
const otherId = '22222222-2222-4222-8222-222222222222'
const email = 'customer@example.com'
const input = {
  submissionAttemptId: 'submission-1',
  application: {
    customer_number: 'C-1001', external_customer_id: 'customer-1',
    application_number: 'application-1', contract_reference: 'contract-1', status: 'accepted',
  },
  email, customerType: 'private', offerReference: 'offer-1',
}

// Execute the actual modules; replace only outbound provider/API and encrypted
// result persistence boundaries. No production service or email is reachable.
const errorsUrl = new URL('../lib/ops/errors.ts', import.meta.url).href
const seams = new Map([
  ['@/lib/supabase/service', 'export const supabaseService = { from: (...args) => globalThis.portalFixture.from(...args), get auth() { return globalThis.portalFixture.auth } };'],
  ['@/lib/supabase/server', 'export async function createSupabaseServerActionClient() { return { auth: { async getUser() { return { data: { user: globalThis.portalFixture.callbackUser }, error: null }; } } }; }'],
  ['@/lib/ops/client', 'export { OpsError, isOpsError } from ' + JSON.stringify(errorsUrl) + '; export async function submitOpsCustomerPortalSync(input) { return globalThis.portalFixture.sync(input); }'],
  ['@/lib/website/applicationResultStore', 'export async function readWebsiteApplicationResultState(token) { return globalThis.portalFixture.result(token); } export function isWebsiteApplicationResultTokenShape(token) { return token === "signed-result"; }'],
])
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (seams.has(specifier)) return { url: 'data:text/javascript,' + encodeURIComponent(seams.get(specifier)), shortCircuit: true }
    return nextResolve(specifier, context)
  },
})
globalThis.fetch = () => { throw new Error('Unexpected outbound network request') }

const onboarding = await import('../lib/customerPortal/onboarding.ts')
const resume = await import('../lib/customerPortal/onboardingResume.ts')
const claim = await import('../lib/customerPortal/portalClaim.ts')
const claimRoute = await import('../app/auth/portal-claim/route.ts')
const { NextRequest } = await import('next/server.js')

class Query {
  constructor(fixture, table) { this.fixture = fixture; this.table = table; this.predicates = []; this.columns = '*' }
  select(columns = '*', options) { this.columns = columns; this.options = options; return this }
  eq(key, value) { this.predicates.push(row => row[key] === value); return this }
  neq(key, value) { this.predicates.push(row => row[key] !== value); return this }
  in(key, values) { this.predicates.push(row => values.includes(row[key])); return this }
  is(key, value) { this.predicates.push(row => (row[key] ?? null) === value); return this }
  ilike(key, value) {
    const pattern = new RegExp('^' + value.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$', 'i')
    this.predicates.push(row => pattern.test(row[key]))
    return this
  }
  lte(key, value) { this.predicates.push(row => row[key] !== null && row[key] <= value); return this }
  lt(key, value) { this.predicates.push(row => row[key] !== null && row[key] < value); return this }
  limit(value) { this.max = value; return this }
  order(key) { this.orderKey = key; return this }
  returns() { return this }
  update(patch) { this.patch = patch; return this }
  upsert(rows, options = {}) { this.insert = Array.isArray(rows) ? rows : [rows]; this.conflict = options.onConflict; this.ignoreDuplicates = options.ignoreDuplicates; return this }
  maybeSingle() { return this.execute(true) }
  single() { return this.execute(true) }
  then(resolve, reject) { return this.execute(false).then(resolve, reject) }
  async execute(single) {
    const table = this.fixture.tables[this.table]
    assert.ok(table, 'Unexpected table ' + this.table)
    let rows
    if (this.insert) {
      const keys = (this.conflict ?? 'id').split(',')
      rows = this.insert.flatMap(patch => {
        let row = table.find(candidate => keys.every(key => candidate[key] === patch[key]))
        if (row && this.ignoreDuplicates) return []
        if (!row) { row = { id: 'job-' + (table.length + 1) }; table.push(row) }
        Object.assign(row, structuredClone(patch))
        this.fixture.writes.push({ table: this.table, id: row.id, patch: structuredClone(patch) })
        return [row]
      })
    } else {
      rows = table.filter(row => this.predicates.every(predicate => predicate(row)))
      if (this.orderKey) rows.sort((a, b) => String(a[this.orderKey]).localeCompare(String(b[this.orderKey])))
      if (this.max !== undefined) rows = rows.slice(0, this.max)
      if (rows.some(row => this.fixture.rejectUpdate?.(this.table, row, this.patch))) {
        return { data: null, error: { message: 'Synthetic reservation failure' } }
      }
      if (this.patch) for (const row of rows) {
        Object.assign(row, structuredClone(this.patch))
        this.fixture.writes.push({ table: this.table, id: row.id, patch: structuredClone(this.patch) })
      }
    }
    const count = rows.length
    const projected = rows.map(row => this.columns === '*' ? structuredClone(row)
      : Object.fromEntries(this.columns.split(',').map(key => [key, structuredClone(row[key])])))
    if (!this.patch && !this.insert) this.fixture.afterRead?.(this.table, this.columns)
    return { data: this.options?.head ? null : single ? projected[0] ?? null : projected, error: null, count }
  }
}

function fixture(options = {}) {
  const f = {
    writes: [], syncs: [], invites: 0, resets: 0, generatedLinks: 0, callbackUser: null,
    tables: {
      portal_onboarding_jobs: [], customer_profiles: [], customer_contract_portal_links: [], customer_delivery_points: [],
      website_application_submissions: [{
        submission_attempt_id: input.submissionAttemptId, user_id: null, status: 'accepted',
        external_customer_id: 'customer-1', ops_customer_number: 'C-1001', ops_application_number: 'application-1',
      }],
    },
    auth: { admin: {
      async inviteUserByEmail() {
        f.invites += 1
        return options.newUser ? { data: { user: { id: userId } }, error: null }
          : { data: {}, error: { status: 422, message: 'User already registered', code: 'email_exists' } }
      },
      async generateLink() { f.generatedLinks += 1; throw new Error('Unsolicited link generation') },
      async getUserById(id) {
        await f.onAuthRead?.()
        return { data: { user: { id, email, email_confirmed_at: '2026-10-01T00:00:00Z', ...options.authUser } }, error: null }
      },
    }, async resetPasswordForEmail() { f.resets += 1; throw new Error('Unsolicited reset email') } },
    from(table) { return new Query(f, table) },
    async sync(value) {
      f.syncs.push(structuredClone(value))
      await f.onSync?.()
      return { status: 'linked', synced: { access_granted: true, portal_role: 'owner', identity_id: 'identity-1' } }
    },
    async result(token) {
      return token === 'signed-result'
        ? { status: 'verified', userId: null, submissionAttemptId: input.submissionAttemptId, result: { customerNumber: 'C-1001' } }
        : { status: 'expired' }
    },
  }
  globalThis.portalFixture = f
  return f
}

function waitingJob(overrides = {}) {
  return {
    id: 'job-1', submission_attempt_id: input.submissionAttemptId, status: 'pending',
    email, auth_user_id: null, customer_number: 'C-1001', external_customer_id: 'customer-1',
    payload: structuredClone(input), attempt_count: 0, max_attempts: 10,
    next_attempt_at: null, last_error: 'existing_auth_user_requires_login', locked_at: null, ...overrides,
  }
}

for (const startingWithJob of [true, false]) {
  test(`onboarding enqueue preserves a concurrent worker lease with ${startingWithJob ? 'an existing' : 'a new'} row`, async () => {
    const f = fixture()
    const job = waitingJob({ next_attempt_at: '2000-01-01T00:00:00Z', last_error: null, updated_at: '2000-01-01T00:00:00Z' })
    if (startingWithJob) f.tables.portal_onboarding_jobs.push(job)
    f.afterRead = table => {
      if (table !== 'portal_onboarding_jobs') return
      f.afterRead = null
      Object.assign(job, { status: 'processing', attempt_count: 1, locked_at: 'worker-lease', updated_at: '2026-11-22T12:00:00Z' })
      if (!startingWithJob) f.tables.portal_onboarding_jobs.push(job)
    }
    const result = await onboarding.ensureCustomerPortalOnboarding(input)
    assert.equal(result.status, 'pending')
    assert.deepEqual(f.tables.portal_onboarding_jobs.map(row => [row.status, row.attempt_count, row.locked_at]),
      [['processing', 1, 'worker-lease']])
    assert.equal(f.writes.length, 0)
    assert.equal(f.invites, 0)
  })
}

test('existing account waits for explicit claim without sending mail or minting reset tokens', async () => {
  const f = fixture()
  const result = await onboarding.ensureCustomerPortalOnboarding(input)
  assert.equal(result.status, 'pending')
  assert.match(result.message, /konto finns redan/i)
  assert.equal(f.tables.portal_onboarding_jobs[0].status, 'pending')
  assert.equal(f.tables.portal_onboarding_jobs[0].next_attempt_at, null)
  assert.equal(f.tables.portal_onboarding_jobs[0].attempt_count, 0)
  assert.equal(f.tables.portal_onboarding_jobs[0].auth_user_id, null)
  assert.equal(f.resets + f.generatedLinks + f.syncs.length, 0)
  assert.equal(f.tables.customer_profiles.length, 0)
})

test('repeat checkout and scheduled worker leave an existing-account wait idempotent', async () => {
  const f = fixture()
  await onboarding.ensureCustomerPortalOnboarding(input)
  const before = structuredClone(f.tables.portal_onboarding_jobs)
  const result = await onboarding.ensureCustomerPortalOnboarding(input)
  assert.match(result.message, /konto finns redan/i)
  assert.deepEqual(f.tables.portal_onboarding_jobs, before)
  assert.equal(f.invites, 1)
  assert.equal((await onboarding.processPortalOnboardingJobs()).processed, 0)
  assert.equal(f.syncs.length, 0)
})

test('login alone cannot claim an unbound job by shared email', async () => {
  const f = fixture()
  f.tables.portal_onboarding_jobs.push(waitingJob())
  assert.equal((await resume.resumePortalOnboardingForConfirmedUserSafely({ userId, email })).completed, 0)
  assert.equal(f.syncs.length, 0)
  assert.equal(f.tables.customer_profiles.length, 0)
  assert.equal(f.tables.portal_onboarding_jobs[0].auth_user_id, null)
})

test('explicit signed-result claim links once and preserves older contract projections', async () => {
  const f = fixture()
  f.tables.portal_onboarding_jobs.push(waitingJob())
  f.tables.customer_contract_portal_links.push({ user_id: userId, contract_provider_key: 'ops', contract_external_ref: 'old-contract' })
  const request = { userId, email, resultToken: 'signed-result' }
  assert.equal((await claim.resumePortalOnboardingFromResultProof(request)).status, 'linked')
  assert.equal((await claim.resumePortalOnboardingFromResultProof(request)).status, 'linked')
  assert.equal(f.syncs.length, 1)
  assert.equal(f.tables.portal_onboarding_jobs[0].status, 'completed')
  assert.equal(f.tables.portal_onboarding_jobs[0].auth_user_id, userId)
  assert.equal(f.tables.customer_profiles.length, 1)
  assert.equal(f.tables.customer_contract_portal_links.length, 2)
  assert.equal(f.tables.customer_contract_portal_links[0].contract_external_ref, 'old-contract')
  assert.equal(f.resets + f.generatedLinks, 0)
})

test('expired checkout proof causes no ownership or persistence changes', async () => {
  const f = fixture()
  f.tables.portal_onboarding_jobs.push(waitingJob())
  const before = structuredClone(f.tables)
  assert.equal((await claim.resumePortalOnboardingFromResultProof({ userId, email, resultToken: 'expired' })).status, 'invalid')
  assert.deepEqual(f.tables, before)
  assert.equal(f.syncs.length, 0)
})

test('actual claim route preserves signed intent across login and makes authenticated replay idempotent', async () => {
  const f = fixture()
  f.tables.portal_onboarding_jobs.push(waitingJob())
  const request = new NextRequest('https://gridex.invalid/auth/portal-claim?result=signed-result')
  const login = new URL((await claimRoute.GET(request)).headers.get('location'))
  assert.equal(login.pathname, '/login')
  assert.equal(login.searchParams.get('next'), '/auth/portal-claim?result=signed-result')
  assert.equal(f.syncs.length, 0)
  f.callbackUser = { id: userId, email }
  const completed = new URL((await claimRoute.GET(request)).headers.get('location'))
  assert.equal(completed.pathname, '/mina-sidor')
  assert.equal(completed.searchParams.get('portal_link'), 'completed')
  await claimRoute.GET(request)
  assert.equal(f.syncs.length, 1)
  assert.equal(f.resets + f.generatedLinks, 0)
})

test('waiting submission cannot be replayed with a different stable customer', async () => {
  const f = fixture()
  await onboarding.ensureCustomerPortalOnboarding(input)
  const before = structuredClone(f.tables)
  const result = await onboarding.ensureCustomerPortalOnboarding({
    ...input, application: { ...input.application, external_customer_id: 'different-customer' },
  })
  assert.equal(result.status, 'failed')
  assert.deepEqual(f.tables, before)
  assert.equal(f.invites, 1)
  assert.equal(f.syncs.length, 0)
})

test('signed claim refuses mismatched accepted-submission identity', async () => {
  const f = fixture()
  f.tables.portal_onboarding_jobs.push(waitingJob())
  f.tables.website_application_submissions[0].external_customer_id = 'different-customer'
  assert.equal((await claim.resumePortalOnboardingFromResultProof({ userId, email, resultToken: 'signed-result' })).status, 'blocked')
  assert.equal(f.syncs.length, 0)
  assert.equal(f.tables.customer_profiles.length, 0)
})

for (const profile of [
  { external_customer_id: 'different-customer', customer_number: 'C-1001' },
  { external_customer_id: 'customer-1', customer_number: 'C-OTHER' },
]) test('signed checkout refuses known conflicting profile: ' + JSON.stringify(profile), async () => {
  const f = fixture()
  f.tables.portal_onboarding_jobs.push(waitingJob())
  f.tables.customer_profiles.push({ user_id: userId, email, ...profile })
  const before = structuredClone(f.tables.customer_profiles)
  assert.equal((await claim.resumePortalOnboardingFromResultProof({ userId, email, resultToken: 'signed-result' })).status, 'blocked')
  assert.deepEqual(f.tables.customer_profiles, before)
  assert.equal(f.syncs.length, 0)
})

test('callback cannot take a job bound to another Auth UUID', async () => {
  const f = fixture()
  f.tables.portal_onboarding_jobs.push(waitingJob({ auth_user_id: otherId }))
  assert.equal((await claim.resumePortalOnboardingFromResultProof({ userId, email, resultToken: 'signed-result' })).status, 'blocked')
  assert.equal(f.tables.portal_onboarding_jobs[0].auth_user_id, otherId)
  assert.equal(f.syncs.length, 0)
})

test('stale signed-claim completion cannot overwrite a replacement processing claim', async () => {
  const f = fixture()
  f.tables.portal_onboarding_jobs.push(waitingJob())
  f.onSync = () => { f.tables.portal_onboarding_jobs[0].locked_at = 'replacement-lock' }
  assert.equal((await claim.resumePortalOnboardingFromResultProof({ userId, email, resultToken: 'signed-result' })).status, 'pending')
  assert.equal(f.tables.portal_onboarding_jobs[0].status, 'processing')
  assert.equal(f.tables.portal_onboarding_jobs[0].locked_at, 'replacement-lock')
  assert.equal(f.tables.customer_profiles.length, 0)
})

test('signed claim cannot replace an Auth binding changed after validation', async () => {
  const f = fixture()
  f.tables.portal_onboarding_jobs.push(waitingJob())
  f.afterRead = table => {
    if (table !== 'customer_profiles') return
    f.afterRead = null
    f.tables.portal_onboarding_jobs[0].auth_user_id = otherId
  }
  assert.equal((await claim.resumePortalOnboardingFromResultProof({ userId, email, resultToken: 'signed-result' })).status, 'pending')
  assert.equal(f.tables.portal_onboarding_jobs[0].auth_user_id, otherId)
  assert.equal(f.syncs.length, 0)
})

test('signed claim checks its Auth binding again after the canonical API await', async () => {
  const f = fixture()
  f.tables.portal_onboarding_jobs.push(waitingJob())
  f.onSync = () => { f.tables.portal_onboarding_jobs[0].auth_user_id = otherId }
  assert.equal((await claim.resumePortalOnboardingFromResultProof({ userId, email, resultToken: 'signed-result' })).status, 'pending')
  assert.equal(f.tables.portal_onboarding_jobs[0].auth_user_id, otherId)
  assert.equal(f.tables.portal_onboarding_jobs[0].status, 'processing')
  assert.equal(f.tables.customer_profiles.length, 0)
})

test('signed claim lost during its last profile read cannot publish any projection', async () => {
  const f = fixture()
  f.tables.portal_onboarding_jobs.push(waitingJob())
  let reads = 0
  f.afterRead = table => {
    if (table !== 'customer_profiles' || ++reads !== 2) return
    Object.assign(f.tables.portal_onboarding_jobs[0], {
      locked_at: 'replacement-lock', attempt_count: 2, auth_user_id: otherId,
    })
  }
  assert.equal((await claim.resumePortalOnboardingFromResultProof({ userId, email, resultToken: 'signed-result' })).status, 'pending')
  assert.equal(f.writes.filter(write => write.table !== 'portal_onboarding_jobs').length, 0)
})

for (const initiallyPresent of [false, true]) test('signed claim cannot overwrite a profile changed after its last identity read: ' + initiallyPresent, async () => {
  const f = fixture()
  f.tables.portal_onboarding_jobs.push(waitingJob())
  if (initiallyPresent) f.tables.customer_profiles.push({
    user_id: userId, email, external_customer_id: 'customer-1', customer_number: 'C-1001',
  })
  let reads = 0
  f.afterRead = table => {
    if (table !== 'customer_profiles' || ++reads !== 2) return
    const replacement = { user_id: userId, email, external_customer_id: 'concurrent-other-customer', customer_number: 'C-OTHER' }
    if (initiallyPresent) Object.assign(f.tables.customer_profiles[0], replacement)
    else f.tables.customer_profiles.push(replacement)
  }
  assert.equal((await claim.resumePortalOnboardingFromResultProof({ userId, email, resultToken: 'signed-result' })).status, 'blocked')
  assert.equal(f.tables.customer_profiles[0].external_customer_id, 'concurrent-other-customer')
  assert.equal(f.tables.customer_profiles[0].customer_number, 'C-OTHER')
  assert.equal(f.writes.filter(write => write.table !== 'portal_onboarding_jobs').length, 0)
})

for (const replacement of [
  { locked_at: 'replacement-lock', attempt_count: 2 },
  { auth_user_id: otherId },
]) test('worker cannot publish verified projections after its claim changes during canonical sync: ' + JSON.stringify(replacement), async () => {
  const f = fixture()
  const job = waitingJob({ auth_user_id: userId, last_error: null, next_attempt_at: '2026-01-01T00:00:00Z' })
  job.payload.authenticatedUserId = userId
  f.tables.portal_onboarding_jobs.push(job)
  let before = 0
  f.onSync = () => {
    before = f.writes.length
    Object.assign(f.tables.portal_onboarding_jobs[0], replacement)
  }
  await onboarding.processPortalOnboardingJobs()
  assert.equal(f.writes.slice(before).filter(write => write.table !== 'portal_onboarding_jobs').length, 0)
  assert.equal(f.tables.customer_contract_portal_links.length, 0)
})

test('signed claim lost during provider verification cannot call canonical sync', async () => {
  const f = fixture()
  f.tables.portal_onboarding_jobs.push(waitingJob())
  f.onAuthRead = () => { f.tables.portal_onboarding_jobs[0].locked_at = 'replacement-lock' }
  assert.equal((await claim.resumePortalOnboardingFromResultProof({ userId, email, resultToken: 'signed-result' })).status, 'pending')
  assert.equal(f.syncs.length, 0)
  assert.equal(f.tables.customer_profiles.length, 0)
})

for (const boundary of ['provider', 'profile']) test('worker lost during ' + boundary + ' verification cannot call canonical sync', async () => {
  const f = fixture()
  const job = waitingJob({ auth_user_id: userId, last_error: null, next_attempt_at: '2026-01-01T00:00:00Z' })
  job.payload.authenticatedUserId = userId
  f.tables.portal_onboarding_jobs.push(job)
  const stealClaim = () => { job.locked_at = 'replacement-lock' }
  if (boundary === 'provider') f.onAuthRead = stealClaim
  else f.afterRead = table => { if (table === 'customer_profiles') stealClaim() }
  await onboarding.processPortalOnboardingJobs()
  assert.equal(f.syncs.length, 0)
  assert.equal(f.tables.customer_profiles.length, 0)
})

test('worker refuses a customer identity changed during canonical sync', async () => {
  const f = fixture()
  const job = waitingJob({ auth_user_id: userId, last_error: null, next_attempt_at: '2026-01-01T00:00:00Z' })
  job.payload.authenticatedUserId = userId
  f.tables.portal_onboarding_jobs.push(job)
  f.onSync = () => f.tables.customer_profiles.push({ user_id: userId, email, external_customer_id: 'different-customer', customer_number: 'C-OTHER' })
  assert.equal((await onboarding.processPortalOnboardingJobs()).failed, 1)
  assert.equal(f.tables.customer_profiles[0].external_customer_id, 'different-customer')
  assert.equal(f.tables.customer_contract_portal_links.length, 0)
})

test('worker lost during email discovery cannot send a new account invitation', async () => {
  const f = fixture({ newUser: true })
  const job = waitingJob({ last_error: null, next_attempt_at: '2026-01-01T00:00:00Z' })
  f.tables.portal_onboarding_jobs.push(job)
  f.afterRead = table => { if (table === 'customer_profiles') job.locked_at = 'replacement-lock' }
  await onboarding.processPortalOnboardingJobs()
  assert.equal(f.invites, 0)
  assert.equal(f.syncs.length, 0)
})

test('worker refuses a stored payload that conflicts with its durable Auth binding', async () => {
  const f = fixture()
  const job = waitingJob({ auth_user_id: userId, last_error: null, next_attempt_at: '2026-01-01T00:00:00Z' })
  job.payload.authenticatedUserId = otherId
  f.tables.portal_onboarding_jobs.push(job)
  assert.equal((await onboarding.processPortalOnboardingJobs()).failed, 1)
  assert.equal(f.tables.portal_onboarding_jobs[0].auth_user_id, userId)
  assert.equal(f.tables.portal_onboarding_jobs[0].status, 'manual_review')
  assert.equal(f.syncs.length, 0)
})

test('durable authenticated payload does not bypass current Auth confirmation', async () => {
  const f = fixture({ authUser: { email_confirmed_at: null, confirmed_at: null } })
  assert.equal((await onboarding.ensureCustomerPortalOnboarding({ ...input, authenticatedUserId: userId })).status, 'email_confirmation_sent')
  assert.equal(f.syncs.length, 0)
})

for (const authUser of [{ id: otherId }, { deleted_at: '2026-10-04' }, { banned_until: '2999-01-01T00:00:00Z' }]) {
  test('explicit claim requires current provider eligibility: ' + JSON.stringify(authUser), async () => {
    const f = fixture({ authUser })
    f.tables.portal_onboarding_jobs.push(waitingJob())
    assert.equal((await claim.resumePortalOnboardingFromResultProof({ userId, email, resultToken: 'signed-result' })).status, 'blocked')
    assert.equal(f.syncs.length, 0)
    assert.equal(f.tables.customer_profiles.length, 0)
  })
}

test('safe callback processes only IDs from its already-validated candidate set', async () => {
  const f = fixture()
  f.tables.portal_onboarding_jobs.push(waitingJob({ auth_user_id: userId }))
  f.tables.customer_profiles.push({ user_id: userId, email, external_customer_id: 'customer-1', customer_number: 'C-1001' })
  f.afterRead = table => {
    if (table !== 'customer_profiles') return
    f.afterRead = null
    const second = structuredClone(waitingJob({ id: 'job-foreign', submission_attempt_id: 'submission-foreign', auth_user_id: otherId }))
    second.payload.application.external_customer_id = 'foreign-customer'
    f.tables.portal_onboarding_jobs.push(second)
  }
  assert.equal((await resume.resumePortalOnboardingForConfirmedUserSafely({ userId, email })).completed, 1)
  assert.deepEqual(f.syncs.map(value => value.idempotencyKey), ['submission-1'])
  assert.equal(f.tables.portal_onboarding_jobs[1].auth_user_id, otherId)
  assert.equal(f.tables.portal_onboarding_jobs[1].status, 'pending')
})

test('a bound Auth UUID cannot bypass a known stable-customer conflict on callback', () => {
  fixture()
  const profile = { user_id: userId, email, external_customer_id: 'different-customer', customer_number: 'C-1001' }
  assert.equal(resume.portalOnboardingCandidateHasStableIdentity(waitingJob({ auth_user_id: userId }), profile, userId), false)
})

test('new Auth user retains invitation and confirmation flow', async () => {
  const f = fixture({ newUser: true, authUser: { email_confirmed_at: null, confirmed_at: null } })
  assert.equal((await onboarding.ensureCustomerPortalOnboarding(input)).status, 'email_confirmation_sent')
  assert.equal(f.invites, 1)
  assert.equal(f.tables.portal_onboarding_jobs[0].auth_user_id, userId)
  assert.equal(f.syncs.length, 0)
  assert.equal(f.resets + f.generatedLinks, 0)
})

test('ordinary login respects scheduled retry and preserves prior attempts when the job becomes due', async () => {
  const f = fixture()
  const future = new Date(Date.now() + 60 * 60_000).toISOString()
  const job = waitingJob({ auth_user_id: userId, status: 'retryable_failure', attempt_count: 8,
    next_attempt_at: future, last_error: 'Earlier failure' })
  f.tables.portal_onboarding_jobs.push(job)
  const enqueue = () => resume.resumePortalOnboardingForConfirmedUserSafely({ userId, email })
  let authReads = 0
  f.onAuthRead = () => { authReads++ }
  for (let attempt = 0; attempt < 2; attempt++) assert.equal((await enqueue()).processed, 0)
  assert.equal((await onboarding.processPortalOnboardingJobs()).processed, 0)
  assert.equal(authReads, 0)
  assert.equal(job.attempt_count, 8)
  assert.equal(job.next_attempt_at, future)
  assert.equal(job.last_error, 'Earlier failure')
  assert.equal(f.writes.length, 0)

  job.next_attempt_at = '2026-01-01T00:00:00Z'
  f.onAuthRead = () => { authReads++; throw new Error('Temporary Auth failure') }
  assert.equal((await enqueue()).processed, 1)
  assert.equal(job.attempt_count, 9)
  assert.equal(job.status, 'retryable_failure')
  assert.equal(authReads, 1)
  assert.equal((await enqueue()).processed, 0)
  job.attempt_count = job.max_attempts
  job.next_attempt_at = '2026-01-01T00:00:00Z'
  assert.equal((await enqueue()).processed, 0)
  assert.equal((await onboarding.processPortalOnboardingJobs()).failed, 1)
  assert.equal(job.status, 'manual_review')
  assert.equal(authReads, 1)
})

test('a failed first reservation leaves that job retryable and lets the second job finish', async () => {
  const f = fixture()
  const due = '2026-01-01T00:00:00Z'
  const first = waitingJob({ auth_user_id: userId, next_attempt_at: due, last_error: null })
  const second = waitingJob({ id: 'job-2', submission_attempt_id: 'submission-2', auth_user_id: userId,
    next_attempt_at: due, last_error: null })
  second.payload.submissionAttemptId = 'submission-2'
  f.tables.portal_onboarding_jobs.push(first, second)
  f.rejectUpdate = (table, row, patch) => table === 'portal_onboarding_jobs' &&
    row.id === first.id && patch?.status === 'processing'
  const result = await onboarding.processPortalOnboardingJobs()
  assert.deepEqual(result, { processed: 2, completed: 1, pending: 0, failed: 1 })
  assert.equal(first.status, 'pending')
  assert.equal(first.locked_at, null)
  assert.equal(first.attempt_count, 0)
  assert.equal(second.status, 'completed')
})

test('reading a completed checkout never recovers an unrelated stale lock', async () => {
  const f = fixture()
  const complete = waitingJob({ status: 'completed', auth_user_id: userId })
  const unrelated = waitingJob({ id: 'job-2', submission_attempt_id: 'submission-2',
    status: 'processing', attempt_count: 1, locked_at: '2026-01-01T00:00:00Z' })
  f.tables.portal_onboarding_jobs.push(complete, unrelated)
  assert.equal((await onboarding.ensureCustomerPortalOnboarding(input)).status, 'profile_linked')
  assert.equal(unrelated.status, 'processing')
  assert.equal(unrelated.locked_at, '2026-01-01T00:00:00Z')
  assert.equal(f.writes.length, 0)
  await onboarding.processPortalOnboardingJobs()
  assert.ok(f.writes.some(write => write.id === unrelated.id && write.patch.status === 'retryable_failure'))
})

test('independent activation runs during a blocked Auth call while the same customer stays queued', { timeout: 3000 }, async () => {
  const f = fixture()
  const due = '2026-01-01T00:00:00Z'
  const first = waitingJob({ auth_user_id: userId, next_attempt_at: due, last_error: null })
  const related = waitingJob({ id: 'job-2', submission_attempt_id: 'submission-2', auth_user_id: userId,
    next_attempt_at: due, last_error: null })
  related.payload.submissionAttemptId = 'submission-2'
  const anotherEmail = 'independent@example.test'
  const independent = waitingJob({ id: 'job-3', submission_attempt_id: 'submission-3', auth_user_id: otherId,
    email: anotherEmail, next_attempt_at: due, last_error: null })
  Object.assign(independent.payload, { email: anotherEmail, submissionAttemptId: 'submission-3' })
  Object.assign(independent.payload.application, { external_customer_id: 'customer-2', customer_number: 'C-2002' })
  f.tables.portal_onboarding_jobs.push(first, related, independent)
  let release
  const blocked = new Promise(resolve => { release = resolve })
  let notifyIndependent
  const started = new Promise(resolve => { notifyIndependent = resolve })
  let firstAuthReads = 0
  f.auth.admin.getUserById = async id => {
    if (id === userId && firstAuthReads++ === 0) await blocked
    if (id === otherId) notifyIndependent()
    return { data: { user: { id, email: id === otherId ? anotherEmail : email, email_confirmed_at: '2026-10-01T00:00:00Z' } }, error: null }
  }
  const batch = onboarding.processPortalOnboardingJobs()
  try {
    await started
    assert.equal(first.status, 'processing')
    assert.equal(independent.status, 'processing')
    assert.equal(related.status, 'pending')
    assert.equal(related.attempt_count, 0)
  } finally {
    release()
  }
  assert.deepEqual(await batch, { processed: 3, completed: 3, pending: 0, failed: 0 })
  assert.deepEqual(f.writes.filter(write => write.patch.status === 'processing').map(write => write.id), ['job-1', 'job-3', 'job-2'])
})

test('activation schedule picks up a short retry within one cron interval and reports claim lag', async t => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
  const cron = config.crons.find(item => item.path === '/api/internal/customer-portal/onboarding/process')
  assert.equal(cron.schedule, '*/5 * * * *')

  const NativeDate = globalThis.Date
  const originalInfo = console.info
  const minute = 60_000
  const previousStart = Date.parse('2026-11-22T09:10:00Z')
  const due = previousStart + 5 * minute + 8_000
  let clock = previousStart + 5 * minute
  const metrics = []
  globalThis.Date = class extends NativeDate {
    constructor(...args) { super(...(args.length ? args : [clock])) }
    static now() { return clock }
  }
  console.info = (...args) => metrics.push(args)
  t.after(() => { globalThis.Date = NativeDate; console.info = originalInfo })

  const f = fixture()
  const job = waitingJob({ auth_user_id: userId, status: 'retryable_failure', attempt_count: 1,
    next_attempt_at: new Date(due).toISOString(), last_error: 'Synthetic temporary failure' })
  f.tables.portal_onboarding_jobs.push(job)

  assert.equal((await onboarding.processPortalOnboardingJobs()).processed, 0)
  assert.equal(job.attempt_count, 1)
  clock += 5 * minute
  assert.equal((await onboarding.processPortalOnboardingJobs()).completed, 1)
  assert.equal(job.attempt_count, 2)
  const claims = f.writes.filter(write => write.patch.status === 'processing')
  assert.equal(claims.length, 1)
  assert.equal(Date.parse(claims[0].patch.locked_at) - due, 292_000)
  assert.deepEqual(metrics, [['[customer portal onboarding] retry delay', { retriesStarted: 1, maxRetryLagMs: 292_000 }]])
})
