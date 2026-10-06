import type { EmailOtpType } from '@supabase/supabase-js'

type SupabaseServiceClient = Awaited<typeof import('@/lib/supabase/service')>['supabaseService']

type AuthProfileSyncJob = {
  user_id: string
  email: string | null
  otp_type: EmailOtpType
  status: 'pending' | 'processing' | 'completed' | 'retryable_failure' | 'manual_review'
  attempt_count: number
  max_attempts: number
  locked_at?: string | null
}

async function loadServiceClient(): Promise<SupabaseServiceClient> {
  const { supabaseService } = await import('@/lib/supabase/service')
  return supabaseService
}

function retryAt(attempt: number): string {
  const minutes = Math.min(12 * 60, Math.max(5, 2 ** Math.min(attempt, 8)))
  return new Date(Date.now() + minutes * 60_000).toISOString()
}

async function queueJob(
  supabase: SupabaseServiceClient,
  params: { userId: string; email: string | null; type: EmailOtpType },
): Promise<AuthProfileSyncJob> {
  const { data, error } = await supabase.rpc('gridex_enqueue_auth_profile_v1', {
    p_user_id: params.userId, p_otp_type: params.type,
  })
  if (error || !data) throw new Error('Auth profile job queue failed.')
  return data as AuthProfileSyncJob
}


async function updateClaimedJob(
  supabase: SupabaseServiceClient,
  userId: string,
  attempt: number,
  lockedAt: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { data, error } = await supabase
    .from('auth_profile_sync_jobs')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('status', 'processing')
    .eq('attempt_count', attempt)
    .eq('locked_at', lockedAt)
    .select('user_id')
    .maybeSingle<{ user_id: string }>()
  if (error) throw new Error(`Auth profile claimed update failed: ${error.message}`)
  if (!data) throw new Error('Auth profile processing claim was lost.')
}

async function claimJob(
  supabase: SupabaseServiceClient,
  job: AuthProfileSyncJob,
): Promise<{ attempt: number; lockedAt: string } | null> {
  const attempt = job.attempt_count + 1
  const lockedAt = new Date().toISOString()
  const { data, error } = await supabase
    .from('auth_profile_sync_jobs')
    .update({
      status: 'processing',
      attempt_count: attempt,
      locked_at: lockedAt,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', job.user_id)
    .eq('attempt_count', job.attempt_count)
    .in('status', ['pending', 'retryable_failure'])
    .select('user_id')
    .maybeSingle<{ user_id: string }>()
  if (error) throw new Error(`Auth profile job claim failed: ${error.message}`)
  return data ? { attempt, lockedAt } : null
}

async function processJob(
  supabase: SupabaseServiceClient,
  job: AuthProfileSyncJob,
): Promise<{ completed: boolean; error?: string }> {
  const claim = await claimJob(supabase, job)
  if (claim === null) {
    const { data } = await supabase
      .from('auth_profile_sync_jobs')
      .select('status')
      .eq('user_id', job.user_id)
      .maybeSingle<{ status: AuthProfileSyncJob['status'] }>()
    return data?.status === 'completed'
      ? { completed: true }
      : { completed: false, error: 'Auth profile sync is already being processed.' }
  }

  const { attempt, lockedAt } = claim
  try {
    const { data, error } = await supabase.rpc('gridex_commit_auth_profile_v1', {
      p_user_id: job.user_id, p_attempt: attempt, p_locked_at: lockedAt,
    })
    if (error) throw new Error('Auth profile transaction failed.')
    if (data !== true) return { completed: false, error: 'Auth profile processing claim was lost.' }
    return { completed: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const exhausted = attempt >= job.max_attempts
    try {
      await updateClaimedJob(supabase, job.user_id, attempt, lockedAt, {
        status: exhausted ? 'manual_review' : 'retryable_failure',
        last_error: message.slice(0, 2000),
        next_attempt_at: exhausted ? null : retryAt(attempt),
        locked_at: null,
      })
    } catch (stateError) {
      console.error('[auth profile sync] failed to persist retry state', stateError)
    }
    return { completed: false, error: message }
  }
}

export async function syncConfirmedUserProfileDurably(params: {
  userId: string
  email: string | null
  type: EmailOtpType
}): Promise<{ completed: boolean; error?: string }> {
  const normalized = {
    ...params,
    email: params.email?.trim().toLowerCase() ?? null,
  }

  try {
    const supabase = await loadServiceClient()
    await recoverStaleAuthProfileSyncJobs(supabase)
    return processJob(supabase, await queueJob(supabase, normalized))
  } catch (error) {
    return { completed: false, error: error instanceof Error ? error.message : String(error) }
  }
}


async function recoverStaleAuthProfileSyncJobs(
  supabase: SupabaseServiceClient,
): Promise<void> {
  const cutoff = new Date(Date.now() - 15 * 60_000).toISOString()
  const { error } = await supabase
    .from('auth_profile_sync_jobs')
    .update({
      status: 'retryable_failure',
      next_attempt_at: new Date().toISOString(),
      last_error: 'Recovered stale processing lock after worker interruption.',
      locked_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('status', 'processing')
    .lt('locked_at', cutoff)
  if (error) throw new Error(`Auth profile stale-lock recovery failed: ${error.message}`)
}

export async function processAuthProfileSyncJobs(limit = 25): Promise<{
  processed: number
  completed: number
  failed: number
}> {
  const supabase = await loadServiceClient()
  await recoverStaleAuthProfileSyncJobs(supabase)
  const { data, error } = await supabase
    .from('auth_profile_sync_jobs')
    .select('user_id,email,otp_type,status,attempt_count,max_attempts,locked_at')
    .in('status', ['pending', 'retryable_failure'])
    .lte('next_attempt_at', new Date().toISOString())
    .order('next_attempt_at', { ascending: true })
    .limit(Math.max(1, Math.min(limit, 100)))
    .returns<AuthProfileSyncJob[]>()
  if (error) throw new Error(`Auth profile job load failed: ${error.message}`)

  let completed = 0
  let failed = 0
  for (const job of data ?? []) {
    const result = await processJob(supabase, job)
    if (result.completed) completed += 1
    else failed += 1
  }
  return { processed: (data ?? []).length, completed, failed }
}

export async function hasPendingAuthProfileSync(userId: string): Promise<boolean> {
  const supabase = await loadServiceClient()
  const { count, error } = await supabase
    .from('auth_profile_sync_jobs')
    .select('user_id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('status', ['pending', 'processing', 'retryable_failure', 'manual_review'])
  if (error) {
    console.error('[auth profile sync] pending state check failed', error)
    return true
  }
  return (count ?? 0) > 0
}
