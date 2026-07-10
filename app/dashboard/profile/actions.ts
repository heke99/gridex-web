'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createSupabaseServerActionClient } from '@/lib/supabase/server'
import { isTransientOpsError, submitOpsCustomerProfileUpdate } from '@/lib/ops/client'
import { enqueuePortalWrite } from '@/lib/customerPortal/outbox'
import { getOpsPortalIdentityForUser } from '@/lib/customerPortal/service'

function pick(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

function validatePassword(password: string): string | null {
  if (!password || password.length < 8) {
    return 'Lösenordet måste vara minst 8 tecken.'
  }

  return null
}

export async function updateCustomerProfileAction(formData: FormData) {
  const supabase = await createSupabaseServerActionClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Du behöver logga in igen.')
  }

  const firstName = pick(formData, 'first_name')
  const lastName = pick(formData, 'last_name')
  const phone = pick(formData, 'phone')
  const languageCode = pick(formData, 'language_code') || 'sv'

  const fullName = [firstName, lastName].filter(Boolean).join(' ') || null

  const { error } = await supabase.from('customer_profiles').upsert(
    {
      user_id: user.id,
      email: user.email ?? null,
      first_name: firstName || null,
      last_name: lastName || null,
      full_name: fullName,
      phone: phone || null,
      language_code: languageCode,
    },
    { onConflict: 'user_id' }
  )

  if (error) {
    throw new Error('Vi kunde inte spara ändringen just nu. Försök igen om en stund.')
  }

  const profilePayload = {
    first_name: firstName || null,
    last_name: lastName || null,
    phone: phone || null,
    language_code: languageCode,
  }
  const operationId = randomUUID()
  let queued = false
  try {
    const identity = await getOpsPortalIdentityForUser(supabase, user)
    try {
      await submitOpsCustomerProfileUpdate({
        identity,
        idempotencyKey: operationId,
        profile: profilePayload,
        metadata: { source: 'customer_profile_action' },
      })
    } catch (syncError) {
      if (!isTransientOpsError(syncError)) throw syncError
      await enqueuePortalWrite({
        userId: user.id,
        operationType: 'profile_update',
        idempotencyKey: `profile-update:${user.id}:${operationId}`,
        identity,
        payload: {
          operation_id: operationId,
          profile: profilePayload,
          metadata: { source: 'customer_profile_action' },
        },
      })
      queued = true
    }
  } catch (syncError) {
    console.error('[customer profile] OPS sync failed permanently', syncError)
    revalidatePath('/dashboard/profile')
    revalidatePath('/dashboard')
    redirect('/dashboard/profile?status=profile-local-only')
  }

  revalidatePath('/dashboard/profile')
  revalidatePath('/dashboard')
  redirect(`/dashboard/profile?status=${queued ? 'profile-sync-queued' : 'profile-updated'}`)
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
  const password = pick(formData, 'password')

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