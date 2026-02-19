'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireAdminRole, assertCanPublish } from '@/lib/auth/admin'

export type UserRole = 'admin' | 'editor' | 'user'

function normalizeRole(v: unknown): UserRole {
  if (v === 'admin' || v === 'editor' || v === 'user') return v
  return 'user'
}

export async function setUserRole(formData: FormData) {
  const userId = String(formData.get('user_id') || '')
  const role = normalizeRole(formData.get('role'))

  if (!userId) throw new Error('Missing user_id')

  const supabase = await createSupabaseServerClient()
  const { role: myRole } = await requireAdminRole(supabase)
  // Role changes är “admin-only”
  assertCanPublish(myRole)

  const { error } = await supabase
    .from('user_profiles')
    .update({ role })
    .eq('id', userId)

  if (error) throw new Error(error.message)

  revalidatePath('/admin/users')
}

export async function setUserActive(formData: FormData) {
  const userId = String(formData.get('user_id') || '')
  const isActiveStr = String(formData.get('is_active') || 'true')
  const is_active = isActiveStr === 'true'

  if (!userId) throw new Error('Missing user_id')

  const supabase = await createSupabaseServerClient()
  const { role: myRole } = await requireAdminRole(supabase)
  assertCanPublish(myRole)

  const { error } = await supabase
    .from('user_profiles')
    .update({ is_active })
    .eq('id', userId)

  if (error) throw new Error(error.message)

  revalidatePath('/admin/users')
}