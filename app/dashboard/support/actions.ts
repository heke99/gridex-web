'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createSupabaseServerActionClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/security/rateLimit'

type TicketInsertRow = {
  id: string
}

type TicketLookupRow = {
  id: string
  user_id: string
  status: string
}

function pick(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function isClosedStatus(status: string): boolean {
  return status === 'resolved' || status === 'closed'
}

export async function createSupportTicketAction(formData: FormData) {
  const supabase = await createSupabaseServerActionClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Du behöver logga in igen.')
  }

  const rate = checkRateLimit(`support-ticket:${user.id}`, {
    limit: 10,
    windowMs: 15 * 60 * 1000,
  })
  if (!rate.allowed) {
    throw new Error('För många ärenden på kort tid. Vänta en stund och försök igen.')
  }

  const subject = pick(formData, 'subject')
  const description = pick(formData, 'description')
  const category = pick(formData, 'category') || 'general'
  const priority = pick(formData, 'priority') || 'normal'
  const clientRequestId = pick(formData, 'client_request_id')

  if (!subject || !description) {
    throw new Error('Ange ämne och beskrivning.')
  }

  if (!clientRequestId) {
    throw new Error('Vi kunde inte skicka ärendet just nu. Försök igen.')
  }

  const { data: ticket, error: ticketError } = await supabase
    .from('customer_support_tickets')
    .insert({
      user_id: user.id,
      subject,
      description,
      category,
      priority,
      status: 'open',
      client_request_id: clientRequestId,
    })
    .select('id')
    .single<TicketInsertRow>()

  if (ticketError) {
    const isDuplicate =
      ticketError.code === '23505' ||
      ticketError.message.toLowerCase().includes('duplicate')

    if (!isDuplicate) {
      throw new Error('Vi kunde inte hämta ärendet just nu. Försök igen.')
    }

    const { data: existingTicket, error: existingTicketError } = await supabase
      .from('customer_support_tickets')
      .select('id')
      .eq('client_request_id', clientRequestId)
      .maybeSingle<TicketInsertRow>()

    if (existingTicketError || !existingTicket?.id) {
      throw new Error('Vi kunde inte kontrollera ärendet just nu. Försök igen.')
    }

    revalidatePath('/dashboard/support')
    revalidatePath('/dashboard')
    redirect('/dashboard/support?status=created')
  }

  const { error: messageError } = await supabase
    .from('customer_support_messages')
    .insert({
      ticket_id: ticket.id,
      sender_user_id: user.id,
      sender_type: 'customer',
      body: description,
      client_request_id: `${clientRequestId}:initial-message`,
    })

  if (messageError) {
    throw new Error('Vi kunde inte spara meddelandet just nu. Försök igen.')
  }

  await supabase
    .from('customer_support_tickets')
    .update({
      updated_at: new Date().toISOString(),
    })
    .eq('id', ticket.id)

  revalidatePath('/dashboard/support')
  revalidatePath('/dashboard')
  redirect('/dashboard/support?status=created')
}

export async function addSupportMessageAction(formData: FormData) {
  const supabase = await createSupabaseServerActionClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Du behöver logga in igen.')
  }

  const rate = checkRateLimit(`support-reply:${user.id}`, {
    limit: 20,
    windowMs: 15 * 60 * 1000,
  })
  if (!rate.allowed) {
    throw new Error('För många meddelanden på kort tid. Vänta en stund och försök igen.')
  }

  const ticketId = pick(formData, 'ticket_id')
  const body = pick(formData, 'body')
  const clientRequestId = pick(formData, 'client_request_id')

  if (!ticketId || !body) {
    throw new Error('Skriv ett meddelande innan du skickar.')
  }

  if (!clientRequestId) {
    throw new Error('Vi kunde inte skicka ärendet just nu. Försök igen.')
  }

  const { data: ticket, error: ticketError } = await supabase
    .from('customer_support_tickets')
    .select('id,user_id,status')
    .eq('id', ticketId)
    .eq('user_id', user.id)
    .maybeSingle<TicketLookupRow>()

  if (ticketError) {
    throw new Error('Vi kunde inte hämta ärendet just nu. Försök igen.')
  }

  if (!ticket) {
    throw new Error('Vi kunde inte hitta ärendet.')
  }

  if (isClosedStatus(ticket.status)) {
    throw new Error('Detta ärende är avslutat och kan inte uppdateras.')
  }

  const { error } = await supabase.from('customer_support_messages').insert({
    ticket_id: ticketId,
    sender_user_id: user.id,
    sender_type: 'customer',
    body,
    client_request_id: clientRequestId,
  })

  if (error) {
    const isDuplicate =
      error.code === '23505' || error.message.toLowerCase().includes('duplicate')

    if (!isDuplicate) {
      throw new Error('Vi kunde inte spara meddelandet just nu. Försök igen.')
    }

    revalidatePath('/dashboard/support')
    redirect('/dashboard/support?status=message-sent')
  }

  await supabase
    .from('customer_support_tickets')
    .update({
      updated_at: new Date().toISOString(),
      status: 'waiting_on_internal',
    })
    .eq('id', ticketId)

  revalidatePath('/dashboard/support')
  revalidatePath('/dashboard')
}