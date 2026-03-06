'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerActionClient } from '@/lib/supabase/server'

function val(formData: FormData, key: string) {
  const v = formData.get(key)
  return typeof v === 'string' ? v.trim() : ''
}

export async function updateCustomerProfileAction(formData: FormData) {
  const supabase = await createSupabaseServerActionClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const firstName = val(formData, 'first_name')
  const lastName = val(formData, 'last_name')
  const phone = val(formData, 'phone')
  const languageCode = val(formData, 'language_code') || 'sv'

  const { error } = await supabase.from('customer_profiles').upsert(
    {
      user_id: user.id,
      email: user.email ?? null,
      first_name: firstName || null,
      last_name: lastName || null,
      full_name: [firstName, lastName].filter(Boolean).join(' ') || null,
      phone: phone || null,
      language_code: languageCode,
    },
    { onConflict: 'user_id' }
  )

  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/profile')
  revalidatePath('/dashboard')
}

export async function updateCustomerEmailAction(formData: FormData) {
  const supabase = await createSupabaseServerActionClient()
  const email = val(formData, 'email').toLowerCase()
  if (!email) throw new Error('Missing email')

  const { error } = await supabase.auth.updateUser({ email })
  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/profile')
}

export async function updateCustomerPasswordAction(formData: FormData) {
  const supabase = await createSupabaseServerActionClient()
  const password = val(formData, 'password')
  if (!password || password.length < 8) throw new Error('Password must be at least 8 characters')

  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/profile')
}
