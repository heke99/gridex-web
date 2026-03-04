'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { supabaseService } from '@/lib/supabase/service'
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

type CreateUserForm = {
  email: string
  full_name: string
  phone: string
  role: string
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

/* ------------------------------------------
   CREATE USER (ENTERPRISE)
------------------------------------------ */

export async function createUserWithRole(formData: FormData) {
  const admin = await requireAdminServer()

  const payload: CreateUserForm = {
    email: String(formData.get('email')),
    full_name: String(formData.get('full_name')),
    phone: String(formData.get('phone') ?? ''),
    role: String(formData.get('role')),
  }

  if (!payload.email || !payload.role) {
    throw new Error('Missing required fields')
  }

  const { data: created, error } =
    await supabaseService.auth.admin.createUser({
      email: payload.email,
      email_confirm: true,
      user_metadata: { full_name: payload.full_name },
    })

  if (error || !created.user) {
    throw new Error(error?.message ?? 'User creation failed')
  }

  const userId = created.user.id

  await supabaseService.from('user_profiles').insert({
    id: userId,
    full_name: payload.full_name,
    phone: payload.phone,
  })

  await supabaseService.from('user_roles').insert({
    user_id: userId,
    role: payload.role,
    is_active: true,
  })

  const supabase = await createSupabaseServerClient()

  await audit(supabase, admin.id, 'user_created', userId, {
    role: payload.role,
    email: payload.email,
  })
}

/* ------------------------------------------
   DEACTIVATE USER (NEW)
------------------------------------------ */

export async function deactivateUser(formData: FormData) {
  const admin = await requireAdminServer()
  const supabase = await createSupabaseServerClient()

  const userId = String(formData.get('user_id'))

  if (!userId) {
    throw new Error('Missing user_id')
  }

  const { error } = await supabase
    .from('user_roles')
    .update({ is_active: false })
    .eq('user_id', userId)

  if (error) throw new Error(error.message)

  await audit(supabase, admin.id, 'user_deactivated', userId, {
    reason: 'admin_action',
  })
}

/* ------------------------------------------
   ROLE UPDATE
------------------------------------------ */

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

  await audit(supabase, admin.id, 'role_update', payload.user_id, {
    role: payload.role,
    active: isActive,
  })
}

/* ------------------------------------------
   PERMISSION OVERRIDE
------------------------------------------ */

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