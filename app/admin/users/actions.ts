'use server'

import { revalidatePath } from 'next/cache'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
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

function targetUserId(formData: FormData): string {
  const value = String(formData.get('user_id') ?? '').trim()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error('Invalid user_id')
  }
  return value
}

function activeFlag(formData: FormData): boolean {
  const value = formData.get('is_active')
  if (value !== 'true' && value !== 'false') throw new Error('Invalid is_active')
  return value === 'true'
}

type GlobalRole = { id: string; status: string | null; is_active: boolean | null }

async function setGlobalRole(service: SupabaseClient, userId: string, role: AdminUserRole, active: boolean) {
  const payload = { user_id: userId, role, company_id: null, status: active ? 'active' : 'inactive', is_active: active }
  const existingRole = async () => {
    const { data, error } = await service.from('user_roles').select('id,status,is_active')
      .eq('user_id', userId).eq('role', role).is('company_id', null).returns<GlobalRole[]>()
    if (error) throw new Error(error.message)
    return data?.find(row => row.is_active !== false && (!row.status || row.status === 'active')) ?? data?.[0]
  }
  const updateRole = async (existing: GlobalRole) => {
    const { data, error } = await service.from('user_roles').update(payload).eq('id', existing.id)
      .eq('user_id', userId).is('company_id', null).select('id').single()
    if (error || !data) throw new Error(error?.message ?? 'Role update was not persisted')
  }
  const existing = await existingRole()
  if (existing) return updateRole(existing)
  const { error } = await service.from('user_roles').insert(payload)
  if (!error) return
  // The live schema has company-scoped partial unique indexes, not UNIQUE(user_id,role).
  // A simultaneous global-role insert may win; only that same global role can be retried.
  if (error.code === '23505') {
    const concurrent = await existingRole()
    if (concurrent) return updateRole(concurrent)
  }
  throw new Error(error.message)
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
  const { data: ok, error } = await supabase.rpc('gridex_my_has_permission_v1', {
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
 * - Upsert user_profiles (full_name, user_status=active)
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

  try {
    const { error: profileError } = await service
    .from('user_profiles')
    .upsert(
      {
        id: newUser.id,
        user_id: newUser.id,
        full_name: fullName || null,
        user_status: 'active',
      },
      { onConflict: 'id' }
    )

    if (profileError) throw new Error(profileError.message)
    await setGlobalRole(service, newUser.id, role, true)
  } catch (error) {
    // This ID comes only from the successful create above; never delete an input/actor ID.
    const { error: rollbackError } = await service.auth.admin.deleteUser(newUser.id)
    if (rollbackError) throw new Error('Account initialization failed and its new Auth account could not be removed.')
    throw error
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
  const userId = targetUserId(formData)
  const is_active = activeFlag(formData)
  if (userId === actor.id && !is_active) throw new Error('You cannot deactivate your own account')
  const service = getServiceClient()
  const { data: previous, error: readError } = await service.auth.admin.getUserById(userId)
  if (readError || !previous.user) throw new Error(readError?.message ?? 'User not found')
  const { error: authError } = await service.auth.admin.updateUserById(userId, {
    ban_duration: is_active ? 'none' : '876000h',
  })
  if (authError) throw new Error(authError.message)
  const { error: profileError } = await service.from('user_profiles').upsert(
    { id: userId, user_id: userId, user_status: is_active ? 'active' : 'inactive' }, { onConflict: 'id' },
  )
  if (profileError) {
    const bannedUntil = (previous.user as { banned_until?: string }).banned_until
    const remaining = bannedUntil ? Date.parse(bannedUntil) - Date.now() : 0
    const { error: rollbackError } = await service.auth.admin.updateUserById(userId, {
      ban_duration: Number.isFinite(remaining) && remaining > 0 ? `${Math.ceil(remaining / 1000)}s` : 'none',
    })
    if (rollbackError) throw new Error('Profile update failed and the previous Auth activation state could not be restored.')
    throw new Error(profileError.message)
  }

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

  const userId = targetUserId(formData)
  const role = normRole(formData.get('role'))
  const is_active = activeFlag(formData)
  if (userId === actor.id && role === 'admin' && !is_active) throw new Error('You cannot remove your own administrator role')
  await setGlobalRole(service, userId, role, is_active)

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

  const userId = targetUserId(formData)
  const newPassword = String(formData.get('new_password') || '').trim()

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
