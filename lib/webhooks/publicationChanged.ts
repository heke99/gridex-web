import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getVerifiedOpsIntegrationContext, invalidateOpsPublicContractsCache } from '@/lib/ops/client'
import { assertWebsiteRequest } from '@/lib/ops/validators/openapi'

type PublicationChangedWebhook = {
  id: string
  type: 'contracts.publication.changed'
  created_at: string
  tenant_reference: string
  aggregate: {
    type: 'contract_publication'
    id: string
  }
  data: {
    tenant_reference: string
    channel: 'website' | 'api' | 'internal' | 'phone' | 'partner'
    publication_revision: number
    revision_token: string
    reason: string
    timestamp: string
  }
}

type ApplyResult = {
  result: 'applied' | 'duplicate' | 'stale' | 'ignored' | 'stored' | 'identifier_conflict'
  cache_invalidated: boolean
  stored_revision: number | null
}

type GenericWebhookEnvelope = {
  id: string
  type: string
  created_at: string
  tenant_reference: string
  data: {
    tenant_reference: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

function env(name: string): string | null {
  const value = process.env[name]?.trim()
  return value || null
}

function serviceClient() {
  const url = env('NEXT_PUBLIC_SUPABASE_URL')
  const key = env('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Canonical webhook storage is not configured.')
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function requiredHeader(headers: Headers, name: string): string | null {
  const value = headers.get(name)?.trim()
  return value && value.length <= 512 ? value : null
}

function safeHexEqual(leftHex: string, rightHex: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(leftHex) || !/^[a-f0-9]{64}$/i.test(rightHex)) return false
  return timingSafeEqual(Buffer.from(leftHex, 'hex'), Buffer.from(rightHex, 'hex'))
}

function verifySignature(args: {
  rawBody: string
  timestamp: string
  signature: string
  secret: string
}): boolean {
  if (!args.signature.startsWith('sha256=')) return false
  const timestampSeconds = Number(args.timestamp)
  if (!Number.isFinite(timestampSeconds)) return false
  const timestampMs = timestampSeconds > 10_000_000_000
    ? timestampSeconds
    : timestampSeconds * 1_000
  const tolerance = Number(env('GRIDEX_WEBHOOK_TOLERANCE_SECONDS') ?? '300')
  const toleranceMs = (Number.isFinite(tolerance) ? Math.max(30, Math.min(900, tolerance)) : 300) * 1_000
  if (Math.abs(Date.now() - timestampMs) > toleranceMs) return false
  const expected = createHmac('sha256', args.secret)
    .update(`${args.timestamp}.${args.rawBody}`)
    .digest('hex')
  return safeHexEqual(args.signature.slice('sha256='.length), expected)
}

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status })
}

function parseGenericEnvelope(value: unknown): GenericWebhookEnvelope | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const payload = value as Record<string, unknown>
  const data = payload.data
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const dataRecord = data as Record<string, unknown>
  if (
    typeof payload.id !== 'string' ||
    payload.id.trim().length === 0 ||
    typeof payload.type !== 'string' ||
    payload.type.trim().length === 0 ||
    typeof payload.created_at !== 'string' ||
    !Number.isFinite(Date.parse(payload.created_at)) ||
    typeof payload.tenant_reference !== 'string' ||
    payload.tenant_reference.trim().length === 0 ||
    typeof dataRecord.tenant_reference !== 'string' ||
    dataRecord.tenant_reference.trim().length === 0
  ) {
    return null
  }
  return payload as GenericWebhookEnvelope
}

export async function handlePublicationChangedWebhook(request: Request) {
  const eventId = requiredHeader(request.headers, 'x-gridex-event-id')
  const deliveryId = requiredHeader(request.headers, 'x-gridex-delivery-id')
  const timestamp = requiredHeader(request.headers, 'x-gridex-timestamp')
  const signature = requiredHeader(request.headers, 'x-gridex-signature')
  if (!eventId || !deliveryId || !timestamp || !signature) {
    return errorResponse('missing_webhook_headers', 'Canonical Gridex webhook headers are required.', 400)
  }

  const contentType = request.headers.get('content-type')?.toLowerCase() ?? ''
  if (!contentType.startsWith('application/json')) {
    return errorResponse('unsupported_media_type', 'Content-Type must be application/json.', 415)
  }

  const secret = env('GRIDEX_WEBHOOK_SIGNING_SECRET')
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
    return errorResponse('webhook_not_configured', 'Canonical webhook signing is not configured.', 503)
  }

  const rawBody = await request.text()
  if (!verifySignature({ rawBody, timestamp, signature, secret })) {
    return errorResponse('invalid_webhook_signature', 'Webhook signature or timestamp is invalid.', 401)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(rawBody)
  } catch {
    return errorResponse('invalid_webhook_payload', 'Webhook payload is not valid JSON.', 400)
  }

  const envelope = parseGenericEnvelope(parsed)
  if (!envelope) {
    return errorResponse('invalid_webhook_payload', 'Webhook envelope is invalid.', 400)
  }

  if (
    envelope.id !== eventId ||
    envelope.tenant_reference !== envelope.data.tenant_reference
  ) {
    return errorResponse('webhook_identity_mismatch', 'Signed webhook identifiers do not match.', 400)
  }

  try {
    const integration = await getVerifiedOpsIntegrationContext()
    if (envelope.tenant_reference !== integration.tenant_reference) {
      return errorResponse('webhook_tenant_mismatch', 'Webhook tenant does not match this deployment.', 403)
    }
  } catch {
    return errorResponse('webhook_tenant_unavailable', 'Webhook tenant context is unavailable.', 503)
  }

  const payloadHash = createHash('sha256').update(rawBody).digest('hex')
  const supabase = serviceClient()
  if (envelope.type !== 'contracts.publication.changed') {
    console.warn('[generic webhook] signed unknown event retained', {
      event_type: envelope.type,
      event_id: eventId,
      delivery_id: deliveryId,
    })
    const { data, error } = await supabase.rpc('store_ops_generic_event', {
      p_event_id: eventId,
      p_delivery_id: deliveryId,
      p_event_type: envelope.type,
      p_tenant_reference: envelope.tenant_reference,
      p_created_at: envelope.created_at,
      p_payload_hash: payloadHash,
      p_payload: envelope,
    })
    if (error) {
      console.error('[generic webhook] durable store failed', {
        code: error.code,
        message: error.message,
      })
      return errorResponse('webhook_storage_failed', 'Webhook could not be durably stored.', 500)
    }
    const result = (Array.isArray(data) ? data[0] : data) as ApplyResult | null
    if (!result) {
      return errorResponse('webhook_storage_failed', 'Webhook store returned no durable result.', 500)
    }
    if (result.result === 'identifier_conflict') {
      return errorResponse(
        'webhook_identifier_conflict',
        'Event and delivery identifiers were reused with different signed content.',
        409,
      )
    }
    return NextResponse.json({
      ok: true,
      result: result.result,
      event_id: eventId,
      delivery_id: deliveryId,
      event_type: envelope.type,
      cache_invalidated: false,
    })
  }

  let payload: PublicationChangedWebhook
  try {
    assertWebsiteRequest(
      'PublicationChangedWebhook',
      envelope,
      '/webhooks/contracts.publication.changed',
    )
    payload = envelope as PublicationChangedWebhook
  } catch {
    return errorResponse('invalid_webhook_payload', 'Webhook payload does not match the canonical schema.', 400)
  }

  const { data, error } = await supabase.rpc('apply_ops_publication_event', {
    p_event_id: eventId,
    p_delivery_id: deliveryId,
    p_tenant_reference: payload.tenant_reference,
    p_channel: payload.data.channel,
    p_publication_revision: payload.data.publication_revision,
    p_revision_token: payload.data.revision_token,
    p_publication_reason: payload.data.reason,
    p_event_timestamp: payload.data.timestamp,
    p_created_at: payload.created_at,
    p_aggregate_id: payload.aggregate.id,
    p_payload_hash: payloadHash,
    p_payload: payload,
  })
  if (error) {
    console.error('[publication webhook] durable apply failed', {
      code: error.code,
      message: error.message,
    })
    return errorResponse('webhook_storage_failed', 'Webhook could not be durably applied.', 500)
  }

  const result = (Array.isArray(data) ? data[0] : data) as ApplyResult | null
  if (!result) {
    return errorResponse('webhook_storage_failed', 'Webhook apply returned no durable result.', 500)
  }
  if (result.result === 'identifier_conflict') {
    return errorResponse(
      'webhook_identifier_conflict',
      'Event or delivery ID was reused with different signed content.',
      409,
    )
  }
  if (result.cache_invalidated && payload.data.channel === 'website') {
    invalidateOpsPublicContractsCache({
      tenantReference: payload.tenant_reference,
      channel: payload.data.channel,
      publicationRevision: payload.data.publication_revision,
    })
  }

  return NextResponse.json({
    ok: true,
    result: result.result,
    event_id: eventId,
    delivery_id: deliveryId,
    publication_revision: result.stored_revision,
    cache_invalidated: result.cache_invalidated,
  })
}
