import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  RBACClaims,
  RoleRow,
  PermissionRow,
} from './types'

export async function buildRBACClaims(
  supabase: SupabaseClient,
  userId: string
): Promise<RBACClaims> {

  const { data: roles, error: roleError } = await supabase
    .from('user_roles')
    .select('role,is_active')
    .eq('user_id', userId)
    .eq('is_active', true)
    .returns<RoleRow[]>()

  if (roleError) throw new Error(roleError.message)

  const roleNames =
    roles?.map(r => r.role) ?? []

  const { data: perms, error: permError } = await supabase
    .from('role_permissions')
    .select(`
      permissions(name)
    `)
    .in('role_id', roleNames)
    .returns<PermissionRow[]>()

  if (permError) throw new Error(permError.message)

  const permissions =
    perms?.map(p => p.permissions.name) ?? []

  const { data: overrides, error: overrideError } = await supabase
    .from('user_permissions')
    .select(`
      permissions(name)
    `)
    .eq('user_id', userId)
    .returns<PermissionRow[]>()

  if (overrideError) throw new Error(overrideError.message)

  const overridePerms =
    overrides?.map(p => p.permissions.name) ?? []

  const allPermissions = [
    ...new Set([...permissions, ...overridePerms])
  ]

  return {
    roles: roleNames,
    permissions: allPermissions,
    isAdmin: roleNames.includes('admin')
  }
}