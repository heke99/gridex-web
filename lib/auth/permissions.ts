// lib/auth/permissions.ts

import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseServerClient, getSupabaseUser } from '@/lib/supabase/server'
import { supabaseService } from '@/lib/supabase/service'
import { normalizePermissions } from '@/lib/admin/access'
import { getWebCompanyId } from './tenant'

async function fetchUserPermissions(
  supabase: SupabaseClient,
  userId: string
): Promise<string[]> {
  const { data: { user }, error: authError } = await getSupabaseUser(supabase)
  if (authError || !user || user.id !== userId) return []
  const { data, error } = await supabaseService.rpc(
    'gridex_get_user_permissions',
    { p_user_id: userId, p_company_id: getWebCompanyId() }
  )

  if (error) {
    console.error('[RBAC] loadUserPermissions error', error)
    return []
  }

  return normalizePermissions(data)
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

export async function loadUserRolesWithClient(supabase: SupabaseClient, userId: string): Promise<string[]> {
  const { data: { user }, error: authError } = await getSupabaseUser(supabase)
  if (authError || !user || user.id !== userId) return []
  const { data, error } = await supabaseService.rpc('gridex_get_user_roles', {
    p_user_id: userId, p_company_id: getWebCompanyId(),
  })
  if (error) throw new Error('Could not verify user roles')
  return Array.isArray(data)
    ? [...new Set(data.map((role) => role.role_key ?? role.key ?? role.name).filter((role): role is string => typeof role === 'string'))]
    : []
}

export async function userHasPermission(
  userId: string,
  permission: string
): Promise<boolean> {
  const permissions = await loadUserPermissions(userId)
  return permissions.includes(permission)
}
