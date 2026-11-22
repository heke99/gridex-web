import { supabaseService } from '@/lib/supabase/service'

type Receipt = {
  operation_id: string; recipient: string; body: string; claim_token: string;
  attempt_count: number; first_attempt_at: string;
}

/** Durable transactional acknowledgment; Auth and OPS agreement emails have separate owners. */
export async function processPublicSupportReceipts(limit = 25) {
  const key = process.env.GRIDEX_SUPPORT_RECEIPT_RESEND_KEY?.trim()
  const from = process.env.GRIDEX_SUPPORT_RECEIPT_FROM?.trim()
  if (!key || !from) throw new Error('Public support receipt sender is not configured.')
  const { data, error } = await supabaseService.rpc('gridex_claim_public_receipts_v1', { p_limit: limit })
  if (error || !Array.isArray(data)) throw new Error('Public receipt queue is unavailable.')
  let sent = 0, failed = 0, unrecorded = 0
  for (const receipt of data as Receipt[]) {
    let status = 'failed'
    let providerId: string | null = null
    let code: string | null = null
    if (Date.now() - Date.parse(receipt.first_attempt_at) >= 23 * 60 * 60_000 || receipt.attempt_count > 10) {
      status = 'manual_review'; code = 'idempotency_window_expired'
    } else {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': `public-support-receipt:${receipt.operation_id}` },
          body: JSON.stringify({ from, to: [receipt.recipient], subject: 'Vi har tagit emot ditt ärende hos Gridex AB', text: receipt.body }),
          signal: AbortSignal.timeout(12_000), redirect: 'error',
        })
        const payload = await response.json().catch(() => null) as { id?: unknown; name?: unknown } | null
        if (response.ok && typeof payload?.id === 'string' && payload.id.trim()) {
          status = 'sent'
          providerId = payload.id
        } else if (response.status === 409 && payload?.name === 'concurrent_idempotent_requests') {
          code = 'concurrent_idempotent_requests'
        } else {
          code = `provider_http_${response.status}`
          if (response.status >= 400 && response.status < 500 && response.status !== 429) status = 'manual_review'
        }
      } catch { code = 'provider_network_error' }
    }
    try {
      const { data: updated, error: updateError } = await supabaseService.from('public_support_receipts')
        .update({ status, provider_message_id: providerId, last_error_code: code, claim_token: null,
          next_attempt_at: new Date(Date.now() + Math.min(60, 2 ** receipt.attempt_count) * 60_000).toISOString(),
        }).eq('operation_id', receipt.operation_id).eq('status', 'processing').eq('claim_token', receipt.claim_token).select('operation_id').maybeSingle()
      if (updateError || !updated) throw new Error('Public receipt processing claim was lost.')
    } catch {
      // The existing stale-claim recovery retries an unrecorded outcome with the same send key.
      unrecorded++
      continue
    }
    if (status === 'sent') sent++; else failed++
  }
  if (unrecorded) {
    console.error('[public support receipts] unable to record batch outcomes', { sent, failed, unrecorded })
    throw new Error('Public receipt processing results could not all be saved.')
  }
  return { processed: data.length, sent, failed }
}

export async function oldestWaitingSupportReceiptAge(): Promise<number | null> {
  const { data, error } = await supabaseService
    .from('public_support_receipts')
    .select('created_at')
    .in('status', ['pending', 'failed'])
    .order('created_at', { ascending: true })
    .limit(1)
    .abortSignal(AbortSignal.timeout(3_000))
    .maybeSingle<{ created_at: string }>()
  if (error) throw new Error('Public receipt queue age is unavailable.')
  if (!data) return null
  const createdAt = Date.parse(data.created_at)
  if (!Number.isFinite(createdAt)) throw new Error('Invalid receipt creation time.')
  return Math.max(0, Date.now() - createdAt)
}
