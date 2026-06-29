// lib/auth/types.ts

export type Role = {
  id: string
  name: string
  description: string | null
  created_at: string
}

export type Permission = {
  id: string
  name: string
  description: string | null
  created_at: string
}

export type UserRole = {
  user_id: string
  role_id: string
  assigned_at: string
}

export type UserPermission = {
  user_id: string
  permission_id: string
  assigned_at: string
}

export type PermissionCheckResult = {
  allowed: boolean
  reason?: string
}