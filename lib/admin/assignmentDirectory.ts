import type { SupabaseClient } from '@supabase/supabase-js'
import type { CanonicalGlobalOverride, DirectGlobalPermission } from './permissionOverrides'
import type { UserRoleAssignment } from './roleAssignmentState'

type DirectoryUser = { id: string; email: string | null; full_name: string | null; created_at: string | null }
export type GlobalRbacDirectory = {
  users: DirectoryUser[]
  total: number
  userRoles: UserRoleAssignment[]
  userPermissions: DirectGlobalPermission[]
  overrides: CanonicalGlobalOverride[]
}

function invalid(): never { throw new Error('The global RBAC directory returned an invalid response') }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid()
  return value as Record<string, unknown>
}
function text(value: unknown): string {
  if (typeof value !== 'string') invalid()
  return value
}
function nullableText(value: unknown): string | null { return value === null ? null : text(value) }
function nullableBoolean(value: unknown): boolean | null {
  if (value !== null && typeof value !== 'boolean') invalid()
  return value as boolean | null
}
function rows(root: Record<string, unknown>, key: string): Record<string, unknown>[] {
  const value = root[key]
  if (!Array.isArray(value)) invalid()
  return value.map(record)
}

export async function loadGlobalRbacDirectory(
  client: SupabaseClient,
  input: { actorId: string; query: string | null; roleId: string | null; active: boolean | null; limit: number; offset: number },
): Promise<GlobalRbacDirectory> {
  const { data, error } = await client.rpc('gridex_web_list_global_rbac_users', {
    p_actor_id: input.actorId, p_query: input.query, p_role_id: input.roleId,
    p_active: input.active, p_limit: input.limit, p_offset: input.offset,
  })
  if (error) throw new Error('Could not load the global RBAC directory')
  const root = record(data)
  const users = rows(root, 'users').map((row) => ({
    id: text(row.id), email: nullableText(row.email), full_name: nullableText(row.full_name), created_at: nullableText(row.created_at),
  }))
  if (!Number.isSafeInteger(root.total) || Number(root.total) < users.length || users.length > input.limit) invalid()
  const userIds = new Set(users.map((user) => user.id))
  if (userIds.size !== users.length || users.some((user) => !user.id)) invalid()
  const scopedUserId = (row: Record<string, unknown>) => {
    const id = text(row.user_id)
    if (!userIds.has(id)) invalid()
    return id
  }
  const userRoles = rows(root, 'user_roles').map((row) => ({
    user_id: scopedUserId(row), role: text(row.role), role_id: nullableText(row.role_id),
    is_active: nullableBoolean(row.is_active), status: nullableText(row.status),
  }))
  const userPermissions = rows(root, 'user_permissions').map((row) => ({
    user_id: scopedUserId(row), permission_id: text(row.permission_id), effect: nullableText(row.effect),
    is_active: nullableBoolean(row.is_active), status: nullableText(row.status),
  }))
  const overrides = rows(root, 'user_permission_overrides').map((row) => {
    if (typeof row.is_active !== 'boolean') invalid()
    return {
      user_id: scopedUserId(row), permission_key: text(row.permission_key), effect: text(row.effect),
      is_active: row.is_active, valid_from: nullableText(row.valid_from), valid_to: nullableText(row.valid_to),
    }
  })
  return { users, total: Number(root.total), userRoles, userPermissions, overrides }
}
