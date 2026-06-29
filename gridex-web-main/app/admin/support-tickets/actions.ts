'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerActionClient } from '@/lib/supabase/server'

type TicketLookupRow = {
  id: string
  status: string
}

const ALLOWED_STATUSES = new Set([
  'open',
  'waiting_on_internal',
  'waiting_on_customer',
  'resolved',
  'closed',
])

function pick(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

async function assertSupportManagePermission() {
  const supabase = await createSupabaseServerActionClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const { data: permissionData, error } = await supabase.rpc(
    'gridex_get_user_permissions',
    { p_user_id: user.id }
  )

  if (error) {
    throw new Error(error.message)
  }

  const permissions = Array.isArray(permissionData)
    ? permissionData.filter((value): value is string => typeof value === 'string')
    : []

  const allowed =
    permissions.includes('support_tickets.manage') ||
    permissions.includes('admin.access')

  if (!allowed) {
    throw new Error('Forbidden')
  }

  return { supabase, user }
}

export async function assignSupportTicketAction(formData: FormData) {
  const { supabase, user } = await assertSupportManagePermission()

  const ticketId = pick(formData, 'ticket_id')

  if (!ticketId) {
    throw new Error('Missing ticket_id')
  }

  const { error } = await supabase
    .from('customer_support_tickets')
    .update({
      assigned_user_id: user.id,
      status: 'waiting_on_internal',
      updated_at: new Date().toISOString(),
    })
    .eq('id', ticketId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/admin/support-tickets')
}

export async function updateSupportTicketStatusAction(formData: FormData) {
  const { supabase } = await assertSupportManagePermission()

  const ticketId = pick(formData, 'ticket_id')
  const status = pick(formData, 'status')

  if (!ticketId || !status) {
    throw new Error('Missing ticket_id or status')
  }

  if (!ALLOWED_STATUSES.has(status)) {
    throw new Error('Invalid status')
  }

  const closedAt =
    status === 'resolved' || status === 'closed'
      ? new Date().toISOString()
      : null

  const { error } = await supabase
    .from('customer_support_tickets')
    .update({
      status,
      closed_at: closedAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', ticketId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/admin/support-tickets')
}

export async function replyToSupportTicketAction(formData: FormData) {
  const { supabase, user } = await assertSupportManagePermission()

  const ticketId = pick(formData, 'ticket_id')
  const body = pick(formData, 'body')

  if (!ticketId || !body) {
    throw new Error('Missing ticket_id or body')
  }

  const { data: ticket, error: ticketError } = await supabase
    .from('customer_support_tickets')
    .select('id,status')
    .eq('id', ticketId)
    .maybeSingle<TicketLookupRow>()

  if (ticketError) {
    throw new Error(ticketError.message)
  }

  if (!ticket) {
    throw new Error('Ticket not found')
  }

  const { error: messageError } = await supabase
    .from('customer_support_messages')
    .insert({
      ticket_id: ticketId,
      sender_user_id: user.id,
      sender_type: 'agent',
      body,
    })

  if (messageError) {
    throw new Error(messageError.message)
  }

  const nextStatus =
    ticket.status === 'resolved' || ticket.status === 'closed'
      ? 'resolved'
      : 'waiting_on_customer'

  const { error: updateError } = await supabase
    .from('customer_support_tickets')
    .update({
      assigned_user_id: user.id,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', ticketId)

  if (updateError) {
    throw new Error(updateError.message)
  }

  revalidatePath('/admin/support-tickets')
}