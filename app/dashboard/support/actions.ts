'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getPortalSession, getOpsPortalIdentityForUser } from '@/lib/customerPortal/service'
import { createOpsCustomerSupportCase, replyOpsCustomerSupportCase } from '@/lib/ops/client/support'
import { supportCreateInput, supportIdempotencyKey, supportReplyInput } from '@/lib/support/validation'
import { checkRateLimit } from '@/lib/security/rateLimit'

function pick(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

async function actionIdentity() {
  const { supabase, user } = await getPortalSession()
  const rate = await checkRateLimit(`ops-support-write:${user.id}`, { limit: 30, windowMs: 15 * 60 * 1000 })
  if (!rate.allowed) throw new Error('För många meddelanden. Vänta en stund och försök igen.')
  return getOpsPortalIdentityForUser(supabase, user)
}

export async function createSupportTicketAction(formData: FormData) {
  const identity = await actionIdentity()
  await createOpsCustomerSupportCase(identity, supportCreateInput({
    title: pick(formData, 'subject'),
    message: pick(formData, 'description'),
    category: pick(formData, 'category') || 'general',
  }), supportIdempotencyKey(pick(formData, 'client_request_id')))
  revalidatePath('/dashboard/support')
  revalidatePath('/support-center')
  redirect('/dashboard/support')
}

export async function addSupportMessageAction(formData: FormData) {
  const identity = await actionIdentity()
  await replyOpsCustomerSupportCase(identity, pick(formData, 'ticket_id'), supportReplyInput({ message: pick(formData, 'body') }), supportIdempotencyKey(pick(formData, 'client_request_id')))
  revalidatePath('/dashboard/support')
  revalidatePath('/support-center')
  redirect('/dashboard/support')
}
