import type { SupabaseClient } from '@supabase/supabase-js'

export type RoleName = string
export type PermissionName = string

export type RBACClaims = {
  roles: RoleName[]
  permissions: PermissionName[]
  isAdmin: boolean
}

export type AdminContext = {
  userId: string
  email: string | null
  roles: RoleName[]
  permissions: PermissionName[]
  isAdmin: boolean
  supabase: SupabaseClient
}

export type RoleRow = {
  role: RoleName
  is_active: boolean
}

export type PermissionRow = {
  permissions: {
    name: PermissionName
  }
}