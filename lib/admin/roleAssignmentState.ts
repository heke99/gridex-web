export type RegisteredRole = {
  id: string
  name: string
  key?: string | null
  is_active?: boolean
}

export type UserRoleAssignment = {
  user_id: string
  role: string
  role_id?: string | null
  is_active: boolean | null
  status?: string | null
}

export function isActiveRoleAssignment(row: UserRoleAssignment): boolean {
  return row.is_active !== false && (row.status ?? 'active') === 'active'
}

export function roleAssignmentMatches(row: UserRoleAssignment, role: RegisteredRole): boolean {
  // A registered ID is authoritative. Legacy text is only a fallback for rows
  // without an ID, matching the effective authorization function.
  return row.role_id != null
    ? row.role_id === role.id
    : row.role.toLowerCase() === (role.key || role.name).toLowerCase()
}
