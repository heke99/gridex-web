'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireAdminRole } from '@/lib/auth/admin'
import { logPermissionAudit } from '@/lib/auth/audit'

export type AdminUserRole = 'admin' | 'support' | 'partner' | 'customer'

function normRole(v: unknown): AdminUserRole {
  const s = String(v ?? '').trim()
  if (s === 'admin' || s === 'support' || s === 'partner' || s === 'customer') return s
  return 'customer'
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL')

  return createClient(url, key, { auth: { persistSession: false } })
}

async function requireAdminAccess() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  // Legacy: admin_users
  const legacy = await requireAdminRole(supabase).catch(() => null)
  if (legacy?.role === 'admin') return { user, supabase, mode: 'legacy' as const }

  // New: permission admin.access
  const { data: ok, error } = await supabase.rpc('gridex_has_permission', {
    p_user_id: user.id,
    p_permission: 'admin.access',
  })

  if (error || ok !== true) {
    throw new Error('Forbidden: missing admin.access')
  }

  return { user, supabase, mode: 'permission' as const }
}

/**
 * Create a user that is "approved directly":
 * - Create Supabase Auth user via service role (Admin API)
 * - Upsert user_profiles (full_name, is_active=true)
 * - Insert user_roles (role, is_active=true) if provided
 * - Audit log (permission_audit)
 */
export async function createUser(formData: FormData) {
  const { user: actor } = await requireAdminAccess()
  const service = getServiceClient()

  const fullName = String(formData.get('full_name') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const tempPassword = String(formData.get('temp_password') ?? '').trim()
  const role = normRole(formData.get('role'))

  if (!email) throw new Error('Missing email')
  if (!tempPassword || tempPassword.length < 8) throw new Error('Temporary password must be at least 8 characters')

  // 1) Create auth user (email confirmed = true, so they can log in immediately)
  const { data: created, error: cErr } = await service.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: fullName ? { full_name: fullName } : undefined,
  })

  if (cErr) throw new Error(cErr.message)
  const newUser = created.user
  if (!newUser) throw new Error('Failed to create auth user')

  // 2) Upsert profile (if table exists/columns exist)
  // Keep it safe: try insert/update, ignore missing-column errors.
  await service
    .from('user_profiles')
    .upsert(
      {
        id: newUser.id,
        full_name: fullName || null,
        is_active: true,
      },
      { onConflict: 'id' }
    )

  // 3) Role assignment (user_roles)
  if (role) {
    await service.from('user_roles').upsert(
      {
        user_id: newUser.id,
        role,
        is_active: true,
      },
      { onConflict: 'user_id,role' }
    )
  }

  await logPermissionAudit({
    actorId: actor.id,
    action: 'admin.user.create',
    targetUserId: newUser.id,
    metadata: { email, fullName, role },
  })

  revalidatePath('/admin/users')
}

/**
 * Toggle active (profile + user_roles rows remain)
 */
export async function setUserActive(formData: FormData) {
  const { user: actor } = await requireAdminAccess()
  const service = getServiceClient()

  const userId = String(formData.get('user_id') || '')
  const isActiveStr = String(formData.get('is_active') || 'true')
  const is_active = isActiveStr === 'true'

  if (!userId) throw new Error('Missing user_id')

  await service.from('user_profiles').upsert(
    { id: userId, is_active },
    { onConflict: 'id' }
  )

  await logPermissionAudit({
    actorId: actor.id,
    action: 'admin.user.set_active',
    targetUserId: userId,
    metadata: { is_active },
  })

  revalidatePath('/admin/users')
}

/**
 * Set (or add) a role for a user in user_roles.
 * This does NOT delete other roles — enterprise safe.
 */
export async function setUserRole(formData: FormData) {
  const { user: actor } = await requireAdminAccess()
  const service = getServiceClient()

  const userId = String(formData.get('user_id') || '')
  const role = normRole(formData.get('role'))
  const isActiveStr = String(formData.get('is_active') || 'true')
  const is_active = isActiveStr === 'true'

  if (!userId) throw new Error('Missing user_id')

  const { error } = await service.from('user_roles').upsert(
    { user_id: userId, role, is_active },
    { onConflict: 'user_id,role' }
  )

  if (error) throw new Error(error.message)

  await logPermissionAudit({
    actorId: actor.id,
    action: 'admin.user.set_role',
    targetUserId: userId,
    metadata: { role, is_active },
  })

  revalidatePath('/admin/users')
}

/**
 * Reset password (service role Admin API)
 * - User can still use "Forgot password" later
 */
export async function resetUserPassword(formData: FormData) {
  const { user: actor } = await requireAdminAccess()
  const service = getServiceClient()

  const userId = String(formData.get('user_id') || '')
  const newPassword = String(formData.get('new_password') || '').trim()

  if (!userId) throw new Error('Missing user_id')
  if (!newPassword || newPassword.length < 8) throw new Error('Password must be at least 8 characters')

  const { error } = await service.auth.admin.updateUserById(userId, { password: newPassword })
  if (error) throw new Error(error.message)

  await logPermissionAudit({
    actorId: actor.id,
    action: 'admin.user.reset_password',
    targetUserId: userId,
    metadata: { via: 'admin' },
  })

  revalidatePath('/admin/users')
}