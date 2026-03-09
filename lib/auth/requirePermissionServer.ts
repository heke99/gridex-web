// lib/auth/requirePermissionServer.ts

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireAdminRole } from '@/lib/auth/admin'

export async function requirePermissionServer(permission: string) {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) {
    throw new Error(userError.message)
  }

  if (!user) {
    throw new Error('Unauthorized')
  }

  // --------------------------------------------------
  // 1) Legacy fallback: admin_users
  // --------------------------------------------------
  // Behåll bakåtkompatibilitet för äldre adminflöden,
  // men håll detta strikt så att legacy editor inte får
  // känsliga write/publish-rättigheter av misstag.
  const legacy = await requireAdminRole(supabase).catch(() => null)

  if (legacy?.role === 'admin') {
    return {
      supabase,
      user,
      mode: 'legacy' as const,
    }
  }

  // Legacy editor tillåts endast för basic admin-access
  if (legacy?.role === 'editor' && permission === 'admin.access') {
    return {
      supabase,
      user,
      mode: 'legacy' as const,
    }
  }

  // --------------------------------------------------
  // 2) New permission system
  // --------------------------------------------------
  const { data: allowed, error } = await supabase.rpc('gridex_has_permission', {
    p_user_id: user.id,
    p_permission: permission,
  })

  if (error) {
    throw new Error(error.message)
  }

  if (allowed !== true) {
    throw new Error(`Forbidden: missing permission ${permission}`)
  }

  return {
    supabase,
    user,
    mode: 'permission' as const,
  }
}