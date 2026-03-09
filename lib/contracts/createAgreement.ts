'use server'

import { randomBytes } from 'crypto'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { supabaseService } from '@/lib/supabase/service'

function normalizeEmail(value: FormDataEntryValue | null): string {
  return String(value || '').trim().toLowerCase()
}

function normalizeText(value: FormDataEntryValue | null): string {
  return String(value || '').trim()
}

async function ensureUserProfile(params: {
  userId: string
  email: string
  phone?: string | null
}) {
  const { userId, email, phone } = params

  const payload = {
    id: userId,
    user_id: userId,
    email,
    phone: phone?.trim() || null,
  }

  const { error } = await supabaseService
    .from('user_profiles')
    .upsert(payload, { onConflict: 'id' })

  if (error) {
    throw new Error(`Failed to sync user profile: ${error.message}`)
  }
}

async function findUserByEmail(email: string) {
  const { data, error } = await supabaseService.auth.admin.listUsers()

  if (error) {
    throw new Error(`Failed to list users: ${error.message}`)
  }

  return data.users.find((u) => u.email?.toLowerCase() === email) ?? null
}

async function ensureUser(params: { email: string; phone?: string | null }) {
  const { email, phone } = params

  const existingUser = await findUserByEmail(email)

  if (existingUser) {
    await ensureUserProfile({
      userId: existingUser.id,
      email,
      phone,
    })

    return {
      userId: existingUser.id,
      created: false,
      tempPassword: null as string | null,
    }
  }

  const tempPassword = randomBytes(16).toString('hex')

  const { data: newUserData, error: createError } =
    await supabaseService.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    })

  if (createError || !newUserData.user?.id) {
    throw new Error(createError?.message || 'Failed to create user')
  }

  await ensureUserProfile({
    userId: newUserData.user.id,
    email,
    phone,
  })

  return {
    userId: newUserData.user.id,
    created: true,
    tempPassword,
  }
}

export async function createAgreementAction(formData: FormData) {
  const supabase = await createSupabaseServerClient()

  const email = normalizeEmail(formData.get('email'))
  const phone = normalizeText(formData.get('phone'))
  const contractSlug = normalizeText(formData.get('contract_slug'))
  const facilityId = normalizeText(formData.get('facility_id'))
  const address = normalizeText(formData.get('address'))
  const postalCode = normalizeText(formData.get('postal_code'))
  const apartment = normalizeText(formData.get('apartment'))
  const signMethod = normalizeText(formData.get('sign_method')) || 'email'

  if (!email || !facilityId || !contractSlug) {
    throw new Error('Missing required fields')
  }

  const { userId, created, tempPassword } = await ensureUser({
    email,
    phone,
  })

  const agreementInsert = {
    user_id: userId,
    contract_slug: contractSlug,
    facility_id: facilityId,
    address: address || null,
    postal_code: postalCode || null,
    apartment: apartment || null,
    email,
    phone: phone || null,
    sign_method: signMethod,
    status: 'pending_signature',
  }

  const { data: agreement, error: agreementError } = await supabase
    .from('contract_agreements')
    .insert(agreementInsert)
    .select('id')
    .single()

  if (agreementError || !agreement?.id) {
    throw new Error(agreementError?.message || 'Failed to create agreement')
  }

  if (signMethod === 'email') {
    const token = randomBytes(32).toString('hex')

    const { error: updateError } = await supabase
      .from('contract_agreements')
      .update({
        email_sign_token: token,
        status: 'email_sent',
      })
      .eq('id', agreement.id)

    if (updateError) {
      throw new Error(updateError.message)
    }

    console.log(
      'EMAIL SIGN LINK:',
      `${process.env.NEXT_PUBLIC_SITE_URL}/sign/email/${token}`
    )
  }

  if (signMethod === 'bankid') {
    const { error: updateError } = await supabase
      .from('contract_agreements')
      .update({
        status: 'bankid_started',
      })
      .eq('id', agreement.id)

    if (updateError) {
      throw new Error(updateError.message)
    }

    // TODO: call BankID API here
  }

  if (created && tempPassword) {
    console.log('TEMP PASSWORD:', tempPassword)
  }

  return agreement.id
}