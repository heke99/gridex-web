// lib/auth/permissions.ts

import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseServerClient, getVerifiedServerUser } from '@/lib/supabase/server'

async function fetchUserPermissions(
  supabase: SupabaseClient,
  userId: string
): Promise<string[]> {
  const { data: { user }, error: authError } = await getVerifiedServerUser(supabase)
  if (authError || user?.id !== userId) return []
  const { data, error } = await supabase.rpc(
    'gridex_my_permissions_v1'
  )

  if (error) {
    console.error('[RBAC] loadUserPermissions error', error)
    return []
  }

  return data ?? []
}

export const loadUserPermissions = cache(
  async (userId: string): Promise<string[]> => {
    const supabase = await createSupabaseServerClient()
    return fetchUserPermissions(supabase, userId)
  }
)

export async function loadUserPermissionsWithClient(
  supabase: SupabaseClient,
  userId: string
): Promise<string[]> {
  return fetchUserPermissions(supabase, userId)
}

export async function userHasPermission(
  userId: string,
  permission: string
): Promise<boolean> {
  const permissions = await loadUserPermissions(userId)
  return permissions.includes(permission)
}
