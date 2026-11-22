import { privateJsonResponse } from '@/lib/api/webBoundary'
import { verifyCronBearer } from '@/lib/integrations/auth'
import { supabaseService } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const EXPIRED_RETENTION_MS = 7 * 24 * 60 * 60_000

export async function GET(request: Request) {
  if (!verifyCronBearer(request)) {
    return privateJsonResponse({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const cutoff = new Date(Date.now() - EXPIRED_RETENTION_MS).toISOString()
    const { count, error } = await supabaseService
      .from('distributed_rate_limits')
      .delete({ count: 'exact' })
      .lt('reset_at', cutoff)
      .abortSignal(AbortSignal.timeout(15_000))
    if (error || count === null) throw new Error('Rate limit cleanup failed')
    console.info('[rate-limit cleanup] completed', { deleted: count })
    return privateJsonResponse({ ok: true, deleted: count })
  } catch {
    console.error('[rate-limit cleanup] failed')
    return privateJsonResponse({ error: 'Rate limit cleanup failed.' }, { status: 503 })
  }
}
