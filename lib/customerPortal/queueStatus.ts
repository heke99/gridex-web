export type PortalQueueStatus = 'empty' | 'pending' | 'manual_review' | 'unavailable'

export async function readPortalQueueStatus(
  queue: 'portal_onboarding_jobs' | 'auth_profile_sync_jobs',
  userId: string,
): Promise<PortalQueueStatus> {
  try {
    const { supabaseService } = await import('@/lib/supabase/service')
    const { data, error } = await supabaseService
      .from(queue)
      .select('status')
      .eq(queue === 'portal_onboarding_jobs' ? 'auth_user_id' : 'user_id', userId)
      .in('status', ['manual_review', 'pending', 'processing', 'retryable_failure'])
      // The text index puts manual_review before the retryable states.
      .order('status', { ascending: true })
      .limit(1)
    if (error) throw error
    const status = data?.[0]?.status
    if (!status) return 'empty'
    return status === 'manual_review' ? 'manual_review' : 'pending'
  } catch (error) {
    console.error('[customer portal] queue status unavailable', { queue, error })
    return 'unavailable'
  }
}
