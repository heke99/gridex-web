export type PermissionCatalogRow = { id: string; name: string; key?: string | null }
export type DirectGlobalPermission = {
  user_id: string
  permission_id: string
  effect: string | null
  is_active: boolean | null
  status: string | null
}
export type CanonicalGlobalOverride = {
  user_id: string
  permission_key: string
  effect: string
  is_active: boolean
  valid_from: string | null
  valid_to: string | null
}

/** Inputs are already restricted to company_id NULL by the server queries. */
export function globalPermissionOverrideRows(
  permissions: PermissionCatalogRow[],
  direct: DirectGlobalPermission[],
  overrides: CanonicalGlobalOverride[],
  now = Date.now(),
): DirectGlobalPermission[] {
  const byKey = new Map<string, string[]>()
  const byId = new Map<string, string>()
  for (const permission of permissions) {
    const key = permission.key || permission.name
    if (!key) continue
    const ids = byKey.get(key) ?? []
    ids.push(permission.id)
    byKey.set(key, ids)
    byId.set(permission.id, key)
  }
  return [
    ...direct.flatMap((row) => {
      if (row.is_active === false || (row.status ?? 'active') !== 'active') return []
      const key = byId.get(row.permission_id)
      const ids = (key && byKey.get(key)) || [row.permission_id]
      return ids.map((permission_id) => ({ ...row, permission_id }))
    }),
    ...overrides.flatMap((row) => {
      if (!row.is_active || (row.valid_from && !(Date.parse(row.valid_from) <= now)) ||
        (row.valid_to && !(Date.parse(row.valid_to) > now))) return []
      return (byKey.get(row.permission_key) ?? []).map((permission_id) => ({
        user_id: row.user_id, permission_id, effect: row.effect,
        is_active: true, status: 'active',
      }))
    }),
  ]
}

export function globalOverrideStates(rows: DirectGlobalPermission[]): Map<string, 'allow' | 'deny'> {
  const states = new Map<string, 'allow' | 'deny'>()
  for (const row of rows) {
    if (row.is_active === false || (row.status ?? 'active') !== 'active') continue
    const key = `${row.user_id}:${row.permission_id}`
    if (row.effect === 'deny') states.set(key, 'deny')
    else if ((row.effect === 'allow' || row.effect == null) && states.get(key) !== 'deny') states.set(key, 'allow')
  }
  return states
}

export function globalOverrideState(rows: DirectGlobalPermission[], userId: string, permissionId: string): 'allow' | 'deny' | null {
  return globalOverrideStates(rows).get(`${userId}:${permissionId}`) ?? null
}
