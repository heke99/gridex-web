'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { supabaseService } from '@/lib/supabase/service'
import { requireAdminActionAccess } from '@/lib/admin/guards'
import { logPermissionAudit } from '@/lib/auth/audit'

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

type ExistingUserRoleRow = {
  user_id: string
  role: string
}

function str(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : ''
}

async function requireAssignmentsWrite() {
  const ctx = await requireAdminActionAccess({
    anyOf: ['rbac.write', 'admin.access'],
  })

  return ctx
}

/* ------------------------------------------
   CREATE USER (ENTERPRISE)
------------------------------------------ */

export async function createUserWithRole(formData: FormData) {
  const ctx = await requireAssignmentsWrite()

  const payload: CreateUserForm = {
    email: str(formData.get('email')),
    full_name: str(formData.get('full_name')),
    phone: str(formData.get('phone')),
    role: str(formData.get('role')),
  }

  if (!payload.email || !payload.role) {
    throw new Error('Missing required fields')
  }

  const { data: created, error: createError } =
    await supabaseService.auth.admin.createUser({
      email: payload.email,
      email_confirm: true,
      user_metadata: {
        full_name: payload.full_name,
      },
    })

  if (createError || !created.user) {
    throw new Error(createError?.message ?? 'User creation failed')
  }

  const userId = created.user.id

  const { error: profileError } = await supabaseService
    .from('user_profiles')
    .upsert({
      id: userId,
      full_name: payload.full_name || null,
      phone: payload.phone || null,
    })

  if (profileError) {
    throw new Error(profileError.message)
  }

  const { error: roleError } = await supabaseService
    .from('user_roles')
    .upsert({
      user_id: userId,
      role: payload.role,
      is_active: true,
    })

  if (roleError) {
    throw new Error(roleError.message)
  }

  await logPermissionAudit({
    actorId: ctx.userId,
    action: 'rbac.user.create',
    targetUserId: userId,
    metadata: {
      email: payload.email,
      full_name: payload.full_name,
      phone: payload.phone,
      role: payload.role,
    },
  }).catch(() => null)

  revalidatePath('/admin/rbac')
  revalidatePath('/admin/rbac/assignments')
}

/* ------------------------------------------
   DEACTIVATE USER
------------------------------------------ */

export async function deactivateUser(formData: FormData) {
  const ctx = await requireAssignmentsWrite()
  const supabase = await createSupabaseServerClient()

  const userId = str(formData.get('user_id'))

  if (!userId) {
    throw new Error('Missing user_id')
  }

  const { error } = await supabase
    .from('user_roles')
    .update({ is_active: false })
    .eq('user_id', userId)

  if (error) {
    throw new Error(error.message)
  }

  await logPermissionAudit({
    actorId: ctx.userId,
    action: 'rbac.user.deactivate',
    targetUserId: userId,
    metadata: {
      reason: 'admin_action',
    },
  }).catch(() => null)

  revalidatePath('/admin/rbac')
  revalidatePath('/admin/rbac/assignments')
}

/* ------------------------------------------
   ROLE UPDATE
------------------------------------------ */

export async function setUserRoleActive(formData: FormData) {
  const ctx = await requireAssignmentsWrite()
  const supabase = await createSupabaseServerClient()

  const payload: RoleForm = {
    user_id: str(formData.get('user_id')),
    role: str(formData.get('role')),
    active: str(formData.get('active')),
  }

  if (!payload.user_id || !payload.role) {
    throw new Error('Missing user_id/role')
  }

  const isActive = payload.active === 'true'

  const { data: existing, error: readError } = await supabase
    .from('user_roles')
    .select('user_id,role')
    .eq('user_id', payload.user_id)
    .eq('role', payload.role)
    .maybeSingle<ExistingUserRoleRow>()

  if (readError) {
    throw new Error(readError.message)
  }

  if (existing) {
    const { error } = await supabase
      .from('user_roles')
      .update({ is_active: isActive })
      .eq('user_id', payload.user_id)
      .eq('role', payload.role)

    if (error) {
      throw new Error(error.message)
    }
  } else {
    const { error } = await supabase
      .from('user_roles')
      .insert({
        user_id: payload.user_id,
        role: payload.role,
        is_active: isActive,
      })

    if (error) {
      throw new Error(error.message)
    }
  }

  await logPermissionAudit({
    actorId: ctx.userId,
    action: 'rbac.user_roles.set_active',
    targetUserId: payload.user_id,
    metadata: {
      role: payload.role,
      active: isActive,
    },
  }).catch(() => null)

  revalidatePath('/admin/rbac')
  revalidatePath('/admin/rbac/assignments')
}

/* ------------------------------------------
   PERMISSION OVERRIDE
------------------------------------------ */

export async function setUserPermissionOverride(formData: FormData) {
  const ctx = await requireAssignmentsWrite()
  const supabase = await createSupabaseServerClient()

  const payload: PermissionForm = {
    user_id: str(formData.get('user_id')),
    permission_id: str(formData.get('permission_id')),
    enabled: str(formData.get('enabled')),
  }

  if (!payload.user_id || !payload.permission_id) {
    throw new Error('Missing user_id/permission_id')
  }

  const isEnabled = payload.enabled === 'true'

  if (isEnabled) {
    const { error } = await supabase
      .from('user_permissions')
      .upsert({
        user_id: payload.user_id,
        permission_id: payload.permission_id,
      })

    if (error) {
      throw new Error(error.message)
    }
  } else {
    const { error } = await supabase
      .from('user_permissions')
      .delete()
      .eq('user_id', payload.user_id)
      .eq('permission_id', payload.permission_id)

    if (error) {
      throw new Error(error.message)
    }
  }

  await logPermissionAudit({
    actorId: ctx.userId,
    action: 'rbac.user_permissions.toggle',
    targetUserId: payload.user_id,
    metadata: {
      permissionId: payload.permission_id,
      enabled: isEnabled,
    },
  }).catch(() => null)

  revalidatePath('/admin/rbac')
  revalidatePath('/admin/rbac/assignments')
}