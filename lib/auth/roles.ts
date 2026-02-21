// lib/auth/roles.ts
import { cache } from 'react'
import { createSupabaseServerClient } from '@/lib/supabase/server'

type UserRoleRow = {
  role: string
  is_active: boolean | null
}

export const loadUserRoles = cache(async (userId: string): Promise<string[]> => {
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from('user_roles')
    .select('role,is_active')
    .eq('user_id', userId)

  if (error) {
    console.error('[RBAC] loadUserRoles error', error)
    return []
  }

  const rows = (data ?? []) as UserRoleRow[]

  return rows
    .filter((r) => r.is_active !== false)
    .map((r) => r.role)
})

export async function userHasRole(userId: string, roleName: string) {
  const roles = await loadUserRoles(userId)
  return roles.includes(roleName)
}