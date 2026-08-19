import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { supabaseService } from '@/lib/supabase/service'
import { getVerifiedOpsIntegrationContext } from '@/lib/ops/client'
import {
  customerNotificationForEvent,
  isSupportedOpsWebhookEventType,
  parseOpsWebhookEnvelope,
  verifyOpsWebhookSignature,
} from '@/lib/webhooks/opsWebhook'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type ApplyResult = {
  result?: 'applied' | 'duplicate' | 'identifier_conflict' | 'retryable_failure' | 'permanent_failure' | null
  notification_created?: boolean | null
}

function header(headers: Headers, names: string[]): string | null {
  for (const name of names) {
    const value = headers.get(name)?.trim()
    if (value && value.length <= 512) return value
  }
  return null
}

function error(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status })
}

export async function POST(request: Request) {
  const secret = process.env.GRIDEX_WEBHOOK_SIGNING_SECRET?.trim()
  if (!secret || secret.length < 32) {
    return error('webhook_not_configured', 'Webhook verification is not configured.', 503)
  }

  const rawBody = await request.text()
  if (!rawBody || rawBody.length > 2_000_000) {
    return error('invalid_webhook_body', 'Webhook body is empty or too large.', 400)
  }

  const tolerance = Number(process.env.GRIDEX_WEBHOOK_TOLERANCE_SECONDS ?? '300')
  const verification = verifyOpsWebhookSignature({
    rawBody,
    headers: request.headers,
    secret,
    toleranceSeconds: Number.isFinite(tolerance) ? Math.max(30, Math.min(900, tolerance)) : 300,
  })
  if (!verification.ok) {
    return error('invalid_webhook_signature', verification.reason, 401)
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return error('invalid_webhook_json', 'Webhook body is not valid JSON.', 400)
  }

  const event = parseOpsWebhookEnvelope(payload)
  if (!event || !isSupportedOpsWebhookEventType(event.event_type)) {
    return error('unsupported_webhook_event', 'Webhook event type is not supported.', 422)
  }

  const eventId = header(request.headers, ['x-gridex-event-id', 'x-event-id'])
  const eventType = header(request.headers, ['x-gridex-event-type', 'x-event-type'])
  const deliveryId = header(request.headers, ['x-gridex-delivery-id', 'x-delivery-id'])
  if (!eventId || !eventType || !deliveryId) {
    return error('missing_webhook_identity', 'Signed webhook identity headers are required.', 400)
  }
  if (event.event_id !== eventId || event.event_type !== eventType) {
    return error('webhook_identity_mismatch', 'Signed webhook identifiers do not match the body.', 400)
  }
  if (event.delivery_id && event.delivery_id !== deliveryId) {
    return error('webhook_delivery_mismatch', 'Signed delivery identifier does not match the body.', 400)
  }
  if (!event.organization_reference) {
    return error('webhook_organization_missing', 'Webhook organization reference is required.', 400)
  }

  try {
    const integration = await getVerifiedOpsIntegrationContext()
    if (event.organization_reference !== integration.organization_reference) {
      return error('webhook_organization_mismatch', 'Webhook organization does not match this deployment.', 403)
    }
  } catch (organizationError) {
    console.error('[gridex webhook] organization verification failed', organizationError)
    return error('webhook_organization_unavailable', 'Webhook organization context is unavailable.', 503)
  }

  const notification = customerNotificationForEvent(event)
  const payloadHash = createHash('sha256').update(rawBody).digest('hex')
  const { data, error: rpcError } = await supabaseService.rpc('apply_ops_domain_event_v2', {
    p_event_id: eventId,
    p_delivery_id: deliveryId,
    p_event_type: eventType,
    p_organization_reference: event.organization_reference,
    p_created_at: event.occurred_at,
    p_payload_hash: payloadHash,
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
    console.error('[gridex webhook] durable apply failed', rpcError)
    return error('webhook_storage_failed', 'Webhook could not be durably received.', 500)
  }

  const result = (Array.isArray(data) ? data[0] : data) as ApplyResult | null
  if (!result?.result) {
    return error('webhook_storage_failed', 'Webhook apply returned no durable result.', 500)
  }
  if (result.result === 'identifier_conflict') {
    return error('webhook_identifier_conflict', 'Event or delivery ID was reused with different content.', 409)
  }

  const status = result.result === 'retryable_failure' || result.result === 'permanent_failure' ? 202 : 200
  return NextResponse.json(
    {
      ok: true,
      result: result.result,
      event_id: eventId,
      delivery_id: deliveryId,
      notification_created: result.notification_created ?? false,
    },
    { status },
  )
}
