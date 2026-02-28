'use server'

import { randomBytes } from 'crypto'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function createAgreementAction(formData: FormData) {
  const supabase = await createSupabaseServerClient()

  const email = String(formData.get('email')).toLowerCase()
  const phone = String(formData.get('phone'))
  const contractSlug = String(formData.get('contract_slug'))
  const facilityId = String(formData.get('facility_id'))
  const address = String(formData.get('address'))
  const postalCode = String(formData.get('postal_code'))
  const apartment = String(formData.get('apartment'))
  const signMethod = String(formData.get('sign_method'))

  if (!email || !facilityId) {
    throw new Error('Missing required fields')
  }

  /* =============================
     1️⃣ CREATE USER IF NEEDED
  ============================= */

  const { data: users } = await supabase.auth.admin.listUsers()
  let user = users.users.find((u) => u.email === email)

  if (!user) {
    const tempPassword = randomBytes(8).toString('hex')

    const { data: newUser, error } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    })

    if (error) throw new Error(error.message)
    user = newUser.user!

    await supabase.from('user_profiles').insert({
      user_id: user.id,
      phone,
    })

    // Replace with real email provider later
    console.log('TEMP PASSWORD:', tempPassword)
  }

  /* =============================
     2️⃣ CREATE AGREEMENT
  ============================= */

  const { data: agreement, error } = await supabase
    .from('contract_agreements')
    .insert({
      user_id: user.id,
      contract_slug: contractSlug,
      facility_id: facilityId,
      address,
      postal_code: postalCode,
      apartment,
      email,
      phone,
      sign_method: signMethod,
      status: 'pending_signature',
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  /* =============================
     3️⃣ SIGN FLOW
  ============================= */

  if (signMethod === 'email') {
    const token = randomBytes(32).toString('hex')

    await supabase
      .from('contract_agreements')
      .update({
        email_sign_token: token,
        status: 'email_sent',
      })
      .eq('id', agreement.id)

    console.log('EMAIL SIGN LINK:', `${process.env.NEXT_PUBLIC_SITE_URL}/sign/email/${token}`)
  }

  if (signMethod === 'bankid') {
    await supabase
      .from('contract_agreements')
      .update({
        status: 'bankid_started',
      })
      .eq('id', agreement.id)

    // TODO: call BankID API here
  }

  return agreement.id
}