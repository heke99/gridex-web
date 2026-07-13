import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import {
  isOpsError,
  markOpsCustomerNotificationsRead,
  sendOpsCustomerEvent,
  submitOpsCustomerMoveOut,
  submitOpsCustomerPortalSync,
  submitOpsCustomerProfileUpdate,
  submitOpsCustomerSync,
  type OpsPortalIdentity,
} from '@/lib/ops/client'

export type PortalOutboxOperation =
  | 'customer_event'
  | 'notification_read'
  | 'profile_update'
  | 'customer_sync'
  | 'customer_portal_sync'
  | 'move_out'
  | 'facility_data_update'

export class PortalOutboxConflictError extends Error {
  readonly status = 409
  readonly code = 'idempotency_conflict'

  constructor() {
    super('Samma operation-ID har redan använts med ett annat innehåll.')
    this.name = 'PortalOutboxConflictError'
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    const row = value as Record<string, unknown>
    return `{${Object.keys(row).sort().map((key) => `${JSON.stringify(key)}:${stableJson(row[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function operationHash(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex')
}

type OutboxRow = {
  id: string
  user_id: string
  operation_type: PortalOutboxOperation
  idempotency_key: string
  identity: OpsPortalIdentity
  payload: Record<string, unknown>
  attempt_count: number
  max_attempts?: number
}

function env(name: string): string | null {
  const value = process.env[name]?.trim()
  return value || null
}

function serviceClient() {
  const url = env('NEXT_PUBLIC_SUPABASE_URL')
  const key = env('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Customer portal outbox is not configured.')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}


function outboxErrorCode(error: unknown): string {
  if (isOpsError(error)) {
    const body = error.details && typeof error.details === 'object' && !Array.isArray(error.details)
      ? error.details as Record<string, unknown>
      : null
    const nested = body?.error && typeof body.error === 'object' ? body.error as Record<string, unknown> : null
    const code = nested?.code ?? body?.code
    if (typeof code === 'string' && code.trim()) return code.trim()
    return `ops_http_${error.status}`
  }
  if (error instanceof Error && error.name) return error.name
  return 'portal_outbox_dispatch_failed'
}

function backoffMinutes(attempt: number): number {
  return Math.min(12 * 60, Math.max(1, 2 ** Math.min(attempt, 9)))
}

export async function enqueuePortalWrite(input: {
  userId: string
  operationType: PortalOutboxOperation
  idempotencyKey: string
  identity: OpsPortalIdentity
  payload: Record<string, unknown>
}): Promise<void> {
  const supabase = serviceClient()
  const row = {
    user_id: input.userId,
    operation_type: input.operationType,
    idempotency_key: input.idempotencyKey,
    identity: input.identity,
    payload: input.payload,
    payload_hash: operationHash({ identity: input.identity, payload: input.payload }),
    status: 'pending',
    next_attempt_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  const { error } = await supabase.from('customer_portal_write_outbox').insert(row)
  if (!error) return
  const duplicate = error.code === '23505' || error.message.toLowerCase().includes('duplicate')
  if (!duplicate) throw new Error(error.message)

  const { data: existing, error: readError } = await supabase
    .from('customer_portal_write_outbox')
    .select('user_id,operation_type,identity,payload')
    .eq('idempotency_key', input.idempotencyKey)
    .maybeSingle<{ user_id: string; operation_type: string; identity: unknown; payload: unknown }>()
  if (readError || !existing) throw new Error(readError?.message ?? 'Outbox operation state unavailable.')
  const sameOperation =
    existing.user_id === input.userId &&
    existing.operation_type === input.operationType &&
    operationHash(existing.identity) === operationHash(input.identity) &&
    operationHash(existing.payload) === operationHash(input.payload)
  if (!sameOperation) throw new PortalOutboxConflictError()
}

async function dispatch(row: OutboxRow): Promise<void> {
  const operationId = typeof row.payload.operation_id === 'string'
    ? row.payload.operation_id
    : row.idempotency_key

  if (row.operation_type === 'customer_event') {
    const eventType = typeof row.payload.event_type === 'string' ? row.payload.event_type : ''
    await sendOpsCustomerEvent(row.identity, {
      event_type: eventType,
      source: 'gridex_website',
      entity_type: typeof row.payload.entity_type === 'string' ? row.payload.entity_type : null,
      entity_id: typeof row.payload.entity_id === 'string' ? row.payload.entity_id : null,
      idempotency_key: operationId,
      metadata:
        row.payload.metadata && typeof row.payload.metadata === 'object' && !Array.isArray(row.payload.metadata)
          ? (row.payload.metadata as Record<string, unknown>)
          : {},
    })
    return
  }

  if (row.operation_type === 'profile_update') {
    const profile = row.payload.profile && typeof row.payload.profile === 'object' && !Array.isArray(row.payload.profile)
      ? (row.payload.profile as Record<string, unknown>)
      : null
    if (!profile) throw new Error('Queued profile update has no valid profile payload.')
    await submitOpsCustomerProfileUpdate({
      identity: row.identity,
      idempotencyKey: operationId,
      profile,
      metadata: recordPayload(row.payload.metadata) ?? { source: 'gridex_web_profile_outbox' },
    })
    return
  }

  if (row.operation_type === 'customer_sync' || row.operation_type === 'facility_data_update') {
    await submitOpsCustomerSync({
      identity: row.identity,
      idempotencyKey: operationId,
      powerOfAttorney: recordPayload(row.payload.power_of_attorney),
      legalAcceptances: recordArrayPayload(row.payload.legal_acceptances),
      documents: recordArrayPayload(row.payload.documents),
      facilityData: recordPayload(row.payload.facility_data),
      profile: recordPayload(row.payload.profile),
      metadata: recordPayload(row.payload.metadata) ?? { source: 'gridex_web_customer_sync_outbox' },
    })
    return
  }

  if (row.operation_type === 'customer_portal_sync') {
    await submitOpsCustomerPortalSync({
      identity: row.identity,
      idempotencyKey: operationId,
      customerNumber: typeof row.payload.customer_number === 'string' ? row.payload.customer_number : null,
      externalCustomerId: typeof row.payload.external_customer_id === 'string' ? row.payload.external_customer_id : null,
      email: typeof row.payload.email === 'string' ? row.payload.email : null,
      metadata: recordPayload(row.payload.metadata) ?? { source: 'gridex_web_customer_portal_sync_outbox' },
    })
    return
  }

  if (row.operation_type === 'move_out') {
    const moveOut = recordPayload(row.payload.move_out)
    if (!moveOut) throw new Error('Queued move-out has no valid payload.')
    await submitOpsCustomerMoveOut({
      identity: row.identity,
      idempotencyKey: operationId,
      moveOut,
      metadata: recordPayload(row.payload.metadata) ?? { source: 'gridex_web_move_out_outbox' },
    })
    return
  }

  const ids = Array.isArray(row.payload.notification_ids)
    ? row.payload.notification_ids.map(String).filter(Boolean)
    : []
  await markOpsCustomerNotificationsRead(row.identity, {
    notificationIds: ids,
    all: row.payload.all === true,
    operationId,
  })
}

function recordPayload(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function recordArrayPayload(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(recordPayload(item)))
    : []
}

export async function processPortalWriteOutbox(limit = 50) {
  const supabase = serviceClient()
  const now = new Date().toISOString()
  const staleBefore = new Date(Date.now() - 15 * 60_000).toISOString()
  await supabase
    .from('distributed_rate_limits')
    .delete()
    .lt('reset_at', new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString())
  const { error: staleError } = await supabase
    .from('customer_portal_write_outbox')
    .update({ status: 'failed', next_attempt_at: now, updated_at: now, last_error_code: 'stale_processing_reclaimed' })
    .eq('status', 'processing')
    .lt('last_attempt_at', staleBefore)
  if (staleError) throw new Error(staleError.message)

  const { data, error } = await supabase
    .from('customer_portal_write_outbox')
    .select('id,user_id,operation_type,idempotency_key,identity,payload,attempt_count,max_attempts')
    .in('status', ['pending', 'failed'])
    .lte('next_attempt_at', now)
    .order('created_at', { ascending: true })
    .limit(Math.max(1, Math.min(limit, 100)))
    .returns<OutboxRow[]>()
  if (error) throw new Error(error.message)

  let completed = 0
  let failed = 0
  for (const row of data ?? []) {
    const attempt = (row.attempt_count ?? 0) + 1
    const claimed = await supabase
      .from('customer_portal_write_outbox')
      .update({ status: 'processing', attempt_count: attempt, last_attempt_at: now, updated_at: now })
      .eq('id', row.id)
      .in('status', ['pending', 'failed'])
      .select('id')
      .maybeSingle()
    if (claimed.error) throw new Error(claimed.error.message)
    if (!claimed.data) continue

    try {
      await dispatch({ ...row, attempt_count: attempt })
      const { data: completedRow, error: completeError } = await supabase
        .from('customer_portal_write_outbox')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_error_code: null,
          last_error_message: null,
        })
        .eq('id', row.id)
        .eq('status', 'processing')
        .select('id')
        .maybeSingle<{ id: string }>()
      if (completeError) throw new Error(completeError.message)
      if (!completedRow?.id) throw new Error('Outbox completion state was lost to a concurrent worker.')
      completed += 1
    } catch (dispatchError) {
      const errorCode = outboxErrorCode(dispatchError)
      const permanent = isOpsError(dispatchError) && dispatchError.status < 500 && dispatchError.status !== 408 && dispatchError.status !== 429
      const maxAttempts = Math.max(1, row.max_attempts ?? 10)
      const deadLetter = permanent || attempt >= maxAttempts
      const failedAt = new Date().toISOString()
      const { data: failedRow, error: failureStateError } = await supabase
        .from('customer_portal_write_outbox')
        .update({
          status: deadLetter ? 'dead_letter' : 'failed',
          next_attempt_at: deadLetter
            ? new Date('9999-12-31T00:00:00.000Z').toISOString()
            : new Date(Date.now() + backoffMinutes(attempt) * 60_000).toISOString(),
          dead_letter_at: deadLetter ? failedAt : null,
          updated_at: failedAt,
          last_http_status: isOpsError(dispatchError) ? dispatchError.status : null,
          last_error_code: errorCode,
          last_error_message: dispatchError instanceof Error ? dispatchError.message.slice(0, 1000) : String(dispatchError).slice(0, 1000),
        })
        .eq('id', row.id)
        .eq('status', 'processing')
        .select('id')
        .maybeSingle<{ id: string }>()
      if (failureStateError) throw new Error(failureStateError.message)
      if (!failedRow?.id) throw new Error('Outbox failure state was lost to a concurrent worker.')
      failed += 1
    }
  }

  return { processed: (data ?? []).length, completed, failed }
}

export async function replayPortalWriteOutbox(id: string): Promise<void> {
  const normalized = id.trim()
  if (!/^[0-9a-f-]{36}$/i.test(normalized)) throw new Error('Invalid outbox ID.')
  const now = new Date().toISOString()
  const { data, error } = await serviceClient()
    .from('customer_portal_write_outbox')
    .update({
      status: 'pending',
      attempt_count: 0,
      next_attempt_at: now,
      dead_letter_at: null,
      completed_at: null,
      last_error_code: null,
      last_error_message: null,
      last_http_status: null,
      updated_at: now,
    })
    .eq('id', normalized)
    .in('status', ['failed', 'dead_letter'])
    .select('id')
    .maybeSingle<{ id: string }>()
  if (error) throw new Error(error.message)
  if (!data?.id) throw new Error('Outbox operation is not replayable.')
}
