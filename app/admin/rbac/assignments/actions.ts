'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireAdminServer } from '@/lib/auth/requireAdminServer'

type RoleForm = {
  user_id: string
  role: string
  active: string
}

type PermissionForm = {
  user_id: string
  permission_id: string
  enabled: string
}

async function audit(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  adminId: string,
  action: string,
  targetUser: string,
  meta: Record<string, unknown>
) {
  await supabase.from('permission_audit').insert({
    actor_id: adminId,
    target_user_id: targetUser,
    action,
    meta,
    created_at: new Date().toISOString(),
  })
}

export async function setUserRoleActive(formData: FormData) {
  const admin = await requireAdminServer()
  const supabase = await createSupabaseServerClient()

  const payload: RoleForm = {
    user_id: String(formData.get('user_id')),
    role: String(formData.get('role')),
    active: String(formData.get('active')),
  }

  const isActive = payload.active === 'true'

  const { error } = await supabase
    .from('user_roles')
    .upsert({
      user_id: payload.user_id,
      role: payload.role,
      is_active: isActive,
    })

  if (error) throw new Error(error.message)

  await audit(
    supabase,
    admin.id,
    'role_update',
    payload.user_id,
    { role: payload.role, active: isActive }
  )
}

export async function setUserPermissionOverride(formData: FormData) {
  const admin = await requireAdminServer()
  const supabase = await createSupabaseServerClient()

  const payload: PermissionForm = {
    user_id: String(formData.get('user_id')),
    permission_id: String(formData.get('permission_id')),
    enabled: String(formData.get('enabled')),
  }

  const isEnabled = payload.enabled === 'true'

  if (isEnabled) {
    const { error } = await supabase.from('user_permissions').upsert({
      user_id: payload.user_id,
      permission_id: payload.permission_id,
    })

    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase
      .from('user_permissions')
      .delete()
      .eq('user_id', payload.user_id)
      .eq('permission_id', payload.permission_id)

    if (error) throw new Error(error.message)
  }

  await audit(
    supabase,
    admin.id,
    'permission_override',
    payload.user_id,
    {
      permission_id: payload.permission_id,
      enabled: isEnabled,
    }
  )
}