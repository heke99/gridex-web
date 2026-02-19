import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'

export type AdminRole = 'admin' | 'editor'

export type AdminUserRow = {
  user_id: string
  role: AdminRole
  is_active?: boolean | null
}

async function readAdminUserRow(supabase: SupabaseClient, userId: string) {
  // Tolerant läsning: vissa projekt har is_active, andra inte.
  // Vi försöker med is_active först, faller tillbaka annars.
  const withActive = await supabase
    .from('admin_users')
    .select('user_id, role, is_active')
    .eq('user_id', userId)
    .maybeSingle()

  if (!withActive.error) return withActive.data as AdminUserRow | null

  const basic = await supabase
    .from('admin_users')
    .select('user_id, role')
    .eq('user_id', userId)
    .maybeSingle()

  if (basic.error) return null
  return basic.data as AdminUserRow | null
}

export async function requireUser(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')
  return user
}

export async function getAdminRole(supabase: SupabaseClient, userId: string): Promise<AdminRole | null> {
  const row = await readAdminUserRow(supabase, userId)
  if (!row) return null

  // Om is_active finns och är false -> blockera
  if (typeof row.is_active !== 'undefined' && row.is_active === false) return null

  if (row.role === 'admin' || row.role === 'editor') return row.role
  return null
}

export async function requireAdminAccess(supabase: SupabaseClient) {
  const user = await requireUser(supabase)
  const role = await getAdminRole(supabase, user.id)

  if (!role) redirect('/login?reason=forbidden')
  return { user, role }
}

export function canEdit(role: AdminRole) {
  return role === 'admin' || role === 'editor'
}

export function canPublish(role: AdminRole) {
  return role === 'admin'
}