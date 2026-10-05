'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getOpsPortalIdentityForUser, getPortalSession } from '@/lib/customerPortal/service'
import { createOpsCustomerSupportCase, sendOpsCustomerSupportMessage } from '@/lib/ops/client/customerSupport'
import { checkRateLimit } from '@/lib/security/rateLimit'

function pick(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function requestId(formData: FormData): string {
  const value = pick(formData, 'client_request_id')
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error('Vi kunde inte skicka ärendet just nu. Försök igen.')
  }
  return value
}

export async function createSupportTicketAction(formData: FormData) {
  const { supabase, user } = await getPortalSession()
  const rate = await checkRateLimit(`support-ticket:${user.id}`, { limit: 10, windowMs: 15 * 60 * 1000 })
  if (!rate.allowed) throw new Error('För många ärenden på kort tid. Vänta en stund och försök igen.')

  const title = pick(formData, 'subject')
  const message = pick(formData, 'description')
  const category = pick(formData, 'category') || 'general'
  if (!title || !message) throw new Error('Ange ämne och beskrivning.')
  const intentId = requestId(formData)
  const identity = await getOpsPortalIdentityForUser(supabase, user)
  await createOpsCustomerSupportCase(identity, { title, message, category }, `portal-support-create:${user.id}:${intentId}`)

  revalidatePath('/dashboard/support')
  revalidatePath('/dashboard')
  redirect('/dashboard/support?status=created')
}

export async function addSupportMessageAction(formData: FormData) {
  const { supabase, user } = await getPortalSession()
  const rate = await checkRateLimit(`support-reply:${user.id}`, { limit: 20, windowMs: 15 * 60 * 1000 })
  if (!rate.allowed) throw new Error('För många meddelanden på kort tid. Vänta en stund och försök igen.')

  const reference = pick(formData, 'ticket_id')
  const message = pick(formData, 'body')
  if (!reference || !message) throw new Error('Skriv ett meddelande innan du skickar.')
  const intentId = requestId(formData)
  const identity = await getOpsPortalIdentityForUser(supabase, user)
  // OPS checks customer ownership and closed-case state in the canonical write.
  await sendOpsCustomerSupportMessage(identity, reference, { message }, `portal-support-reply:${user.id}:${intentId}`)

  revalidatePath('/dashboard/support')
  revalidatePath('/dashboard')
  redirect('/dashboard/support?status=message-sent')
}
