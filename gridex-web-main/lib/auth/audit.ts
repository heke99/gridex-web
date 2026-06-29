// lib/auth/audit.ts
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function logPermissionAudit(params: {
  actorId: string
  action: string
  targetUserId?: string
  metadata?: Record<string, unknown>
}) {
  const supabase = await createSupabaseServerClient()

  await supabase.from('permission_audit').insert({
    actor_id: params.actorId,
    action: params.action,
    target_user_id: params.targetUserId ?? null,
    metadata: params.metadata ?? null,
  })
}