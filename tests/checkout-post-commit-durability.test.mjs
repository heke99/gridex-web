import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const signup = read('app/(public)/teckna-avtal/page.tsx')
const thanks = read('app/(public)/teckna-avtal/tack/SignupThanksPage.tsx')
const client = [
  read('lib/ops/client.ts'),
  read('lib/ops/client/types.ts'),
  read('lib/ops/client/core.ts'),
  read('lib/ops/client/website.ts'),
  read('lib/ops/client/application.ts'),
  read('lib/ops/client/portal.ts'),
].join('\n')
const resultStore = read('lib/website/applicationResultStore.ts')
const submissionStore = read('lib/website/submissionStore.ts')
const onboarding = read('lib/customerPortal/onboarding.ts')
const authConfirm = read('app/auth/confirm/route.ts')
const authSync = read('lib/customerPortal/authProfileSync.ts')
const webhook = read('app/webhooks/gridex/route.ts')
const webhookParser = read('lib/webhooks/opsWebhook.ts')
const migration = read('supabase/migrations/20260803173000_checkout_post_commit_reconciliation.sql')
const manifest = JSON.parse(read('supabase/migrations/manifest.json'))
const databaseVerification = read('scripts/verify-gridex-web-database.sql')

assert.ok(client.includes("if (!status)"), 'OPS status must be mandatory')
assert.ok(!client.includes("status: pickString(row, ['status']) ?? 'application_received'"))
for (const invariant of [
  "result.status !== 'accepted'",
  'ops_application_number_missing',
  'ops_customer_number_missing',
  'ops_contract_not_signed',
  'ops_signature_evidence_invalid',
  'ops_workflow_not_committed',
  'communication_logs',
]) assert.ok(client.includes(invariant), `missing accepted invariant: ${invariant}`)
assert.ok(!/continuation_job_id_missing/.test(client), 'must not require a field absent from immutable OpenAPI')
assert.ok(client.includes("request_reference: pickString(row, ['request_reference', 'request_id'])"))
assert.ok(client.includes("if (code !== 'duplicate_application') throw error"))

const opsSubmit = signup.indexOf('result = await submitApplicationToOps()')
const opsCatch = signup.indexOf('} catch (error) {', opsSubmit)
const acceptedUpdate = signup.indexOf('const acceptedSubmissionUpdate', opsCatch)
assert.ok(opsSubmit > 0 && opsCatch > opsSubmit && acceptedUpdate > opsCatch)
assert.equal(
  signup.slice(opsSubmit, opsCatch).includes('updateWebsiteSubmission({'),
  false,
  'local persistence must not share the OPS success try/catch',
)
assert.ok(signup.includes('queueWebsiteSubmissionReconciliation(acceptedSubmissionUpdate, reason)'))
assert.ok(signup.includes('application_business_conflict'))
assert.ok(signup.includes('result.supplier_switch.request_reference'))
assert.ok(signup.indexOf('return redirect(`/teckna-avtal/tack?result=') > signup.indexOf('createWebsiteApplicationResult({'))

assert.ok(thanks.includes("if (resultState.status !== 'verified')"))
assert.ok(thanks.includes('<UnverifiedResult state={resultState.status} />'))
assert.ok(!thanks.includes("stored?.status ?? 'application_received'"))
assert.ok(thanks.includes('Vi visar därför inte att en teckning har lyckats'))

for (const marker of [
  "const TOKEN_VERSION = 'wr1'",
  "createCipheriv('aes-256-gcm'",
  'WEBSITE_RESULT_TOKEN_SECRET',
  "source: 'stateless'",
  "onConflict: 'submission_attempt_id'",
  'stateless result projection repair failed',
  'signatureSnapshotSha256',
]) assert.ok(resultStore.includes(marker), `missing result-token marker: ${marker}`)
assert.ok(!resultStore.includes("env('SUPABASE_SERVICE_ROLE_KEY') ??"))

assert.ok(submissionStore.includes(".select('submission_attempt_id')"))
assert.ok(submissionStore.includes('submission row not found'))
assert.ok(
  submissionStore.includes("existing.status === 'accepted' && input.status !== 'accepted'"),
  'a retry or late failure must never downgrade a locally accepted OPS application',
)
assert.ok(
  submissionStore.includes('if (value !== undefined) patch[column] = value'),
  'partial submission updates must only mutate explicitly supplied fields',
)
assert.equal(
  submissionStore.includes('ops_application_number: input.opsApplicationNumber ?? null'),
  false,
  'partial failed/submitting updates must not erase the accepted application number',
)
assert.equal(
  submissionStore.includes('ops_result_snapshot: input.opsResultSnapshot ?? null'),
  false,
  'partial failed/submitting updates must not erase the accepted OPS result snapshot',
)
for (const marker of [
  'website_submission_reconciliation_jobs',
  'claimWebsiteSubmissionReconciliationJob',
  'recoverStaleWebsiteSubmissionReconciliationJobs',
  "status: 'processing'",
  "status: exhausted ? 'manual_review' : 'retryable_failure'",
]) assert.ok(submissionStore.includes(marker), `missing submission reconciliation marker: ${marker}`)

for (const marker of [
  'portal_onboarding_jobs',
  'recoverStalePortalOnboardingJobs',
  'updateClaimedJob',
  "sync.status !== 'linked'",
  "portalRole !== 'owner'",
  'inviteUserByEmail',
  'isExistingAuthUserInviteError',
  'attempt_count: 0',
]) assert.ok(onboarding.includes(marker), `missing portal onboarding marker: ${marker}`)
assert.ok(onboarding.includes("onConflict: 'user_id,contract_provider_key,contract_external_ref'"))

assert.ok(!authConfirm.includes('Promise.allSettled'))
assert.ok(authConfirm.includes('syncConfirmedUserProfileDurably'))
assert.ok(authConfirm.includes('resumePortalOnboardingForConfirmedUser'))
for (const marker of [
  'auth_profile_sync_jobs',
  'recoverStaleAuthProfileSyncJobs',
  'updateClaimedJob',
  'defaultToNull: false',
]) assert.ok(authSync.includes(marker), `missing auth sync marker: ${marker}`)

for (const marker of [
  'verifyOpsWebhookSignature',
  'getVerifiedOpsIntegrationContext',
  "rpc('apply_ops_domain_event_v2'",
  'webhook_identity_mismatch',
  'webhook_organization_mismatch',
]) assert.ok(webhook.includes(marker), `missing webhook marker: ${marker}`)
assert.ok(webhookParser.includes('Number.isNaN(Date.parse(occurredAt))'))
assert.ok(webhookParser.includes('customer.customer_reference'))
assert.ok(webhookParser.includes('aggregate.reference'))

for (const marker of [
  'website_application_results_submission_attempt_uidx',
  'customer_contract_portal_links_provider_reference_uidx',
  'website_submission_reconciliation_jobs',
  'portal_onboarding_jobs',
  'auth_profile_sync_jobs',
  'locked_at timestamptz',
  'enable row level security',
  'revoke all on table',
]) assert.ok(migration.includes(marker), `missing migration marker: ${marker}`)

assert.ok(
  manifest.migrations.some((entry) => entry.file === '20260803173000_checkout_post_commit_reconciliation.sql'),
  'migration manifest must include checkout reconciliation migration',
)
assert.ok(databaseVerification.includes('Gridex Web database is incomplete'))
assert.ok(databaseVerification.includes('apply_ops_domain_event'))

console.log('Checkout post-commit durability checks passed')