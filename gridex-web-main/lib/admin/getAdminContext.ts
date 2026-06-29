import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'

export type AdminContext = {
  userId: string
  email: string | null
  permissions: string[]
  roles: string[]
  isAdmin: boolean
  supabase: SupabaseClient
}

type RoleRow = {
  role: string
  is_active: boolean | null
}

const ADMIN_CONSOLE_PERMISSIONS = new Set<string>([
  'admin.access',
  'support_tickets.manage',
])

export async function getAdminContext(): Promise<AdminContext> {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      userId: '',
      email: null,
      permissions: [],
      roles: [],
      isAdmin: false,
      supabase,
    }
  }

  const [
    { data: permissionData, error: permissionError },
    { data: roleData, error: roleError },
  ] = await Promise.all([
    supabase.rpc('gridex_get_user_permissions', { p_user_id: user.id }),
    supabase
      .from('user_roles')
      .select('role,is_active')
      .eq('user_id', user.id)
      .returns<RoleRow[]>(),
  ])

  if (permissionError) {
    throw new Error(permissionError.message)
  }

  if (roleError) {
    throw new Error(roleError.message)
  }

  const permissions = Array.isArray(permissionData)
    ? Array.from(
        new Set(
          permissionData.filter((value): value is string => typeof value === 'string')
        )
      )
    : []

  const roles = Array.isArray(roleData)
    ? Array.from(
        new Set(
          roleData
            .filter(
              (row): row is RoleRow =>
                row.is_active !== false && typeof row.role === 'string'
            )
            .map((row) => row.role)
        )
      )
    : []

  const isAdmin =
    roles.includes('admin') ||
    permissions.some((permission) =>
      ADMIN_CONSOLE_PERMISSIONS.has(permission)
    )

  return {
    userId: user.id,
    email: user.email ?? null,
    permissions,
    roles,
    isAdmin,
    supabase,
  }
}