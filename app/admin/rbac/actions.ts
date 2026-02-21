'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { logPermissionAudit } from '@/lib/auth/audit'
import { requireAdminRole } from '@/lib/auth/admin'

function str(v: FormDataEntryValue | null): string {
  return typeof v === 'string' ? v.trim() : ''
}

async function requireRbacWrite(actorId: string) {
  const supabase = await createSupabaseServerClient()

  // Legacy: admin-only via admin_users (publish == admin)
  const legacy = await requireAdminRole(supabase).catch(() => null)
  if (legacy?.role === 'admin') return { supabase, actorId }

  // New: permission-based
  const { data: ok, error } = await supabase.rpc('gridex_has_permission', {
    p_user_id: actorId,
    p_permission: 'rbac.manage',
  })

  if (error || ok !== true) {
    throw new Error('Forbidden: missing rbac.manage')
  }

  return { supabase, actorId }
}

/* -------------------------
   Roles
------------------------- */
export async function createRole(formData: FormData) {
  const name = str(formData.get('name'))
  const description = str(formData.get('description')) || null

  if (!name) throw new Error('Missing role name')

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const ctx = await requireRbacWrite(user.id)

  const { error } = await ctx.supabase.from('roles').insert({ name, description })
  if (error) throw new Error(error.message)

  await logPermissionAudit({
    actorId: user.id,
    action: 'rbac.role.create',
    metadata: { name, description },
  })

  revalidatePath('/admin/rbac/roles')
}

export async function toggleRolePermission(formData: FormData) {
  const roleId = str(formData.get('role_id'))
  const permissionId = str(formData.get('permission_id'))
  const enabled = str(formData.get('enabled')) === 'true'

  if (!roleId || !permissionId) throw new Error('Missing role_id/permission_id')

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const ctx = await requireRbacWrite(user.id)

  if (enabled) {
    const { error } = await ctx.supabase
      .from('role_permissions')
      .insert({ role_id: roleId, permission_id: permissionId })
    if (error) throw new Error(error.message)
  } else {
    const { error } = await ctx.supabase
      .from('role_permissions')
      .delete()
      .eq('role_id', roleId)
      .eq('permission_id', permissionId)
    if (error) throw new Error(error.message)
  }

  await logPermissionAudit({
    actorId: user.id,
    action: 'rbac.role_permissions.toggle',
    metadata: { roleId, permissionId, enabled },
  })

  revalidatePath('/admin/rbac/roles')
}

/* -------------------------
   Permissions
------------------------- */
export async function createPermission(formData: FormData) {
  const name = str(formData.get('name'))
  const description = str(formData.get('description')) || null

  if (!name) throw new Error('Missing permission name')

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const ctx = await requireRbacWrite(user.id)

  const { error } = await ctx.supabase.from('permissions').insert({ name, description })
  if (error) throw new Error(error.message)

  await logPermissionAudit({
    actorId: user.id,
    action: 'rbac.permission.create',
    metadata: { name, description },
  })

  revalidatePath('/admin/rbac/permissions')
}

/* -------------------------
   Assignments (user_roles + user_permissions)
   NOTE: you already use user_roles(user_id, role, is_active)
------------------------- */
export async function setUserRoleActive(formData: FormData) {
  const userId = str(formData.get('user_id'))
  const role = str(formData.get('role'))
  const active = str(formData.get('active')) === 'true'

  if (!userId || !role) throw new Error('Missing user_id/role')

  const supabase = await createSupabaseServerClient()
  const {
    data: { user: actor },
  } = await supabase.auth.getUser()
  if (!actor) throw new Error('Unauthorized')

  const ctx = await requireRbacWrite(actor.id)

  // Try update first
  const { data: existing, error: readErr } = await ctx.supabase
    .from('user_roles')
    .select('user_id, role')
    .eq('user_id', userId)
    .eq('role', role)
    .maybeSingle<{ user_id: string; role: string }>()

  if (readErr) throw new Error(readErr.message)

  if (existing) {
    const { error } = await ctx.supabase
      .from('user_roles')
      .update({ is_active: active })
      .eq('user_id', userId)
      .eq('role', role)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await ctx.supabase
      .from('user_roles')
      .insert({ user_id: userId, role, is_active: active })
    if (error) throw new Error(error.message)
  }

  await logPermissionAudit({
    actorId: actor.id,
    action: 'rbac.user_roles.set_active',
    targetUserId: userId,
    metadata: { role, active },
  })

  revalidatePath('/admin/rbac/assignments')
}

export async function setUserPermissionOverride(formData: FormData) {
  const userId = str(formData.get('user_id'))
  const permissionId = str(formData.get('permission_id'))
  const enabled = str(formData.get('enabled')) === 'true'

  if (!userId || !permissionId) throw new Error('Missing user_id/permission_id')

  const supabase = await createSupabaseServerClient()
  const {
    data: { user: actor },
  } = await supabase.auth.getUser()
  if (!actor) throw new Error('Unauthorized')

  const ctx = await requireRbacWrite(actor.id)

  if (enabled) {
    const { error } = await ctx.supabase
      .from('user_permissions')
      .upsert({ user_id: userId, permission_id: permissionId })
    if (error) throw new Error(error.message)
  } else {
    const { error } = await ctx.supabase
      .from('user_permissions')
      .delete()
      .eq('user_id', userId)
      .eq('permission_id', permissionId)
    if (error) throw new Error(error.message)
  }

  await logPermissionAudit({
    actorId: actor.id,
    action: 'rbac.user_permissions.toggle',
    targetUserId: userId,
    metadata: { permissionId, enabled },
  })

  revalidatePath('/admin/rbac/assignments')
}