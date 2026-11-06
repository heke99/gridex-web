import { supabaseService } from '@/lib/supabase/service'
import type { OpsPortalIdentity } from '@/lib/ops/client'
import { PRIVACY_HANDLING_LABELS, privacyRequestStatus, type PrivacyRequestKind } from './privacyRules'

export class PrivacyRequestError extends Error {
  readonly status: number
  readonly code: string
  constructor(message: string, status: number, code: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export async function enqueuePrivacyRequest(input: {
  userId: string; kind: PrivacyRequestKind; operationId: string; identity: OpsPortalIdentity
}) {
  const { data, error } = await supabaseService.rpc('gridex_enqueue_privacy_request_v1', {
    p_user_id: input.userId, p_kind: input.kind, p_operation_id: input.operationId, p_identity: input.identity,
  })
  if (error) {
    if (error.message.includes('privacy_idempotency_conflict')) {
      throw new PrivacyRequestError('Samma begäran-ID har redan använts för en annan åtgärd.', 409, 'idempotency_conflict')
    }
    if (error.message.includes('privacy_request_limit')) {
      throw new PrivacyRequestError('Du har redan skickat flera begäranden. Kontakta kundservice om du behöver hjälp.', 429, 'privacy_request_limit')
    }
    throw new Error('Privacy request could not be durably recorded.')
  }
  if (!data || typeof data.id !== 'string') throw new Error('Privacy request receipt unavailable.')
  return data as { id: string; kind: PrivacyRequestKind; created_at: string; replayed: boolean }
}

export async function listPrivacyRequests(userId: string) {
  const { data, error } = await supabaseService.from('customer_privacy_requests')
    .select('id,kind,created_at,submitted_at,ops_case_reference,local_ticket_id,queue:customer_portal_write_outbox!inner(status),inquiry:customer_support_tickets(status)')
    .eq('user_id', userId).order('created_at', { ascending: false }).limit(50)
  if (error) throw new Error('Privacy request status unavailable.')
  return (data ?? []).map(row => {
    const queue = (Array.isArray(row.queue) ? row.queue[0] : row.queue) as { status: string } | null
    const inquiry = (Array.isArray(row.inquiry) ? row.inquiry[0] : row.inquiry) as { status: string } | null
    return {
      id: row.id as string, kind: row.kind as PrivacyRequestKind, created_at: row.created_at as string,
      submitted_at: row.submitted_at as string | null, case_reference: row.ops_case_reference as string | null,
      status: privacyRequestStatus(row.ops_case_reference ?? row.local_ticket_id, queue?.status ?? 'dead_letter'),
      handling_label: inquiry && Object.hasOwn(PRIVACY_HANDLING_LABELS, inquiry.status) ? PRIVACY_HANDLING_LABELS[inquiry.status] : null,
    }
  })
}
