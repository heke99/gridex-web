'use server'

import { revalidatePath } from 'next/cache'
import { requireGlobalAdminActionAccess } from '@/lib/admin/guards'
import { supportIdempotencyKey } from '@/lib/support/validation'

const STATUSES = new Set(['open','waiting_on_internal','waiting_on_customer','resolved','closed'])

function pick(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}
function ticketId(formData: FormData): string {
  const id = pick(formData, 'ticket_id')
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new Error('Ärendereferensen är ogiltig.')
  return id
}
function revalidate() {
  revalidatePath('/support-center/staff')
  revalidatePath('/admin/support-tickets')
}

export async function assignSupportTicketAction(formData: FormData) {
  const { supabase, userId } = await requireGlobalAdminActionAccess({ allOf: ['support_tickets.read','support_tickets.manage'] })
  const { data, error } = await supabase.from('customer_support_tickets').update({ assigned_user_id: userId, status: 'waiting_on_internal' })
    .eq('id', ticketId(formData)).is('user_id', null).eq('metadata->>source','public_kundservice_form').select('id').maybeSingle()
  if (error || !data) throw new Error('Förfrågan kunde inte tilldelas.')
  revalidate()
}

export async function updateSupportTicketStatusAction(formData: FormData) {
  const { supabase } = await requireGlobalAdminActionAccess({ allOf: ['support_tickets.read','support_tickets.manage'] })
  const status = pick(formData, 'status')
  if (!STATUSES.has(status)) throw new Error('Statusen är ogiltig.')
  const { data, error } = await supabase.from('customer_support_tickets').update({ status, closed_at: status === 'resolved' || status === 'closed' ? new Date().toISOString() : null })
    .eq('id', ticketId(formData)).is('user_id', null).eq('metadata->>source','public_kundservice_form').select('id').maybeSingle()
  if (error || !data) throw new Error('Förfrågans status kunde inte ändras.')
  revalidate()
}

export async function replyToSupportTicketAction(formData: FormData) {
  // Local prospect records contain internal follow-up notes. Customer replies are sent from OPS.
  const { supabase, userId } = await requireGlobalAdminActionAccess({ allOf: ['support_tickets.read','support_tickets.reply'] })
  const id = ticketId(formData)
  const body = pick(formData, 'body')
  const operationId = supportIdempotencyKey(pick(formData, 'client_request_id'))
  const clientRequestId = `staff-note:${userId}:${operationId}`
  if (!body || body.length > 4000) throw new Error('Skriv en anteckning på högst 4 000 tecken.')
  const { data: prospect, error: lookupError } = await supabase.from('customer_support_tickets').select('id')
    .eq('id', id).is('user_id', null).eq('metadata->>source','public_kundservice_form').maybeSingle()
  if (lookupError || !prospect) throw new Error('Förfrågan kunde inte hittas.')
  const { error } = await supabase.from('customer_support_messages').insert({ ticket_id: id, sender_user_id: userId, sender_type: 'agent', body, is_internal_note: true, client_request_id: clientRequestId })
  if (error) {
    if (error.code !== '23505') throw new Error('Anteckningen kunde inte sparas.')
    const { data: previous, error: previousError } = await supabase.from('customer_support_messages').select('ticket_id,body,sender_user_id,is_internal_note').eq('client_request_id',clientRequestId).maybeSingle()
    if (previousError || !previous || previous.ticket_id !== id || previous.body !== body || previous.sender_user_id !== userId || previous.is_internal_note !== true) throw new Error('Begäran har redan använts med andra uppgifter.')
  }
  revalidate()
}
