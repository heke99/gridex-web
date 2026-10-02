import type { SupabaseClient } from '@supabase/supabase-js'

type CatalogRole = { id: string; key: string | null; name: string; is_active: boolean }
type AssignedRole = { id: string; role: string; role_id: string | null; is_active: boolean | null; status: string | null }

async function catalogRole(client: SupabaseClient, name: string): Promise<CatalogRole> {
  const keyResult = await client.from('roles').select('id,key,name,is_active')
    .eq('key', name.toLowerCase()).maybeSingle<CatalogRole>()
  if (keyResult.error) throw new Error(keyResult.error.message)
  if (keyResult.data) return keyResult.data
  const nameResult = await client.from('roles').select('id,key,name,is_active')
    .eq('name', name).maybeSingle<CatalogRole>()
  if (nameResult.error) throw new Error(nameResult.error.message)
  if (!nameResult.data) throw new Error('Unknown role')
  return nameResult.data
}

/** Called only after a global rbac.write guard; never changes company assignments. */
export async function setGlobalUserRole(
  client: SupabaseClient,
  input: { userId: string; role: string; active: boolean; actorId: string },
): Promise<void> {
  const role = await catalogRole(client, input.role.trim())
  const roleKey = role.key || role.name
  if (input.active && !role.is_active) throw new Error('Cannot assign an inactive role')

  // Production has active, expression-based unique indexes, not a plain
  // UNIQUE(user_id,role). A conflicting concurrent grant must be refetched.
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await client.from('user_roles')
      .select('id,role,role_id,is_active,status')
      .eq('user_id', input.userId).is('company_id', null)
      .returns<AssignedRole[]>()
    if (error) throw new Error(error.message)
    const matches = (data ?? []).filter((row) => row.role_id === role.id ||
      row.role.toLowerCase() === roleKey.toLowerCase())
      .sort((a, b) => {
        const aActive = a.is_active !== false && (a.status ?? 'active') === 'active'
        const bActive = b.is_active !== false && (b.status ?? 'active') === 'active'
        return Number(bActive) - Number(aActive) || a.id.localeCompare(b.id)
      })
    const updatedAt = new Date().toISOString()

    if (!input.active) {
      if (!matches.length) return
      const result = await client.from('user_roles').update({
        is_active: false, status: 'inactive', disabled_at: updatedAt,
        disabled_by: input.actorId, updated_at: updatedAt,
      }).in('id', matches.map((row) => row.id))
        .eq('user_id', input.userId).is('company_id', null)
      if (result.error) throw new Error(result.error.message)
      return
    }

    const grant = {
      role: roleKey, role_id: role.id, is_active: true, status: 'active',
      disabled_at: null, disabled_by: null, updated_at: updatedAt,
    }
    const result = matches[0]
      ? await client.from('user_roles').update(grant).eq('id', matches[0].id)
          .eq('user_id', input.userId).is('company_id', null).select('id').maybeSingle()
      : await client.from('user_roles').insert({ ...grant, user_id: input.userId, company_id: null })
          .select('id').single()
    if (!result.error && result.data) return
    if (attempt === 0 && (result.error?.code === '23505' || (!result.error && !result.data))) continue
    throw new Error(result.error?.message ?? 'Role assignment changed concurrently; retry the operation')
  }
}
