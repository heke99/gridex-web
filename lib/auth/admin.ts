// lib/auth/admin.ts
import type { SupabaseClient, User } from '@supabase/supabase-js'

export type AdminRole = 'admin' | 'editor'

type AdminRow = {
  user_id: string
  role: AdminRole | null
  is_active?: boolean | null
}

export async function requireAdminRole(
  supabase: SupabaseClient
): Promise<{ user: User; role: AdminRole }> {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser()

  if (userErr) throw new Error(userErr.message)
  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('admin_users')
    .select('user_id, role, is_active')
    .eq('user_id', user.id)
    .maybeSingle<AdminRow>()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Forbidden')

  if (data.is_active === false) {
    throw new Error('Forbidden')
  }

  const role: AdminRole =
    data.role === 'admin' || data.role === 'editor' ? data.role : 'editor'

  return { user, role }
}

export function assertCanPublish(role: AdminRole): void {
  if (role !== 'admin') {
    throw new Error('Publish not allowed')
  }
}

// Extra guard (behåller allt gammalt, bara ny helper)
export function assertEditorOrAdmin(role: AdminRole): void {
  if (role !== 'admin' && role !== 'editor') {
    throw new Error('Forbidden')
  }
}