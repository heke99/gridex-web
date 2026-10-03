// app/api/me/permissions/route.ts

import { privateJsonResponse } from '@/lib/api/webBoundary'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { loadUserPermissions } from '@/lib/auth/permissions'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return privateJsonResponse({ permissions: [] }, { headers: { Vary: 'Cookie' } })
  }

  const permissions = await loadUserPermissions(user.id)

  return privateJsonResponse({ permissions }, { headers: { Vary: 'Cookie' } })
}
