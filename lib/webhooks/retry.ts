import { supabaseService } from '@/lib/supabase/service'
import {
  customerNotificationForEvent,
  isSupportedOpsWebhookEventType,
  parseOpsWebhookEnvelope,
} from '@/lib/webhooks/opsWebhook'

type RetryableWebhookRow = {
  id: string
  event_id: string
  event_type: string
  delivery_id: string | null
  organization_reference: string | null
  occurred_at: string | null
  payload_hash: string | null
  payload: Record<string, unknown> | null
}

type RetryResult = {
  result?: string | null
  notification_created?: boolean | null
}

const DEFAULT_BATCH_SIZE = 25
const MAX_BATCH_SIZE = 100

function boundedBatchSize(value?: number): number {
  if (!Number.isFinite(value)) return DEFAULT_BATCH_SIZE
  return Math.min(MAX_BATCH_SIZE, Math.max(1, Math.trunc(value as number)))
}

async function deadLetterMalformed(row: RetryableWebhookRow, message: string) {
  const now = new Date().toISOString()
  const { error } = await supabaseService
    .from('ops_webhook_events')
    .update({
      status: 'permanent_failure',
      handling_note: 'stored_webhook_payload_invalid',
      error_message: message.slice(0, 1000),
      next_attempt_at: null,
      dead_letter_at: now,
      processed_at: now,
    })
    .eq('id', row.id)
    .eq('status', 'retryable_failure')
  if (error) throw new Error(`Unable to dead-letter malformed webhook ${row.id}: ${error.message}`)
}

export async function processOpsWebhookRetries(options?: { limit?: number }) {
  const limit = boundedBatchSize(options?.limit)
  const now = new Date().toISOString()
  const { data, error } = await supabaseService
    .from('ops_webhook_events')
    .select('id,event_id,event_type,delivery_id,organization_reference,occurred_at,payload_hash,payload')
    .eq('status', 'retryable_failure')
    .lte('next_attempt_at', now)
    .order('next_attempt_at', { ascending: true })
    .order('received_at', { ascending: true })
    .limit(limit)

  if (error) throw new Error(`Unable to load webhook retries: ${error.message}`)

  let applied = 0
  let duplicates = 0
  let retryableFailures = 0
  let permanentFailures = 0
  let identifierConflicts = 0

  for (const row of (data ?? []) as RetryableWebhookRow[]) {
    const payload = row.payload ?? {}
    const event = parseOpsWebhookEnvelope(payload)
    if (
      !event ||
      !isSupportedOpsWebhookEventType(event.event_type) ||
      event.event_id !== row.event_id ||
      event.event_type !== row.event_type ||
      !row.delivery_id ||
      !row.organization_reference ||
      !row.occurred_at ||
      !row.payload_hash
    ) {
      await deadLetterMalformed(row, 'Stored signed webhook payload cannot be safely replayed.')
      permanentFailures += 1
      continue
    }

    const notification = customerNotificationForEvent(event)
    const { data: rpcData, error: rpcError } = await supabaseService.rpc('apply_ops_domain_event_v2', {
      p_event_id: row.event_id,
      p_delivery_id: row.delivery_id,
      p_event_type: row.event_type,
      p_organization_reference: row.organization_reference,
      p_created_at: row.occurred_at,
      p_payload_hash: row.payload_hash,
      p_payload: payload,
      p_customer_id: event.customer_id,
      p_customer_number: event.customer_number,
      p_external_customer_id: event.external_customer_id,
      p_customer_email: event.customer_email,
      p_portal_user_id: event.portal_user_id,
      p_related_entity_type: event.related_entity_type,
      p_related_entity_id: event.related_entity_id,
      p_notification_category: notification?.category ?? null,
      p_notification_title: notification?.title ?? null,
      p_notification_body: notification?.body ?? null,
      p_notification_link_href: notification?.link_href ?? null,
    })

    if (rpcError) {
      retryableFailures += 1
      continue
    }

    const result = (Array.isArray(rpcData) ? rpcData[0] : rpcData) as RetryResult | null
    switch (result?.result) {
      case 'applied':
        applied += 1
        break
      case 'duplicate':
        duplicates += 1
        break
      case 'identifier_conflict':
        identifierConflicts += 1
        break
      case 'permanent_failure':
        permanentFailures += 1
        break
      default:
        retryableFailures += 1
        break
    }
  }

  return {
    selected: data?.length ?? 0,
    applied,
    duplicates,
    retryable_failures: retryableFailures,
    permanent_failures: permanentFailures,
    identifier_conflicts: identifierConflicts,
  }
}
