'use server'

import { requireAdminActionAccess } from '@/lib/admin/guards'
import { logPermissionAudit } from '@/lib/auth/audit'

function pick(form: FormData, key: string): string {
  const v = form.get(key)
  return typeof v === 'string' ? v.trim() : ''
}

export async function updateAccountName(formData: FormData) {
  const ctx = await requireAdminActionAccess({ anyOf: ['admin.access'] })
  const supabase = ctx.supabase

  const fullName = pick(formData, 'full_name')
  if (!fullName) throw new Error('Missing full_name')

  const { error } = await supabase
    .from('user_profiles')
    .upsert(
      {
        id: ctx.userId,
        full_name: fullName,
      },
      { onConflict: 'id' }
    )

  if (error) throw new Error(error.message)

  await logPermissionAudit({
    actorId: ctx.userId,
    action: 'account.name.update',
    targetUserId: ctx.userId,
    metadata: { full_name: fullName },
  })
}

export async function updateAccountEmail(formData: FormData) {
  const ctx = await requireAdminActionAccess({ anyOf: ['admin.access'] })
  const supabase = ctx.supabase

  const email = pick(formData, 'email')
  if (!email) throw new Error('Missing email')

  const { error } = await supabase.auth.updateUser({ email })

  if (error) throw new Error(error.message)

  await logPermissionAudit({
    actorId: ctx.userId,
    action: 'account.email.update',
    targetUserId: ctx.userId,
    metadata: { email },
  })
}

export async function updateAccountPassword(formData: FormData) {
  const ctx = await requireAdminActionAccess({ anyOf: ['admin.access'] })
  const supabase = ctx.supabase

  const password = pick(formData, 'password')

  if (!password) throw new Error('Missing password')
  if (password.length < 8)
    throw new Error('Password must be at least 8 characters')

  const { error } = await supabase.auth.updateUser({ password })

  if (error) throw new Error(error.message)

  await logPermissionAudit({
    actorId: ctx.userId,
    action: 'account.password.update',
    targetUserId: ctx.userId,
    metadata: { changed: true },
  })
}