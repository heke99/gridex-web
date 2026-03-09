'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerActionClient } from '@/lib/supabase/server'

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
    throw new Error('Unauthorized')
  }

  const subject = pick(formData, 'subject')
  const description = pick(formData, 'description')
  const category = pick(formData, 'category') || 'general'
  const priority = pick(formData, 'priority') || 'normal'
  const clientRequestId = pick(formData, 'client_request_id')

  if (!subject || !description) {
    throw new Error('Missing subject or description')
  }

  if (!clientRequestId) {
    throw new Error('Missing client_request_id')
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
      throw new Error(ticketError.message)
    }

    const { data: existingTicket, error: existingTicketError } = await supabase
      .from('customer_support_tickets')
      .select('id')
      .eq('client_request_id', clientRequestId)
      .maybeSingle<TicketInsertRow>()

    if (existingTicketError || !existingTicket?.id) {
      throw new Error(existingTicketError?.message || 'Failed to load existing ticket')
    }

    revalidatePath('/dashboard/support')
    revalidatePath('/dashboard')
    return
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
    throw new Error(messageError.message)
  }

  await supabase
    .from('customer_support_tickets')
    .update({
      updated_at: new Date().toISOString(),
    })
    .eq('id', ticket.id)

  revalidatePath('/dashboard/support')
  revalidatePath('/dashboard')
}

export async function addSupportMessageAction(formData: FormData) {
  const supabase = await createSupabaseServerActionClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const ticketId = pick(formData, 'ticket_id')
  const body = pick(formData, 'body')
  const clientRequestId = pick(formData, 'client_request_id')

  if (!ticketId || !body) {
    throw new Error('Missing ticket_id or body')
  }

  if (!clientRequestId) {
    throw new Error('Missing client_request_id')
  }

  const { data: ticket, error: ticketError } = await supabase
    .from('customer_support_tickets')
    .select('id,user_id,status')
    .eq('id', ticketId)
    .eq('user_id', user.id)
    .maybeSingle<TicketLookupRow>()

  if (ticketError) {
    throw new Error(ticketError.message)
  }

  if (!ticket) {
    throw new Error('Ticket not found')
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
      throw new Error(error.message)
    }

    revalidatePath('/dashboard/support')
    return
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