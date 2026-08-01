import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { revalidatePath, revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getVerifiedOpsIntegrationContext, invalidateOpsPublicContractsCache } from '@/lib/ops/client'
import { WEBSITE_PUBLIC_CONTRACT_PATHS, WEBSITE_PUBLIC_CONTRACTS_CACHE_TAG } from '@/lib/website/publicContractCache'
import { assertWebsiteRequest } from '@/lib/ops/validators/openapi'

type PublicationChangedWebhook = {
  event_id: string
  delivery_id: string
  event_type: 'contracts.publication.changed'
  created_at: string
  tenant_reference: string
  aggregate: {
    type: 'contract_publication'
    reference: string
  }
  data: {
    channel: 'website' | 'api' | 'internal' | 'phone' | 'partner'
    publication_revision: number
    revision_token: string
    reason: string
    timestamp: string
  }
  contract_schema_version: string
}

type ApplyResult = {
  result:
    | 'applied'
    | 'duplicate'
    | 'stale'
    | 'ignored'
    | 'stored'
    | 'identifier_conflict'
    | 'retryable_failure'
    | 'permanent_failure'
  cache_invalidated: boolean
  stored_revision: number | null
  notification_created?: boolean
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

function invalidateWebsiteContractSurfaces(args: {
  tenantReference: string
  publicationRevision: number
}): boolean {
  invalidateOpsPublicContractsCache({
    tenantReference: args.tenantReference,
    channel: 'website',
    publicationRevision: args.publicationRevision,
  })

  try {
    revalidateTag(WEBSITE_PUBLIC_CONTRACTS_CACHE_TAG, 'max')
    for (const path of WEBSITE_PUBLIC_CONTRACT_PATHS) revalidatePath(path)
    return true
  } catch (error) {
    console.error('[publication webhook] cache revalidation failed after durable apply', {
      tenant_reference: args.tenantReference,
      publication_revision: args.publicationRevision,
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}

export async function handlePublicationChangedWebhook(request: Request) {
  const eventId = requiredHeader(request.headers, 'x-gridex-event-id')
  const eventTypeHeader = request.headers.get('x-gridex-event-type')?.trim() || null
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

  let publicationPayload: PublicationChangedWebhook
  try {
    assertWebsiteRequest(
      'PublicationChangedWebhook',
      parsed,
      '/webhooks/contracts.publication.changed',
    )
    publicationPayload = parsed as PublicationChangedWebhook
  } catch {
    return errorResponse('invalid_webhook_payload', 'Webhook payload does not match the canonical schema.', 400)
  }

  if (
    publicationPayload.event_id !== eventId ||
    publicationPayload.delivery_id !== deliveryId ||
    (eventTypeHeader !== null && publicationPayload.event_type !== eventTypeHeader)
  ) {
    return errorResponse('webhook_identity_mismatch', 'Signed webhook identifiers do not match.', 400)
  }

  const tenantReference = publicationPayload.tenant_reference

  try {
    const integration = await getVerifiedOpsIntegrationContext()
    if (tenantReference !== integration.tenant_reference) {
      return errorResponse('webhook_tenant_mismatch', 'Webhook tenant does not match this deployment.', 403)
    }
  } catch {
    return errorResponse('webhook_tenant_unavailable', 'Webhook tenant context is unavailable.', 503)
  }

  const payloadHash = createHash('sha256').update(rawBody).digest('hex')
  const supabase = serviceClient()

  const payload = publicationPayload

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
    p_aggregate_id: payload.aggregate.reference,
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
  const shouldRevalidateWebsite = payload.data.channel === 'website' && (
    result.cache_invalidated || result.result === 'duplicate'
  )
  const cacheRevalidated = shouldRevalidateWebsite
    ? invalidateWebsiteContractSurfaces({
        tenantReference: payload.tenant_reference,
        publicationRevision: payload.data.publication_revision,
      })
    : false

  return NextResponse.json({
    ok: true,
    result: result.result,
    event_id: eventId,
    delivery_id: deliveryId,
    publication_revision: result.stored_revision,
    cache_invalidated: result.cache_invalidated,
    cache_revalidated: cacheRevalidated,
  })
}
