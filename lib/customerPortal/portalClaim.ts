import { submitOpsCustomerPortalSync, isOpsError, OpsError } from '@/lib/ops/client'
import { assertPortalOnboardingAuthUserEligible, type PortalOnboardingInput } from '@/lib/customerPortal/onboarding'
import { stablePortalCustomerIdentityConflicts, writePortalProfileWithStableIdentity } from '@/lib/customerPortal/stableIdentity'
import { supabaseService } from '@/lib/supabase/service'
import { readWebsiteApplicationResultState } from '@/lib/website/applicationResultStore'

type SubmissionProofRow = {
  submission_attempt_id: string
  user_id: string | null
  status: string
  external_customer_id: string
  ops_customer_number: string | null
  ops_application_number: string | null
}

type PortalClaimJob = {
  id: string
  submission_attempt_id: string
  status: 'pending' | 'processing' | 'completed' | 'retryable_failure' | 'manual_review'
  email: string
  auth_user_id: string | null
  customer_number: string | null
  external_customer_id: string | null
  payload: PortalOnboardingInput
  attempt_count: number
  max_attempts: number
  locked_at: string | null
}

export type PortalClaimResult = {
  status: 'linked' | 'pending' | 'blocked' | 'invalid'
  message?: string
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

function isUuid(value: string | null | undefined): value is string {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value),
  )
}

function syncedText(row: Record<string, unknown> | null | undefined, keys: string[]): string | null {
  if (!row) return null
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function fullName(input: PortalOnboardingInput): string | null {
  if (input.customerType === 'business') return input.companyName?.trim() || null
  return [input.firstName, input.lastName].filter(Boolean).join(' ').trim() || null
}

async function markJob(
  job: PortalClaimJob,
  patch: Record<string, unknown>,
): Promise<boolean> {
  let update = supabaseService
    .from('portal_onboarding_jobs')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', job.id)
    .eq('status', job.status)
    .eq('attempt_count', job.attempt_count)
  update = job.locked_at ? update.eq('locked_at', job.locked_at) : update.is('locked_at', null)
  update = job.auth_user_id ? update.eq('auth_user_id', job.auth_user_id) : update.is('auth_user_id', null)
  const { data, error } = await update.select('id').maybeSingle()
  if (error) throw new Error(`Portal claim job update failed: ${error.message}`)
  return Boolean(data)
}

async function blockJob(job: PortalClaimJob, reason: string): Promise<PortalClaimResult> {
  if (job.status !== 'completed') {
    const updated = await markJob(job, {
      status: 'manual_review',
      last_error: reason,
      next_attempt_at: null,
      locked_at: null,
    })
    if (!updated) return { status: 'pending', message: 'onboarding_job_processing_claim_lost' }
  }
  return { status: 'blocked', message: reason }
}

async function profileConflicts(userId: string, application: PortalOnboardingInput['application']): Promise<boolean> {
  const { data: profile, error } = await supabaseService
    .from('customer_profiles')
    .select('external_customer_id,customer_number,contract_customer_ref')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new Error('Portal claim identity verification failed: ' + error.message)
  return Boolean(profile && stablePortalCustomerIdentityConflicts(profile, application))
}

async function stillOwnsClaim(job: PortalClaimJob): Promise<boolean> {
  if (!job.auth_user_id) return false
  const { data, error } = await supabaseService
    .from('portal_onboarding_jobs')
    .select('id')
    .eq('id', job.id)
    .eq('status', 'processing')
    .eq('attempt_count', job.attempt_count)
    .eq('locked_at', job.locked_at)
    .eq('auth_user_id', job.auth_user_id)
    .maybeSingle()
  if (error) throw new Error('Portal claim lock verification failed: ' + error.message)
  return Boolean(data)
}

async function upsertClaimedPortalRows(
  input: PortalOnboardingInput,
  userId: string,
  portalIdentityId: string | null,
  assertClaim: () => Promise<void>,
): Promise<void> {
  const app = input.application
  await writePortalProfileWithStableIdentity(supabaseService, userId, app, {
    user_id: userId,
    email: normalizeEmail(input.email),
    first_name: input.firstName ?? null,
    last_name: input.lastName ?? null,
    full_name: fullName(input),
    phone: input.phone ?? null,
    onboarding_state: 'verified',
    billing_customer_ref: app.customer_number ?? app.customer_reference ?? null,
    contract_customer_ref: app.customer_number ?? app.external_customer_id ?? null,
    external_identity_ref: app.external_customer_id ?? app.customer_reference ?? null,
    customer_number: app.customer_number ?? null,
    external_customer_id: app.external_customer_id ?? null,
    portal_identity_id: portalIdentityId ?? userId,
    customer_type: input.customerType,
    company_name: input.companyName ?? null,
    metadata: {
      source: 'verified_checkout_portal_claim',
      submission_attempt_id: input.submissionAttemptId,
      application_number: app.application_number ?? null,
      contract_reference: app.contract_reference ?? null,
      customer_reference: app.customer_reference ?? null,
    },
  }, assertClaim)

  const contractExternalReference = app.contract_reference ?? app.contract_number ?? null
  if (contractExternalReference) {
    await assertClaim()
    const { error } = await supabaseService.from('customer_contract_portal_links').upsert(
      [{
        user_id: userId,
        agreement_id: isUuid(app.contract_id) ? app.contract_id : undefined,
        contract_slug: input.productCode ?? input.offerReference,
        contract_name: input.contractName ?? input.productCode ?? 'Elavtal',
        status: app.contract_status ?? app.status,
        signed_at: app.signed_at ?? undefined,
        billing_customer_ref: app.customer_number ?? null,
        contract_provider_key: 'ops',
        contract_external_ref: contractExternalReference,
        pricing_snapshot: {
          offer_reference: app.offer_reference ?? input.offerReference,
          quote_reference: app.quote_reference ?? null,
          quote_valid_until: app.quote_valid_until ?? null,
        },
        metadata: {
          source: 'verified_checkout_portal_claim',
          submission_attempt_id: input.submissionAttemptId,
          application_number: app.application_number ?? null,
          customer_number: app.customer_number ?? null,
        },
      }],
      { onConflict: 'user_id,contract_provider_key,contract_external_ref', defaultToNull: false },
    )
    if (error) throw new Error(`Portal claim contract link upsert failed: ${error.message}`)
  }

  const facilityReference = input.facilityId ?? app.facility_reference ?? null
  if (facilityReference) {
    await assertClaim()
    const { error } = await supabaseService.from('customer_delivery_points').upsert(
      {
        user_id: userId,
        facility_id: facilityReference,
        address: input.address ?? null,
        postal_code: input.postalCode ?? null,
        city: input.city ?? null,
        external_metering_ref: input.meteringPointId ?? app.metering_point_reference ?? null,
        metadata: {
          source: 'verified_checkout_portal_claim',
          submission_attempt_id: input.submissionAttemptId,
        },
        is_primary: true,
      },
      { onConflict: 'user_id,facility_id' },
    )
    if (error) throw new Error(`Portal claim delivery point upsert failed: ${error.message}`)
  }
}

/**
 * Links exactly one accepted anonymous checkout to an already authenticated Gridex
 * account. Email is not sufficient proof: the encrypted checkout result, durable
 * submission, onboarding job and canonical OPS customer identifiers must all agree.
 */
export async function resumePortalOnboardingFromResultProof(input: {
  userId: string
  email: string | null
  resultToken: string
}): Promise<PortalClaimResult> {
  if (!input.email) return { status: 'invalid', message: 'authenticated_email_missing' }

  const resultState = await readWebsiteApplicationResultState(input.resultToken)
  if (
    resultState.status !== 'verified' ||
    !resultState.submissionAttemptId ||
    !resultState.result.customerNumber
  ) {
    return { status: 'invalid', message: 'invalid_or_expired_checkout_result' }
  }
  if (resultState.userId && resultState.userId !== input.userId) {
    return { status: 'blocked', message: 'checkout_result_bound_to_other_user' }
  }

  const submissionAttemptId = resultState.submissionAttemptId
  const { data: submissionData, error: submissionError } = await supabaseService
    .from('website_application_submissions')
    .select('submission_attempt_id,user_id,status,external_customer_id,ops_customer_number,ops_application_number')
    .eq('submission_attempt_id', submissionAttemptId)
    .maybeSingle()
  if (submissionError) throw new Error(`Portal claim submission read failed: ${submissionError.message}`)
  const submission = (submissionData ?? null) as SubmissionProofRow | null
  if (!submission || submission.status !== 'accepted') {
    return { status: 'invalid', message: 'accepted_submission_missing' }
  }
  if (submission.user_id && submission.user_id !== input.userId) {
    return { status: 'blocked', message: 'submission_bound_to_other_user' }
  }
  if (
    !submission.external_customer_id ||
    !submission.ops_customer_number ||
    submission.ops_customer_number !== resultState.result.customerNumber
  ) {
    return { status: 'blocked', message: 'submission_customer_identity_mismatch' }
  }

  const { data: jobData, error: jobError } = await supabaseService
    .from('portal_onboarding_jobs')
    .select('id,submission_attempt_id,status,email,auth_user_id,customer_number,external_customer_id,payload,attempt_count,max_attempts,locked_at')
    .eq('submission_attempt_id', submissionAttemptId)
    .maybeSingle()
  if (jobError) throw new Error(`Portal claim onboarding read failed: ${jobError.message}`)
  const job = (jobData ?? null) as PortalClaimJob | null
  if (!job) return { status: 'pending', message: 'onboarding_job_not_ready' }

  if (job.status === 'completed') {
    return job.auth_user_id === input.userId
      ? { status: 'linked' }
      : { status: 'blocked', message: 'completed_job_bound_to_other_user' }
  }
  if (job.status === 'processing') return { status: 'pending', message: 'onboarding_job_already_processing' }

  const email = normalizeEmail(input.email)
  const payloadEmail = normalizeEmail(job.payload.email)
  const payloadExternal = job.payload.application.external_customer_id?.trim() || null
  const payloadCustomerNumber = job.payload.application.customer_number?.trim() || null
  if (normalizeEmail(job.email) !== email || payloadEmail !== email) {
    return blockJob(job, 'authenticated_email_does_not_match_checkout')
  }
  if (job.auth_user_id && job.auth_user_id !== input.userId) {
    return blockJob(job, 'onboarding_job_bound_to_other_user')
  }
  if (
    job.external_customer_id !== submission.external_customer_id ||
    payloadExternal !== submission.external_customer_id ||
    job.customer_number !== submission.ops_customer_number ||
    payloadCustomerNumber !== submission.ops_customer_number
  ) {
    return blockJob(job, 'onboarding_stable_identity_mismatch')
  }
  if (await profileConflicts(input.userId, job.payload.application)) {
    return blockJob(job, 'existing_profile_stable_identity_conflict')
  }

  const attempt = job.attempt_count + 1
  const lockedAt = new Date().toISOString()
  const payload = { ...job.payload, authenticatedUserId: input.userId }
  let claimQuery = supabaseService
    .from('portal_onboarding_jobs')
    .update({
      auth_user_id: input.userId,
      payload,
      status: 'processing',
      attempt_count: attempt,
      next_attempt_at: null,
      last_error: null,
      locked_at: lockedAt,
      updated_at: lockedAt,
    })
    .eq('id', job.id)
    .eq('attempt_count', job.attempt_count)
    .eq('status', job.status)
    .is('locked_at', null)
    .in('status', ['pending', 'retryable_failure', 'manual_review'])
    .eq('email', job.email)
    .eq('external_customer_id', job.external_customer_id)
    .eq('customer_number', job.customer_number)
  claimQuery = job.auth_user_id ? claimQuery.eq('auth_user_id', job.auth_user_id) : claimQuery.is('auth_user_id', null)
  const { data: claimedData, error: claimError } = await claimQuery
    .select('id')
    .maybeSingle()
  if (claimError) throw new Error(`Portal claim processing lock failed: ${claimError.message}`)
  if (!claimedData) return { status: 'pending', message: 'onboarding_job_already_processing' }
  const claimedJob: PortalClaimJob = { ...job, payload, auth_user_id: input.userId, status: 'processing', attempt_count: attempt, locked_at: lockedAt }

  try {
    const { data: authData, error: authError } = await supabaseService.auth.admin.getUserById(input.userId)
    if (authError) throw new OpsError('Kundkontot kunde inte verifieras.', authError.status === 404 ? 403 : 503, {
      code: 'portal_claim_auth_verification_failed', retryable: authError.status !== 404,
    })
    assertPortalOnboardingAuthUserEligible(input.userId, authData.user)
    if (!authData.user.email_confirmed_at && !authData.user.confirmed_at) {
      return blockJob(claimedJob, 'authenticated_email_not_confirmed')
    }
    if (normalizeEmail(authData.user.email ?? '') !== email) {
      return blockJob(claimedJob, 'auth_user_email_mismatch')
    }

    if (!await stillOwnsClaim(claimedJob)) return { status: 'pending', message: 'onboarding_job_processing_claim_lost' }
    const sync = await submitOpsCustomerPortalSync({
      identity: {
        userId: input.userId,
        email,
        customerNumber: submission.ops_customer_number,
        externalCustomerId: submission.external_customer_id,
      },
      idempotencyKey: submissionAttemptId,
      customerNumber: submission.ops_customer_number,
      externalCustomerId: submission.external_customer_id,
      email,
      metadata: {
        source: 'verified_checkout_portal_claim',
        submission_attempt_id: submissionAttemptId,
        application_number: submission.ops_application_number,
      },
    })

    const accessGranted = sync.synced?.access_granted === true
    const portalRole = syncedText(sync.synced, ['portal_role', 'role'])
    if (sync.status !== 'linked' || !accessGranted || portalRole !== 'owner') {
      throw new Error(
        `OPS portal claim invariant failed: status=${sync.status ?? 'missing'}, access_granted=${String(accessGranted)}, portal_role=${portalRole ?? 'missing'}`,
      )
    }

    const portalIdentityId = syncedText(sync.synced, ['identity_id', 'portal_identity_id', 'customer_portal_user_id'])
    if (!await stillOwnsClaim(claimedJob)) return { status: 'pending', message: 'onboarding_job_processing_claim_lost' }
    await upsertClaimedPortalRows(payload, input.userId, portalIdentityId, async () => {
      if (!await stillOwnsClaim(claimedJob)) throw new Error('onboarding_job_processing_claim_lost')
    })
    const completed = await markJob(claimedJob, {
      status: 'completed',
      auth_user_id: input.userId,
      payload,
      last_error: null,
      next_attempt_at: null,
      locked_at: null,
      completed_at: new Date().toISOString(),
    })
    if (!completed) return { status: 'pending', message: 'onboarding_job_processing_claim_lost' }
    return { status: 'linked' }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const exhausted = (isOpsError(error) && !error.retryable) || attempt >= job.max_attempts
    await markJob(claimedJob, {
      status: exhausted ? 'manual_review' : 'retryable_failure',
      last_error: message.slice(0, 2000),
      next_attempt_at: exhausted ? null : new Date(Date.now() + 5 * 60_000).toISOString(),
      locked_at: null,
    }).catch((persistError) => console.error('[portal claim] failed to persist failure state', persistError))
    console.error('[portal claim] verified result claim failed', error)
    return { status: exhausted ? 'blocked' : 'pending', message: 'portal_claim_sync_failed' }
  }
}
