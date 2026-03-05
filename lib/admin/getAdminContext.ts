// lib/admin/getAdminContext.ts

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

type PermissionRow = {
  permission_key: string
}

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

  const { data, error } = await supabase.rpc('gridex_get_user_permissions', {
    user_id_input: user.id,
  })

  if (error) {
    throw new Error(error.message)
  }

  const rows: PermissionRow[] = Array.isArray(data)
    ? data.filter(
        (row): row is PermissionRow =>
          typeof row === 'object' &&
          row !== null &&
          'permission_key' in row
      )
    : []

  const permissions = rows.map((row) => row.permission_key)

  const isAdmin = permissions.includes('admin.access')

  return {
    userId: user.id,
    email: user.email ?? null,
    permissions,
    roles: [],
    isAdmin,
    supabase,
  }
}