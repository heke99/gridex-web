'use server'

import { revalidatePath } from 'next/cache'
import { supabaseService } from '@/lib/supabase/service'
import { requireGlobalAdminActionAccess } from '@/lib/admin/guards'
import { logPermissionAudit } from '@/lib/auth/audit'
import { setGlobalUserRole } from '@/lib/admin/roleAssignments'

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

function str(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : ''
}

async function requireAssignmentsWrite() {
  const ctx = await requireGlobalAdminActionAccess({
    anyOf: ['rbac.write'],
  })

  return ctx
}

/* ------------------------------------------
   CREATE USER (ENTERPRISE)
------------------------------------------ */

export async function createUserWithRole(formData: FormData) {
  const ctx = await requireGlobalAdminActionAccess({ allOf: ['rbac.write', 'users.write'] })

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

  await setGlobalUserRole(supabaseService, {
    userId, role: payload.role, active: true, actorId: ctx.userId,
  })

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
  const supabase = supabaseService

  const userId = str(formData.get('user_id'))

  if (!userId) {
    throw new Error('Missing user_id')
  }

  const { error } = await supabase
    .from('user_roles')
    .update({ is_active: false })
    .eq('user_id', userId)
    .is('company_id', null)

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
  const supabase = supabaseService

  const payload: RoleForm = {
    user_id: str(formData.get('user_id')),
    role: str(formData.get('role')),
    active: str(formData.get('active')),
  }

  if (!payload.user_id || !payload.role) {
    throw new Error('Missing user_id/role')
  }

  const isActive = payload.active === 'true'

  await setGlobalUserRole(supabase, {
    userId: payload.user_id, role: payload.role, active: isActive, actorId: ctx.userId,
  })

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
  const supabase = supabaseService

  const payload: PermissionForm = {
    user_id: str(formData.get('user_id')),
    permission_id: str(formData.get('permission_id')),
    enabled: str(formData.get('enabled')),
  }

  if (!payload.user_id || !payload.permission_id) {
    throw new Error('Missing user_id/permission_id')
  }

  const isEnabled = payload.enabled === 'true'

  // The direct-grant PK omits company_id. A NULL-scope upsert would overwrite
  // an existing company grant. The RPC preserves scoped rows and serializes
  // canonical global overrides, including superseding a legacy global deny.
  const { error } = await supabase.rpc('gridex_web_set_global_permission_override', {
    p_actor_id: ctx.userId,
    p_user_id: payload.user_id,
    p_permission_id: payload.permission_id,
    p_effect: isEnabled ? 'allow' : 'deny',
  })
  if (error) throw new Error(error.message)

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
