// lib/auth/permissions.ts

import { cache } from 'react'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const loadUserPermissions = cache(
  async (userId: string): Promise<string[]> => {
    const supabase = await createSupabaseServerClient()

    const { data, error } = await supabase.rpc(
      'gridex_get_user_permissions',
      { p_user_id: userId }
    )

    if (error) {
      console.error('[RBAC] loadUserPermissions error', error)
      return []
    }

    return data ?? []
  }
)

export async function userHasPermission(
  userId: string,
  permission: string
): Promise<boolean> {
  const permissions = await loadUserPermissions(userId)
  return permissions.includes(permission)
}