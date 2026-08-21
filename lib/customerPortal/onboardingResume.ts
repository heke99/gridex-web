import type { PortalOnboardingInput } from '@/lib/customerPortal/onboarding'
import { resumePortalOnboardingForConfirmedUser } from '@/lib/customerPortal/onboarding'
import { supabaseService } from '@/lib/supabase/service'

type PortalOnboardingJobCandidate = {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'retryable_failure' | 'manual_review'
  email: string
  auth_user_id: string | null
  payload: PortalOnboardingInput
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

function escapeIlikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`)
}

function stableProfileMatchesApplication(
  profile: ExistingProfile | null,
  input: PortalOnboardingInput,
): boolean {
  if (!profile) return false
  const appExternal = input.application.external_customer_id?.trim() || null
  const appCustomerNumber = input.application.customer_number?.trim() || null

  return Boolean(
    (appExternal && profile.external_customer_id === appExternal) ||
      (appCustomerNumber &&
        (profile.customer_number === appCustomerNumber ||
          profile.contract_customer_ref === appCustomerNumber)),
  )
}

export function portalOnboardingCandidateHasStableIdentity(
  job: Pick<PortalOnboardingJobCandidate, 'auth_user_id' | 'payload'>,
  profile: ExistingProfile | null,
  userId: string,
): boolean {
  if (job.auth_user_id === userId) return true
  if (job.auth_user_id && job.auth_user_id !== userId) return false
  return stableProfileMatchesApplication(profile, job.payload)
}

async function markBlocked(jobId: string): Promise<void> {
  const { error } = await supabaseService
    .from('portal_onboarding_jobs')
    .update({
      status: 'manual_review',
      last_error: 'stable_identity_match_required',
      locked_at: null,
      next_attempt_at: null,
    })
    .eq('id', jobId)
    .neq('status', 'completed')

  if (error) throw new Error(`Could not quarantine onboarding job ${jobId}: ${error.message}`)
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
    .select('id,status,email,auth_user_id,payload')
    .eq('email', email)
    .in('status', ['pending', 'retryable_failure', 'manual_review'])
    .limit(10)

  if (jobsError) throw new Error(`Could not load portal onboarding candidates: ${jobsError.message}`)

  const jobs = (jobsData ?? []) as PortalOnboardingJobCandidate[]
  if (jobs.length === 0) return { processed: 0, completed: 0, blocked: 0 }

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
    await Promise.all(blocked.map((job) => markBlocked(job.id)))
    return { processed: 0, completed: 0, blocked: blocked.length }
  }

  const result = await resumePortalOnboardingForConfirmedUser({
    userId: input.userId,
    // The legacy helper uses ILIKE. Escape wildcard characters so this remains
    // an exact normalized-email lookup while the helper is retained.
    email: escapeIlikePattern(email),
  })

  return { ...result, blocked: 0 }
}
