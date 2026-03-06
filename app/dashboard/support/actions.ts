'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerActionClient } from '@/lib/supabase/server'

function pick(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

export async function createSupportTicketAction(formData: FormData) {
  const supabase = await createSupabaseServerActionClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const subject = pick(formData, 'subject')
  const description = pick(formData, 'description')
  const category = pick(formData, 'category') || 'general'
  const priority = pick(formData, 'priority') || 'normal'

  if (!subject || !description) throw new Error('Missing subject or description')

  const { data: ticket, error } = await supabase
    .from('customer_support_tickets')
    .insert({
      user_id: user.id,
      subject,
      description,
      category,
      priority,
      status: 'open',
    })
    .select('id')
    .single<{ id: string }>()

  if (error) throw new Error(error.message)

  await supabase.from('customer_support_messages').insert({
    ticket_id: ticket.id,
    sender_user_id: user.id,
    sender_type: 'customer',
    body: description,
  })

  revalidatePath('/dashboard/support')
  revalidatePath('/dashboard')
}

export async function addSupportMessageAction(formData: FormData) {
  const supabase = await createSupabaseServerActionClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const ticketId = pick(formData, 'ticket_id')
  const body = pick(formData, 'body')
  if (!ticketId || !body) throw new Error('Missing ticket_id or body')

  const { error } = await supabase.from('customer_support_messages').insert({
    ticket_id: ticketId,
    sender_user_id: user.id,
    sender_type: 'customer',
    body,
  })

  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/support')
}
