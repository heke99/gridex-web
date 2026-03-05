// lib/auth/requirePermissionServer.ts

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireAdminRole } from '@/lib/auth/admin'

export async function requirePermissionServer(permission: string) {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  // 1) Legacy fallback: admin_users
  // Keep backwards compatibility while NOT silently granting sensitive actions.
  const legacy = await requireAdminRole(supabase).catch(() => null)
  if (legacy?.role === 'admin') {
    return { supabase, user, mode: 'legacy' as const }
  }
  // Legacy editors should still be able to access basic admin pages gated by admin.access.
  if (legacy?.role === 'editor' && permission === 'admin.access') {
    return { supabase, user, mode: 'legacy' as const }
  }

  // 2) New permission system
  const { data: allowed, error } = await supabase.rpc('gridex_has_permission', {
    p_user_id: user.id,
    p_permission: permission,
  })

  if (error || allowed !== true) {
    throw new Error(`Forbidden: missing permission ${permission}`)
  }

  return { supabase, user, mode: 'permission' as const }
}