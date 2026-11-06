import { isIP } from 'node:net'
import { createClient } from '@supabase/supabase-js'
import { canonicalSha256 } from '@/lib/ops/canonicalJson'
import { OpsError } from '@/lib/ops/errors'
import type { OpsPortalIdentity } from '@/lib/ops/client'
import { syncPowerOfAttorney } from './writeValidation'

type SyncPayload = Record<string, unknown> & { power_of_attorney: Record<string, unknown> }
export type CustomerSyncReceipt = {
  userId: string
  idempotencyKey: string
  payloadHash: string
  identity: OpsPortalIdentity
  payload: SyncPayload
}
type StoredReceipt = {
  user_id: string
  operation_type: string
  identity: OpsPortalIdentity
  payload: SyncPayload
  payload_hash: string
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) throw new Error('Customer consent storage is not configured.')
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, {
      ...init, signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(5_000)]) : AbortSignal.timeout(5_000),
    }) },
  })
}

function conflict(): never {
  throw new OpsError('Samma operation-ID har redan använts med annat innehåll.', 409, {
    code: 'idempotency_conflict', retryable: false,
  })
}

/** Freeze the first backend-observed consent before any canonical write.
 * The existing private outbox reconciles interrupted requests with the exact
 * original body/key; receipt-only fields are never forwarded by its dispatcher.
 */
export async function prepareCustomerSyncReceipt(input: {
  userId: string
  operationId: string
  identity: OpsPortalIdentity
  payload: SyncPayload
  evidence: { ipAddress: string; userAgent: string | null }
}): Promise<CustomerSyncReceipt> {
  if (input.userId !== input.identity.userId) {
    throw new OpsError('Kontot saknar åtkomst till denna operation.', 403, { code: 'forbidden', retryable: false })
  }
  const poa = syncPowerOfAttorney(input.payload.power_of_attorney)
  // This browser endpoint records a new website acceptance. Imported provider
  // completions must come from a separately verified backend, never form data.
  if (!poa || poa.method !== 'website_acceptance') {
    throw new OpsError('Fullmakten behöver ett uttryckligt elektroniskt godkännande.', 400, {
      code: 'validation_error', field: 'power_of_attorney', retryable: false,
    })
  }
  const idempotencyKey = `customer-sync:${input.userId}:${input.operationId}`
  const fingerprint = canonicalSha256({ userId: input.userId, payload: input.payload })
  const supabase = serviceClient()
  const lookup = async () => {
    const { data, error } = await supabase.from('customer_portal_write_outbox')
      .select('user_id,operation_type,identity,payload,payload_hash')
      .eq('idempotency_key', idempotencyKey).maybeSingle<StoredReceipt>()
    if (error) throw new Error('Customer consent receipt could not be read.')
    return data
  }
  const verify = (row: StoredReceipt): CustomerSyncReceipt => {
    if (row.user_id !== input.userId || row.operation_type !== 'customer_sync' ||
      row.identity?.userId !== input.userId || row.payload?._consent_receipt_version !== 1 ||
      row.payload?._request_fingerprint !== fingerprint ||
      row.payload_hash !== canonicalSha256({ identity: row.identity, payload: row.payload })) conflict()
    return { userId: row.user_id, idempotencyKey, payloadHash: row.payload_hash, identity: row.identity, payload: row.payload }
  }
  const existing = await lookup()
  if (existing) return verify(existing)

  const ip = input.evidence.ipAddress.trim()
  if (!isIP(ip) || ip === '::1' || ip === '::' || ip === '0.0.0.0' || /^127\./.test(ip) || /^::ffff:127\./i.test(ip)) {
    throw new OpsError('Kundens ursprungliga IP-adress kunde inte verifieras. Försök igen.', 503, {
      code: 'consent_evidence_unavailable', retryable: true,
    })
  }
  const acceptedAt = new Date().toISOString()
  const payload: SyncPayload = {
    ...input.payload,
    power_of_attorney: {
      ...poa, accepted_at: acceptedAt, ip_address: ip,
      // Discard the browser's claimed evidence even when its field is present.
      user_agent: input.evidence.userAgent ?? '',
    },
    operation_id: input.operationId,
    _consent_receipt_version: 1,
    _request_fingerprint: fingerprint,
  }
  const payloadHash = canonicalSha256({ identity: input.identity, payload })
  const { error } = await supabase.from('customer_portal_write_outbox').insert({
    user_id: input.userId, operation_type: 'customer_sync', idempotency_key: idempotencyKey,
    identity: input.identity, payload, payload_hash: payloadHash, status: 'pending',
    // Allow the interactive request to finish first. An interrupted request is
    // recovered by the existing outbox using the same API idempotency key.
    next_attempt_at: new Date(Date.now() + 15 * 60_000).toISOString(), updated_at: acceptedAt,
  })
  if (error) {
    if (error.code !== '23505') throw new Error('Customer consent receipt could not be stored.')
    const raced = await lookup()
    if (!raced) throw new Error('Customer consent receipt race could not be resolved.')
    return verify(raced)
  }
  return { userId: input.userId, idempotencyKey, payloadHash, identity: input.identity, payload }
}

export async function completeCustomerSyncReceipt(receipt: CustomerSyncReceipt): Promise<void> {
  const now = new Date().toISOString()
  const { data, error } = await serviceClient().from('customer_portal_write_outbox')
    .update({ status: 'completed', completed_at: now, updated_at: now, last_error_code: null, last_error_message: null })
    .eq('idempotency_key', receipt.idempotencyKey).eq('user_id', receipt.userId)
    .eq('payload_hash', receipt.payloadHash).select('id').maybeSingle<{ id: string }>()
  if (error || !data?.id) throw new Error('Customer consent receipt completion requires reconciliation.')
}
