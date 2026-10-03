import { cache } from 'react'
import { createSupabaseServerClient, getSupabaseUser } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseService } from '@/lib/supabase/service'
import { canEnterAdminConsole, normalizePermissions } from './access'
import { getWebCompanyId } from '@/lib/auth/tenant'

export type AdminContext = {
  userId: string
  email: string | null
  permissions: string[]
  roles: string[]
  isAdmin: boolean
  supabase: SupabaseClient
}

type RoleRow = {
  role_key?: string
  key?: string
  name?: string
}
export const getAdminContext = cache(async (): Promise<AdminContext> => {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
    error: authError,
  } = await getSupabaseUser()

  if (authError || !user) {
    return {
      userId: '',
      email: null,
      permissions: [],
      roles: [],
      isAdmin: false,
      supabase,
    }
  }
  const companyId = getWebCompanyId()

  const [
    { data: permissionData, error: permissionError },
    { data: roleData, error: roleError },
  ] = await Promise.all([
    supabaseService.rpc('gridex_get_user_permissions', { p_user_id: user.id, p_company_id: companyId }),
    supabaseService.rpc('gridex_get_user_roles', { p_user_id: user.id, p_company_id: companyId }),
  ])

  if (permissionError) {
    throw new Error(permissionError.message)
  }

  if (roleError) {
    throw new Error(roleError.message)
  }

  const permissions = normalizePermissions(permissionData)

  const roles = Array.isArray(roleData)
    ? Array.from(
        new Set(
          (roleData as RoleRow[])
            .map((row) => row.role_key ?? row.key ?? row.name)
            .filter((role): role is string => typeof role === 'string')
        )
      )
    : []

  const isAdmin = canEnterAdminConsole(permissions)

  return {
    userId: user.id,
    email: user.email ?? null,
    permissions,
    roles,
    isAdmin,
    supabase,
  }
})
