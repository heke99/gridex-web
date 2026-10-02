import { cache } from 'react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { loadUserRolesWithClient } from './permissions'

export const loadUserRoles = cache(async (userId: string): Promise<string[]> => {
  const supabase = await createSupabaseServerClient()

  return loadUserRolesWithClient(supabase, userId)
})

export async function userHasRole(
  userId: string,
  roleName: string
): Promise<boolean> {
  const roles = await loadUserRoles(userId)
  return roles.includes(roleName)
}
