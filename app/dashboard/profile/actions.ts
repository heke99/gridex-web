'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createSupabaseServerActionClient } from '@/lib/supabase/server'
import { isOpsError, submitOpsCustomerProfileUpdate } from '@/lib/ops/client'
import { opsErrorDetails } from '@/lib/customerPortal/apiErrors'
import { getOpsPortalIdentityForUser } from '@/lib/customerPortal/service'
import { passwordMeetsPolicy, PASSWORD_REQUIREMENT_TEXT } from '@/lib/auth/passwordPolicy'
import { supabaseService } from '@/lib/supabase/service'

function pick(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

function validatePassword(password: string): string | null {
  if (!passwordMeetsPolicy(password)) {
    return PASSWORD_REQUIREMENT_TEXT
  }

  return null
}

export type ProfileFormBaseline = {
  userId: string
  first_name: string
  last_name: string
  phone: string
  language_code: string
}

export async function updateCustomerProfileAction(baseline: ProfileFormBaseline, formData: FormData) {
  const supabase = await createSupabaseServerActionClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Du behöver logga in igen.')
  }

  if (baseline.userId !== user.id) {
    redirect('/dashboard/profile?status=profile-reload')
  }

  const fields = ['first_name', 'last_name', 'phone', 'language_code'] as const
  const profilePayload: Partial<Omit<ProfileFormBaseline, 'userId'>> = {}
  for (const field of fields) {
    if (!formData.has(field)) continue
    const value = pick(formData, field)
    if (value === baseline[field].trim()) continue
    if (!value || (field === 'language_code' && value !== 'sv' && value !== 'en')) {
      redirect(`/dashboard/profile?status=profile-invalid-${field}`)
    }
    profilePayload[field] = value
  }
  if (Object.keys(profilePayload).length === 0) {
    redirect('/dashboard/profile?status=profile-unchanged')
  }

  const operationId = pick(formData, 'client_operation_id')
  if (!/^[0-9a-zA-Z:_-]{8,240}$/.test(operationId)) {
    throw new Error('Åtgärds-ID saknas. Ladda om sidan och försök igen.')
  }
  let profileUpdated = false
  try {
    const identity = await getOpsPortalIdentityForUser(supabase, user)
    const result = await submitOpsCustomerProfileUpdate({
      identity,
      idempotencyKey: operationId,
      profile: profilePayload,
      metadata: { source: 'customer_profile_action' },
    })
    if (!result.ok) throw new Error('Profile update was not accepted.')
    profileUpdated = result.data?.profile_updated === true
  } catch (syncError) {
    if (isOpsError(syncError) && (syncError.status === 400 || syncError.status === 422)) {
      const field = fields.find(name => name === opsErrorDetails(syncError).field)
      redirect(`/dashboard/profile?status=${field ? `profile-invalid-${field}` : 'profile-invalid'}`)
    }
    console.error('[customer profile] canonical update failed', {
      message: syncError instanceof Error ? syncError.message : 'unknown_error',
    })
    revalidatePath('/dashboard/profile')
    revalidatePath('/dashboard')
    redirect('/dashboard/profile?status=profile-sync-failed')
  }

  if (!profileUpdated) {
    revalidatePath('/dashboard/profile')
    redirect('/dashboard/profile?status=profile-pending')
  }

  const { data, error } = await supabaseService.from('customer_profiles')
    .update(profilePayload)
    .eq('user_id', user.id)
    .select('user_id')
    .maybeSingle()

  revalidatePath('/dashboard/profile')
  revalidatePath('/dashboard')
  if (error || !data) {
    console.error('[customer profile] local projection update failed', { code: error?.code ?? 'missing_profile' })
    redirect('/dashboard/profile?status=profile-local-sync-failed')
  }
  redirect('/dashboard/profile?status=profile-updated')
}

export async function updateCustomerEmailAction(formData: FormData) {
  const supabase = await createSupabaseServerActionClient()
  const email = normalizeEmail(pick(formData, 'email'))

  if (!email) {
    throw new Error('Ange en giltig e-postadress.')
  }

  const { error } = await supabase.auth.updateUser({ email })

  if (error) {
    throw new Error('Vi kunde inte spara ändringen just nu. Försök igen om en stund.')
  }

  revalidatePath('/dashboard/profile')
  revalidatePath('/dashboard')
  redirect('/dashboard/profile?status=email-updated')
}

export async function updateCustomerPasswordAction(formData: FormData) {
  const supabase = await createSupabaseServerActionClient()
  const rawPassword = formData.get('password')
  const password = typeof rawPassword === 'string' ? rawPassword : ''

  const passwordError = validatePassword(password)
  if (passwordError) {
    throw new Error(passwordError)
  }

  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    throw new Error('Vi kunde inte spara ändringen just nu. Försök igen om en stund.')
  }

  revalidatePath('/dashboard/profile')
  redirect('/dashboard/profile?status=password-updated')
}
