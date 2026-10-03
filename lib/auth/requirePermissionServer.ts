// lib/auth/requirePermissionServer.ts

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireGlobalAdminActionAccess } from '@/lib/admin/guards'

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

  // Legacy spot/portfolio tables store global configuration, so company-only
  // grants cannot authorize their mutations.
  await requireGlobalAdminActionAccess({ allOf: [permission] })

  return {
    supabase,
    user,
    mode: 'permission' as const,
  }
}
