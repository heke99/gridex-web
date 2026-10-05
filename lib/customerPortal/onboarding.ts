import type { User } from '@supabase/supabase-js'
import {
  submitOpsCustomerPortalSync,
  isOpsError,
  OpsError,
  type OpsCustomerApplicationResult,
} from '@/lib/ops/client'
import { stablePortalCustomerIdentityConflicts, stablePortalCustomerIdentityMatches, writePortalProfileWithStableIdentity } from '@/lib/customerPortal/stableIdentity'

type SupabaseServiceClient = Awaited<typeof import('@/lib/supabase/service')>['supabaseService']

type PortalOnboardingStatus =
  | 'email_confirmation_sent'
  | 'invite_sent'
  | 'profile_linked'
  | 'pending'
  | 'failed'
  | 'skipped'

export type PortalOnboardingResult = {
  status: PortalOnboardingStatus
  userId?: string | null
  message?: string | null
}

export type PortalOnboardingInput = {
  submissionAttemptId: string
  application: OpsCustomerApplicationResult
  email: string
  firstName?: string | null
  lastName?: string | null
  companyName?: string | null
  phone?: string | null
  customerType: 'private' | 'business'
  address?: string | null
  postalCode?: string | null
  city?: string | null
  facilityId?: string | null
  meteringPointId?: string | null
  offerReference: string
  productCode?: string | null
  contractName?: string | null
  authenticatedUserId?: string | null
}

type ExistingProfile = {
  user_id: string
  email: string | null
  customer_number: string | null
  contract_customer_ref: string | null
  external_customer_id: string | null
}

type PortalOnboardingJob = {
  id: string
  submission_attempt_id: string
  status: 'pending' | 'processing' | 'completed' | 'retryable_failure' | 'manual_review'
  email: string
  auth_user_id: string | null
  payload: PortalOnboardingInput
  attempt_count: number
  max_attempts: number
  next_attempt_at: string | null
  last_error: string | null
  locked_at: string | null
}

const JOB_COLUMNS = 'id,submission_attempt_id,status,email,auth_user_id,payload,attempt_count,max_attempts,next_attempt_at,last_error,locked_at'
const EXISTING_ACCOUNT_MESSAGE = 'Ett konto finns redan för e-postadressen. Logga in för att koppla den här teckningen till Mina sidor. Välj själv återställning av lösenord om du behöver en ny inloggningslänk.'

function waitingForExistingAccount(job: PortalOnboardingJob): boolean {
  return job.next_attempt_at === null && job.last_error === 'existing_auth_user_requires_login' &&
    (job.status === 'pending' || job.status === 'manual_review')
}

function env(name: string): string | null {
  const value = process.env[name]?.trim()
  return value ? value : null
}

function siteUrl(): string {
  return env('NEXT_PUBLIC_SITE_URL') ?? 'https://gridex.se'
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

function fullName(input: PortalOnboardingInput): string | null {
  if (input.customerType === 'business') return input.companyName?.trim() || null
  return [input.firstName, input.lastName].filter(Boolean).join(' ').trim() || null
}

function isUuid(value: string | null | undefined): value is string {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value),
  )
}

function authRedirectTo(): string {
  const next = encodeURIComponent('/login/reset-password')
  return `${siteUrl()}/auth/confirm?next=${next}`
}

async function loadServiceClient(): Promise<SupabaseServiceClient> {
  const { supabaseService } = await import('@/lib/supabase/service')
  return supabaseService
}

async function findSafelyLinkedProfile(
  supabase: SupabaseServiceClient,
  input: PortalOnboardingInput,
): Promise<ExistingProfile | null> {
  const { data, error } = await supabase
    .from('customer_profiles')
    .select('user_id,email,customer_number,contract_customer_ref,external_customer_id')
    .eq('email', normalizeEmail(input.email))
    .limit(3)
    .returns<ExistingProfile[]>()
  if (error) throw new Error(error.message)
  const rows = data ?? []
  if (rows.length !== 1) return null
  return stablePortalCustomerIdentityMatches(rows[0], input.application) ? rows[0] : null
}

export function assertPortalOnboardingAuthUserEligible(userId: string, authUser: User | null): asserts authUser is User {
  const user = authUser as (User & { deleted_at?: string | null; banned_until?: string | null }) | null
  if (!user || user.id !== userId || user.deleted_at ||
    (user.banned_until && (!Number.isFinite(Date.parse(user.banned_until)) || Date.parse(user.banned_until) > Date.now()))) {
    throw new OpsError('Kundkontot kan inte verifieras för Mina sidor.', 403, {
      code: 'portal_onboarding_auth_user_ineligible', retryable: false,
    })
  }
}

async function assertProfileCompatible(supabase: SupabaseServiceClient, userId: string, input: PortalOnboardingInput) {
  const { data: profile, error } = await supabase
    .from('customer_profiles')
    .select('user_id,email,customer_number,contract_customer_ref,external_customer_id')
    .eq('user_id', userId)
    .maybeSingle<ExistingProfile>()
  if (error) throw new Error('Portal identity verification failed: ' + error.message)
  if (profile && stablePortalCustomerIdentityConflicts(profile, input.application)) {
    throw new OpsError('Kundkopplingen behöver verifieras av kundservice.', 409, {
      code: 'portal_onboarding_stable_identity_conflict', retryable: false,
    })
  }
}

function profilePayload(
  input: PortalOnboardingInput,
  userId: string,
  onboardingState: 'portal_email_confirmation_sent' | 'portal_existing_customer_linked' | 'verified',
  portalIdentityId?: string | null,
) {
  const app = input.application
  return {
    user_id: userId,
    email: normalizeEmail(input.email),
    first_name: input.firstName ?? null,
    last_name: input.lastName ?? null,
    full_name: fullName(input),
    phone: input.phone ?? null,
    onboarding_state: onboardingState,
    billing_customer_ref: app.customer_number ?? app.customer_reference ?? null,
    contract_customer_ref: app.customer_number ?? app.external_customer_id ?? null,
    external_identity_ref: app.external_customer_id ?? app.customer_reference ?? null,
    customer_number: app.customer_number ?? null,
    external_customer_id: app.external_customer_id ?? null,
    portal_identity_id: portalIdentityId ?? undefined,
    customer_type: input.customerType,
    company_name: input.companyName ?? null,
    metadata: {
      source: 'ops_application_onboarding',
      submission_attempt_id: input.submissionAttemptId,
      customer_reference: app.customer_reference ?? null,
      application_number: app.application_number ?? null,
      application_reference: app.application_reference ?? null,
      contract_reference: app.contract_reference ?? null,
      contract_number: app.contract_number ?? null,
      facility_reference: app.facility_reference ?? null,
      metering_point_reference: app.metering_point_reference ?? null,
      continuation_job_id: app.continuation_job_id ?? null,
      offer_reference: app.offer_reference ?? input.offerReference,
      status: app.status,
    },
  }
}

async function upsertLocalPortalRows(
  supabase: SupabaseServiceClient,
  input: PortalOnboardingInput,
  userId: string,
  onboardingState: 'portal_email_confirmation_sent' | 'portal_existing_customer_linked' | 'verified',
  portalIdentityId: string | null | undefined,
  assertClaim: () => Promise<void>,
) {
  await writePortalProfileWithStableIdentity(supabase, userId, input.application,
    profilePayload(input, userId, onboardingState, portalIdentityId), assertClaim)

  const contractExternalReference =
    input.application.contract_reference ?? input.application.contract_number ?? null
  if (contractExternalReference) {
    await assertClaim()
    const { error } = await supabase.from('customer_contract_portal_links').upsert(
      [{
        user_id: userId,
        agreement_id: isUuid(input.application.contract_id) ? input.application.contract_id : undefined,
        contract_slug: input.productCode ?? input.offerReference,
        contract_name: input.contractName ?? input.productCode ?? 'Elavtal',
        status: input.application.contract_status ?? input.application.status,
        signed_at: input.application.signed_at ?? undefined,
        billing_customer_ref: input.application.customer_number ?? null,
        contract_provider_key: 'ops',
        contract_external_ref: contractExternalReference,
        pricing_snapshot: {
          offer_reference: input.application.offer_reference ?? input.offerReference,
          quote_reference: input.application.quote_reference ?? null,
          quote_valid_until: input.application.quote_valid_until ?? null,
        },
        metadata: {
          source: 'ops_application_onboarding',
          submission_attempt_id: input.submissionAttemptId,
          application_number: input.application.application_number ?? null,
          application_reference: input.application.application_reference ?? null,
          contract_reference: input.application.contract_reference ?? null,
          customer_number: input.application.customer_number ?? null,
        },
      }],
      {
        onConflict: 'user_id,contract_provider_key,contract_external_ref',
        defaultToNull: false,
      },
    )
    if (error) throw new Error(`Portal contract link upsert failed: ${error.message}`)
  }

  const facilityReference = input.facilityId ?? input.application.facility_reference ?? null
  if (facilityReference) {
    await assertClaim()
    const { error } = await supabase.from('customer_delivery_points').upsert(
      {
        user_id: userId,
        facility_id: facilityReference,
        address: input.address ?? null,
        postal_code: input.postalCode ?? null,
        city: input.city ?? null,
        external_metering_ref:
          input.meteringPointId ?? input.application.metering_point_reference ?? null,
        metadata: {
          source: 'ops_application_onboarding',
          submission_attempt_id: input.submissionAttemptId,
          facility_reference: input.application.facility_reference ?? null,
          metering_point_reference: input.application.metering_point_reference ?? null,
        },
        is_primary: true,
      },
      { onConflict: 'user_id,facility_id' },
    )
    if (error) throw new Error(`Portal delivery point upsert failed: ${error.message}`)
  }
}

function confirmed(user: User | null | undefined): boolean {
  return Boolean(user?.email_confirmed_at || user?.confirmed_at)
}

function syncedText(row: Record<string, unknown> | null | undefined, keys: string[]): string | null {
  if (!row) return null
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

type PortalProcessingClaim = { attempt: number; lockedAt: string; authUserId: string | null }

async function assertWorkerClaim(
  supabase: SupabaseServiceClient,
  id: string,
  claim: PortalProcessingClaim,
): Promise<void> {
  let query = supabase.from('portal_onboarding_jobs').select('id')
    .eq('id', id).eq('status', 'processing')
    .eq('attempt_count', claim.attempt).eq('locked_at', claim.lockedAt)
  query = claim.authUserId ? query.eq('auth_user_id', claim.authUserId) : query.is('auth_user_id', null)
  const { data, error } = await query.maybeSingle<{ id: string }>()
  if (error) throw new Error('Portal onboarding claim verification failed: ' + error.message)
  if (!data) throw new Error('Portal onboarding processing claim was lost.')
}

async function updateClaimedJob(
  supabase: SupabaseServiceClient,
  id: string,
  claim: PortalProcessingClaim,
  patch: Record<string, unknown>,
): Promise<void> {
  let update = supabase
    .from('portal_onboarding_jobs')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'processing')
    .eq('attempt_count', claim.attempt)
    .eq('locked_at', claim.lockedAt)
  update = claim.authUserId ? update.eq('auth_user_id', claim.authUserId) : update.is('auth_user_id', null)
  const { data, error } = await update.select('id').maybeSingle<{ id: string }>()
  if (error) throw new Error(`Portal onboarding claimed update failed: ${error.message}`)
  if (!data) throw new Error('Portal onboarding processing claim was lost.')
  if ('auth_user_id' in patch) claim.authUserId = patch.auth_user_id as string | null
}

async function claimJob(
  supabase: SupabaseServiceClient,
  job: PortalOnboardingJob,
): Promise<PortalProcessingClaim | null> {
  const attempt = job.attempt_count + 1
  const lockedAt = new Date().toISOString()
  let update = supabase
    .from('portal_onboarding_jobs')
    .update({
      status: 'processing',
      attempt_count: attempt,
      locked_at: lockedAt,
      updated_at: lockedAt,
    })
    .eq('id', job.id)
    .eq('attempt_count', job.attempt_count)
    .eq('status', job.status)
    .in('status', ['pending', 'retryable_failure'])
  update = job.auth_user_id ? update.eq('auth_user_id', job.auth_user_id) : update.is('auth_user_id', null)
  const { data, error } = await update.select('id').maybeSingle<{ id: string }>()
  if (error) throw new Error(`Portal onboarding job claim failed: ${error.message}`)
  return data ? { attempt, lockedAt, authUserId: job.auth_user_id } : null
}

function retryAt(attempt: number): string {
  const minutes = Math.min(12 * 60, Math.max(5, 2 ** Math.min(attempt, 8)))
  return new Date(Date.now() + minutes * 60_000).toISOString()
}

async function queueJob(
  supabase: SupabaseServiceClient,
  input: PortalOnboardingInput,
): Promise<PortalOnboardingJob> {
  const { data: existing, error: readError } = await supabase
    .from('portal_onboarding_jobs')
    .select(JOB_COLUMNS)
    .eq('submission_attempt_id', input.submissionAttemptId)
    .maybeSingle<PortalOnboardingJob>()
  if (readError) throw new Error(`Portal onboarding job read failed: ${readError.message}`)
  if (existing && (normalizeEmail(existing.email) !== normalizeEmail(input.email) ||
    stablePortalCustomerIdentityConflicts(existing.payload.application, input.application) ||
    (existing.auth_user_id && input.authenticatedUserId && existing.auth_user_id !== input.authenticatedUserId))) {
    throw new OpsError('Teckningens kundkoppling stämmer inte med det väntande försöket.', 409, {
      code: 'portal_onboarding_job_identity_conflict', retryable: false,
    })
  }
  if (existing?.status === 'completed' || existing?.status === 'processing') return existing
  if (existing && (waitingForExistingAccount(existing) || existing.status === 'manual_review')) return existing

  const { data, error } = await supabase
    .from('portal_onboarding_jobs')
    .upsert(
      [{
        submission_attempt_id: input.submissionAttemptId,
        status: 'pending',
        application_number: input.application.application_number,
        customer_number: input.application.customer_number,
        external_customer_id: input.application.external_customer_id,
        email: normalizeEmail(input.email),
        auth_user_id: input.authenticatedUserId ?? existing?.auth_user_id ?? null,
        payload: input,
        attempt_count: existing?.attempt_count ?? 0,
        max_attempts: existing?.max_attempts ?? 10,
        next_attempt_at: new Date().toISOString(),
        last_error: null,
        locked_at: null,
      }],
      { onConflict: 'submission_attempt_id', defaultToNull: false },
    )
    .select(JOB_COLUMNS)
    .single<PortalOnboardingJob>()
  if (error || !data) throw new Error(`Portal onboarding job upsert failed: ${error?.message ?? 'missing row'}`)
  return data
}


async function recoverStalePortalOnboardingJobs(
  supabase: SupabaseServiceClient,
): Promise<void> {
  const cutoff = new Date(Date.now() - 15 * 60_000).toISOString()
  const { error } = await supabase
    .from('portal_onboarding_jobs')
    .update({
      status: 'retryable_failure',
      next_attempt_at: new Date().toISOString(),
      last_error: 'Recovered stale processing lock after worker interruption.',
      locked_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('status', 'processing')
    .lt('locked_at', cutoff)
  if (error) throw new Error(`Portal onboarding stale-lock recovery failed: ${error.message}`)
}


function isExistingAuthUserInviteError(error: { status?: number; message?: string; code?: string } | null): boolean {
  if (!error || error.status !== 422) return false
  return /already|registered|exists/i.test(`${error.code ?? ''} ${error.message ?? ''}`)
}

async function processJob(
  supabase: SupabaseServiceClient,
  job: PortalOnboardingJob,
): Promise<PortalOnboardingResult> {
  if (job.status === 'completed') return { status: 'profile_linked', userId: job.auth_user_id }
  if (waitingForExistingAccount(job)) return { status: 'pending', message: EXISTING_ACCOUNT_MESSAGE }
  if (job.status === 'manual_review') return { status: 'pending', message: 'Mina sidor-kopplingen behöver verifieras av kundservice.' }

  const input = job.payload
  const processingClaim = await claimJob(supabase, job)
  if (processingClaim === null) {
    return { status: 'pending', message: 'Portal onboarding is already being processed.' }
  }
  const { attempt } = processingClaim
  const assertClaim = () => assertWorkerClaim(supabase, job.id, processingClaim)

  try {
    if (input.authenticatedUserId && job.auth_user_id && input.authenticatedUserId !== job.auth_user_id) {
      throw new OpsError('Kundkontot stämmer inte med den väntande kopplingen.', 409, {
        code: 'portal_onboarding_auth_binding_conflict', retryable: false,
      })
    }
    let userId = input.authenticatedUserId?.trim() || job.auth_user_id

    if (!userId) {
      const safelyLinked = await findSafelyLinkedProfile(supabase, input)
      userId = safelyLinked?.user_id ?? null
    }

    if (!userId) {
      await assertClaim()
      const { data, error } = await supabase.auth.admin.inviteUserByEmail(normalizeEmail(input.email), {
        redirectTo: authRedirectTo(),
        data: {
          full_name: fullName(input),
          customer_number: input.application.customer_number ?? null,
          external_customer_id: input.application.external_customer_id ?? null,
          contract_number: input.application.contract_number ?? null,
          application_number: input.application.application_number ?? null,
          source: 'gridex_website_application',
        },
      })
      if (error) {
        if (!isExistingAuthUserInviteError(error)) {
          throw new Error(`Supabase invite failed: ${error.message}`)
        }
        // An invite collision authorizes neither recovery mail nor email-only
        // account binding. The customer uses the existing signed-result claim.
        await updateClaimedJob(supabase, job.id, processingClaim, {
          status: 'pending',
          attempt_count: Math.max(0, attempt - 1),
          last_error: 'existing_auth_user_requires_login',
          next_attempt_at: null,
          locked_at: null,
        })
        return {
          status: 'pending',
          message: EXISTING_ACCOUNT_MESSAGE,
        }
      }
      userId = data.user?.id ?? null
      if (!userId) throw new Error('Supabase invite returned no user id.')
      await updateClaimedJob(supabase, job.id, processingClaim, { auth_user_id: userId })
    }

    const { data: authData, error: authError } = await supabase.auth.admin.getUserById(userId)
    if (authError) throw new OpsError('Kundkontot kunde inte verifieras.', authError.status === 404 ? 403 : 503, {
      code: 'portal_onboarding_auth_verification_failed', retryable: authError.status !== 404,
    })
    assertPortalOnboardingAuthUserEligible(userId, authData.user)
    await assertProfileCompatible(supabase, userId, input)
    const isConfirmed = confirmed(authData.user)

    if (processingClaim.authUserId !== userId) {
      await updateClaimedJob(supabase, job.id, processingClaim, { auth_user_id: userId })
    }
    if (!isConfirmed) {
      await upsertLocalPortalRows(supabase, input, userId, 'portal_email_confirmation_sent', undefined, assertClaim)
      await updateClaimedJob(supabase, job.id, processingClaim, {
        status: 'pending',
        auth_user_id: userId,
        // Waiting for the customer to confirm their email is not a technical
        // failure and must not consume the retry/dead-letter budget.
        attempt_count: Math.max(0, attempt - 1),
        next_attempt_at: new Date(Date.now() + 15 * 60_000).toISOString(),
        last_error: null,
        locked_at: null,
      })
      return { status: 'email_confirmation_sent', userId }
    }

    const externalCustomerId =
      input.application.external_customer_id ?? input.application.external_customer_reference ?? null
    if (!externalCustomerId) {
      await updateClaimedJob(supabase, job.id, processingClaim, {
        status: 'manual_review',
        auth_user_id: userId,
        next_attempt_at: null,
        last_error: 'OPS external_customer_id missing for portal owner reconciliation.',
        locked_at: null,
      })
      return {
        status: 'pending',
        userId,
        message: 'Kundkontot är skapat men Mina sidor-kopplingen behöver slutföras av kundservice.',
      }
    }

    await assertClaim()
    const sync = await submitOpsCustomerPortalSync({
      identity: {
        userId,
        email: normalizeEmail(input.email),
        customerNumber: input.application.customer_number,
        externalCustomerId,
      },
      idempotencyKey: input.submissionAttemptId,
      customerNumber: input.application.customer_number,
      externalCustomerId,
      email: normalizeEmail(input.email),
      metadata: {
        source: 'website_portal_onboarding_reconciliation',
        submission_attempt_id: input.submissionAttemptId,
        application_number: input.application.application_number,
      },
    })

    const accessGranted = sync.synced?.access_granted === true
    const portalRole = syncedText(sync.synced, ['portal_role', 'role'])
    if (sync.status !== 'linked' || !accessGranted || portalRole !== 'owner') {
      throw new Error(
        `OPS portal sync invariant failed: status=${sync.status ?? 'missing'}, access_granted=${String(accessGranted)}, portal_role=${portalRole ?? 'missing'}`,
      )
    }

    const portalIdentityId = syncedText(sync.synced, ['identity_id', 'portal_identity_id', 'customer_portal_user_id'])
    await upsertLocalPortalRows(supabase, input, userId, 'verified', portalIdentityId ?? userId, assertClaim)
    await updateClaimedJob(supabase, job.id, processingClaim, {
      status: 'completed',
      auth_user_id: userId,
      last_error: null,
      next_attempt_at: null,
      locked_at: null,
      completed_at: new Date().toISOString(),
    })
    return { status: 'profile_linked', userId }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const exhausted = (isOpsError(error) && !error.retryable) || attempt >= job.max_attempts
    await updateClaimedJob(supabase, job.id, processingClaim, {
      status: exhausted ? 'manual_review' : 'retryable_failure',
      last_error: message.slice(0, 2000),
      next_attempt_at: exhausted ? null : retryAt(attempt),
      locked_at: null,
    }).catch((jobError) => console.error('[customer portal] failed to persist retry state', jobError))
    console.error('[customer portal] durable onboarding attempt failed', error)
    return { status: exhausted ? 'failed' : 'pending', message }
  }
}

export async function ensureCustomerPortalOnboarding(
  input: PortalOnboardingInput,
): Promise<PortalOnboardingResult> {
  if (env('GRIDEX_ENABLE_PORTAL_ONBOARDING') === 'false') return { status: 'skipped' }
  if (!input.application.customer_number && !input.application.external_customer_id) {
    return { status: 'pending', message: 'OPS returned no customer reference yet.' }
  }
  try {
    const supabase = await loadServiceClient()
    await recoverStalePortalOnboardingJobs(supabase)
    return processJob(supabase, await queueJob(supabase, input))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[customer portal] onboarding could not be queued', error)
    return { status: 'failed', message }
  }
}

export async function processPortalOnboardingJobs(limit = 25): Promise<{
  processed: number
  completed: number
  pending: number
  failed: number
}> {
  const supabase = await loadServiceClient()
  await recoverStalePortalOnboardingJobs(supabase)
  const { data, error } = await supabase
    .from('portal_onboarding_jobs')
    .select(JOB_COLUMNS)
    .in('status', ['pending', 'retryable_failure'])
    .lte('next_attempt_at', new Date().toISOString())
    .order('next_attempt_at', { ascending: true })
    .limit(Math.max(1, Math.min(limit, 100)))
    .returns<PortalOnboardingJob[]>()
  if (error) throw new Error(`Portal onboarding job load failed: ${error.message}`)

  let completed = 0
  let pending = 0
  let failed = 0
  for (const job of data ?? []) {
    const result = await processJob(supabase, job)
    if (result.status === 'profile_linked') completed += 1
    else if (result.status === 'failed') failed += 1
    else pending += 1
  }
  return { processed: (data ?? []).length, completed, pending, failed }
}

export async function resumePortalOnboardingForConfirmedUser(input: {
  userId: string
  email: string | null
  jobIds: string[]
}): Promise<{ processed: number; completed: number }> {
  if (!input.email || input.jobIds.length === 0) return { processed: 0, completed: 0 }
  const supabase = await loadServiceClient()
  const { data, error } = await supabase
    .from('portal_onboarding_jobs')
    .select(JOB_COLUMNS)
    .eq('email', normalizeEmail(input.email))
    .in('id', input.jobIds)
    .in('status', ['pending', 'retryable_failure', 'manual_review'])
    .limit(10)
    .returns<PortalOnboardingJob[]>()
  if (error) throw new Error(`Portal onboarding resume load failed: ${error.message}`)

  let completed = 0
  let processed = 0
  for (const job of data ?? []) {
    if (job.auth_user_id && job.auth_user_id !== input.userId) continue
    const payload = { ...job.payload, authenticatedUserId: input.userId }
    let update = supabase.from('portal_onboarding_jobs').update({
      auth_user_id: input.userId,
      payload,
      status: 'pending',
      attempt_count: 0,
      next_attempt_at: new Date().toISOString(),
      last_error: null,
      locked_at: null,
      updated_at: new Date().toISOString(),
    })
      .eq('id', job.id)
      .eq('status', job.status)
      .eq('attempt_count', job.attempt_count)
    update = job.auth_user_id ? update.eq('auth_user_id', job.auth_user_id) : update.is('auth_user_id', null)
    const { data: resumed, error: resumeError } = await update.select('id').maybeSingle<{ id: string }>()
    if (resumeError) throw new Error('Portal onboarding resume claim failed: ' + resumeError.message)
    if (!resumed) continue
    processed += 1
    const result = await processJob(supabase, {
      ...job,
      payload,
      auth_user_id: input.userId,
      status: 'pending',
      attempt_count: 0,
      next_attempt_at: new Date().toISOString(),
      last_error: null,
      locked_at: null,
    })
    if (result.status === 'profile_linked') completed += 1
  }
  return { processed, completed }
}

export async function hasPendingPortalOnboardingForUser(userId: string): Promise<boolean> {
  const supabase = await loadServiceClient()
  const { count, error } = await supabase
    .from('portal_onboarding_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('auth_user_id', userId)
    .in('status', ['pending', 'processing', 'retryable_failure', 'manual_review'])
  if (error) {
    console.error('[customer portal] pending onboarding check failed', error)
    return true
  }
  return (count ?? 0) > 0
}
