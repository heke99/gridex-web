import type { PortalOnboardingInput } from '@/lib/customerPortal/onboarding'
import { resumePortalOnboardingForConfirmedUser } from '@/lib/customerPortal/onboarding'
import { supabaseService } from '@/lib/supabase/service'
import { stablePortalCustomerIdentityConflicts, stablePortalCustomerIdentityMatches } from '@/lib/customerPortal/stableIdentity'

type PortalOnboardingJobCandidate = {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'retryable_failure' | 'manual_review'
  email: string
  auth_user_id: string | null
  payload: PortalOnboardingInput
  attempt_count: number
  last_error: string | null
}

type ExistingProfile = {
  user_id: string
  email: string | null
  customer_number: string | null
  contract_customer_ref: string | null
  external_customer_id: string | null
}

export type SafePortalOnboardingResumeResult = {
  processed: number
  completed: number
  blocked: number
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

export function portalOnboardingCandidateHasStableIdentity(
  job: Pick<PortalOnboardingJobCandidate, 'auth_user_id' | 'payload'>,
  profile: ExistingProfile | null,
  userId: string,
): boolean {
  if (profile && (profile.user_id !== userId || stablePortalCustomerIdentityConflicts(profile, job.payload.application))) return false
  if (job.auth_user_id === userId) return true
  if (job.auth_user_id && job.auth_user_id !== userId) return false
  return Boolean(profile && stablePortalCustomerIdentityMatches(profile, job.payload.application))
}

async function markBlocked(job: PortalOnboardingJobCandidate): Promise<void> {
  // An email-only login must not consume the explicit signed-result claim.
  if (!job.auth_user_id && job.last_error === 'existing_auth_user_requires_login') return
  const { error } = await supabaseService
    .from('portal_onboarding_jobs')
    .update({
      status: 'manual_review',
      last_error: 'stable_identity_match_required',
      locked_at: null,
      next_attempt_at: null,
    })
    .eq('id', job.id)
    .eq('status', job.status)
    .eq('attempt_count', job.attempt_count)

  if (error) throw new Error('Could not quarantine onboarding job ' + job.id + ': ' + error.message)
}

/**
 * Resume post-checkout portal onboarding only after a trusted Auth user has been
 * proven to be the same Gridex customer. Email is discovery data, never identity
 * proof. A job created directly for this Auth UUID is safe; otherwise the user's
 * existing portal profile must share a stable OPS customer identifier with the job.
 *
 * If one same-email candidate is ambiguous, all automatic resume for that email is
 * stopped. This deliberately prefers manual review over cross-account linking.
 */
export async function resumePortalOnboardingForConfirmedUserSafely(input: {
  userId: string
  email: string | null
}): Promise<SafePortalOnboardingResumeResult> {
  if (!input.email) return { processed: 0, completed: 0, blocked: 0 }

  const email = normalizeEmail(input.email)
  const { data: jobsData, error: jobsError } = await supabaseService
    .from('portal_onboarding_jobs')
    .select('id,status,email,auth_user_id,payload,attempt_count,last_error')
    .eq('email', email)
    .in('status', ['pending', 'retryable_failure', 'manual_review'])
    .limit(11)

  if (jobsError) throw new Error(`Could not load portal onboarding candidates: ${jobsError.message}`)

  const jobs = (jobsData ?? []) as PortalOnboardingJobCandidate[]
  if (jobs.length === 0) return { processed: 0, completed: 0, blocked: 0 }

  // The legacy worker processes at most 10 jobs at a time without deterministic
  // ordering. If more candidates exist, never risk validating one set and processing
  // another; force manual review instead.
  if (jobs.length > 10) {
    await Promise.all(jobs.map((job) => markBlocked(job)))
    return { processed: 0, completed: 0, blocked: jobs.length }
  }

  const { data: profileData, error: profileError } = await supabaseService
    .from('customer_profiles')
    .select('user_id,email,customer_number,contract_customer_ref,external_customer_id')
    .eq('user_id', input.userId)
    .maybeSingle()

  if (profileError) throw new Error(`Could not verify portal identity: ${profileError.message}`)
  const profile = (profileData ?? null) as ExistingProfile | null

  const blocked = jobs.filter(
    (job) => !portalOnboardingCandidateHasStableIdentity(job, profile, input.userId),
  )

  if (blocked.length > 0) {
    await Promise.all(blocked.map((job) => markBlocked(job)))
    return { processed: 0, completed: 0, blocked: blocked.length }
  }

  const result = await resumePortalOnboardingForConfirmedUser({
    userId: input.userId,
    email,
    jobIds: jobs.map((job) => job.id),
  })

  return { ...result, blocked: 0 }
}
