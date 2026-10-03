import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  RBACClaims,
} from './types'
import { loadUserPermissionsWithClient } from '@/lib/auth/permissions'
import { supabaseService } from '@/lib/supabase/service'
import { getWebCompanyId } from '@/lib/auth/tenant'
import { canEnterAdminConsole } from './access'

export async function buildRBACClaims(
  supabase: SupabaseClient,
  userId: string
): Promise<RBACClaims> {

  const permissions = await loadUserPermissionsWithClient(supabase, userId)
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || user?.id !== userId) throw new Error('Forbidden')
  const { data: roles, error } = await supabaseService.rpc('gridex_get_user_roles', {
    p_user_id: userId, p_company_id: getWebCompanyId(),
  })
  if (error) throw new Error(error.message)
  const roleNames = Array.isArray(roles)
    ? roles.map((role) => role.role_key ?? role.key ?? role.name).filter((role): role is string => typeof role === 'string')
    : []

  return {
    roles: roleNames,
    permissions,
    isAdmin: canEnterAdminConsole(permissions)
  }
}
