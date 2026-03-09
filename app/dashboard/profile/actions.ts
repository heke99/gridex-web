'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerActionClient } from '@/lib/supabase/server'

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
    throw new Error('Unauthorized')
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
    throw new Error(error.message)
  }

  revalidatePath('/dashboard/profile')
  revalidatePath('/dashboard')
}

export async function updateCustomerEmailAction(formData: FormData) {
  const supabase = await createSupabaseServerActionClient()
  const email = normalizeEmail(pick(formData, 'email'))

  if (!email) {
    throw new Error('Missing email')
  }

  const { error } = await supabase.auth.updateUser({ email })

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/dashboard/profile')
  revalidatePath('/dashboard')
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
    throw new Error(error.message)
  }

  revalidatePath('/dashboard/profile')
}