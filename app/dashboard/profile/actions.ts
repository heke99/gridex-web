'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createSupabaseServerActionClient } from '@/lib/supabase/server'
import { enqueuePortalWrite } from '@/lib/customerPortal/outbox'
import { isOpsError, submitOpsCustomerProfileUpdate, type OpsPortalIdentity } from '@/lib/ops/client'
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
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('Du behöver logga in igen.')
  }

  const firstName = pick(formData, 'first_name')
  const lastName = pick(formData, 'last_name')
  const phone = pick(formData, 'phone')
  const languageCode = pick(formData, 'language_code') || 'sv'

  const profilePayload = {
    first_name: firstName,
    last_name: lastName,
    phone,
    language_code: languageCode,
  }
  const operationId = pick(formData, 'client_operation_id')
  if (!/^[0-9a-zA-Z:_-]{8,240}$/.test(operationId)) {
    throw new Error('Åtgärds-ID saknas. Ladda om sidan och försök igen.')
  }
  let result: Awaited<ReturnType<typeof submitOpsCustomerProfileUpdate>>
  let identity: OpsPortalIdentity | null = null
  let queued = false
  try {
    identity = await getOpsPortalIdentityForUser(supabase, user)
    result = await submitOpsCustomerProfileUpdate({
      identity,
      idempotencyKey: operationId,
      profile: profilePayload,
      metadata: { source: 'customer_profile_action' },
    })
  } catch (syncError) {
    console.error('[customer profile] canonical update failed', {
      message: syncError instanceof Error ? syncError.message : 'unknown_error',
    })
    if (identity && isOpsError(syncError) && syncError.retryable !== false &&
      (syncError.status >= 500 || syncError.status === 408 || syncError.status === 429)
    ) {
      try {
        await enqueuePortalWrite({
          userId: user.id, operationType: 'profile_update',
          idempotencyKey: `profile-update:${user.id}:${operationId}`,
          identity,
          payload: { operation_id: operationId, profile: profilePayload,
            metadata: { source: 'customer_profile_action' } },
        })
        queued = true
      } catch (queueError) {
        console.error('[customer profile] exact retry could not be retained', {
          message: queueError instanceof Error ? queueError.message : 'unknown_error',
        })
      }
    }
    revalidatePath('/dashboard/profile')
    revalidatePath('/dashboard')
    redirect(`/dashboard/profile?status=${queued ? 'profile-queued' : 'profile-sync-failed'}`)
  }

  // A successful HTTP response may only confirm staff intake. The explicit
  // application flag decides whether OPS has confirmed the profile change.
  if (!result.ok || !['accepted', 'submitted'].includes(result.status ?? '')) {
    revalidatePath('/dashboard/profile')
    redirect('/dashboard/profile?status=profile-sync-failed')
  }
  if (result.data?.profile_updated !== true) {
    revalidatePath('/dashboard/profile')
    redirect('/dashboard/profile?status=profile-received')
  }

  // OPS owns the profile. Submitted browser values are not a canonical readback
  // and must never be written as a current local OPS projection.

  revalidatePath('/dashboard/profile')
  revalidatePath('/dashboard')
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
