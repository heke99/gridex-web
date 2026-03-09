'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { logPermissionAudit } from '@/lib/auth/audit'
import { requireAdminActionAccess } from '@/lib/admin/guards'

function str(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : ''
}

async function requireRbacWrite() {
  const ctx = await requireAdminActionAccess({
    anyOf: ['rbac.write', 'admin.access'],
  })

  const supabase = await createSupabaseServerClient()

  return { ctx, supabase }
}

/* -------------------------
   Roles
------------------------- */
export async function createRole(formData: FormData) {
  const name = str(formData.get('name'))
  const description = str(formData.get('description')) || null

  if (!name) {
    throw new Error('Missing role name')
  }

  const { ctx, supabase } = await requireRbacWrite()

  const { error } = await supabase
    .from('roles')
    .insert({ name, description })

  if (error) {
    throw new Error(error.message)
  }

  await logPermissionAudit({
    actorId: ctx.userId,
    action: 'rbac.role.create',
    metadata: { name, description },
  }).catch(() => null)

  revalidatePath('/admin/rbac')
  revalidatePath('/admin/rbac/roles')
  revalidatePath('/admin/rbac/assignments')
}

export async function toggleRolePermission(formData: FormData) {
  const roleId = str(formData.get('role_id'))
  const permissionId = str(formData.get('permission_id'))
  const enabled = str(formData.get('enabled')) === 'true'

  if (!roleId || !permissionId) {
    throw new Error('Missing role_id/permission_id')
  }

  const { ctx, supabase } = await requireRbacWrite()

  if (enabled) {
    const { error } = await supabase
      .from('role_permissions')
      .upsert({
        role_id: roleId,
        permission_id: permissionId,
      })

    if (error) {
      throw new Error(error.message)
    }
  } else {
    const { error } = await supabase
      .from('role_permissions')
      .delete()
      .eq('role_id', roleId)
      .eq('permission_id', permissionId)

    if (error) {
      throw new Error(error.message)
    }
  }

  await logPermissionAudit({
    actorId: ctx.userId,
    action: 'rbac.role_permissions.toggle',
    metadata: { roleId, permissionId, enabled },
  }).catch(() => null)

  revalidatePath('/admin/rbac')
  revalidatePath('/admin/rbac/roles')
  revalidatePath('/admin/rbac/assignments')
}

/* -------------------------
   Permissions
------------------------- */
export async function createPermission(formData: FormData) {
  const name = str(formData.get('name'))
  const description = str(formData.get('description')) || null

  if (!name) {
    throw new Error('Missing permission name')
  }

  const { ctx, supabase } = await requireRbacWrite()

  const { error } = await supabase
    .from('permissions')
    .insert({ name, description })

  if (error) {
    throw new Error(error.message)
  }

  await logPermissionAudit({
    actorId: ctx.userId,
    action: 'rbac.permission.create',
    metadata: { name, description },
  }).catch(() => null)

  revalidatePath('/admin/rbac')
  revalidatePath('/admin/rbac/permissions')
  revalidatePath('/admin/rbac/assignments')
}