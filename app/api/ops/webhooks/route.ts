import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  customerNotificationForEvent,
  isSupportedOpsWebhookEventType,
  parseOpsWebhookEnvelope,
  verifyOpsWebhookSignature,
} from '@/lib/webhooks/opsWebhook'
import { getVerifiedOpsIntegrationContext, invalidateOpsPublicContractsCache } from '@/lib/ops/client'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type WebhookLogRow = {
  id: string
  event_id: string
  status: string
  attempt_count?: number
  last_attempt_at?: string | null
  payload_hash?: string | null
}

type UserLookupRow = {
  user_id: string
  email: string | null
  customer_number: string | null
  contract_customer_ref: string | null
  external_customer_id: string | null
}

function env(name: string): string | null {
  const value = process.env[name]?.trim()
  return value ? value : null
}

function serviceClient() {
  const url = env('NEXT_PUBLIC_SUPABASE_URL')
  const key = env('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) {
    throw new Error('Webhook storage is not configured.')
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function normalizeText(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function normalizeEmail(value?: string | null) {
  return normalizeText(value)?.toLowerCase() ?? null
}


function webhookSecret(): { secret: string | null; conflict: boolean } {
  const canonical = env('GRIDEX_WEBHOOK_SIGNING_SECRET')
  const legacy = env('GRIDEX_OPS_WEBHOOK_SECRET')
  return {
    secret: canonical ?? legacy,
    conflict: Boolean(canonical && legacy && canonical !== legacy),
  }
}

type IdentityResolution = {
  userId: string | null
  status: 'resolved' | 'pending' | 'ambiguous'
  error: string | null
}

async function profilesBy(
  supabase: ReturnType<typeof serviceClient>,
  column: 'external_customer_id' | 'customer_number' | 'contract_customer_ref' | 'email',
  value: string | null,
): Promise<UserLookupRow[]> {
  if (!value) return []
  const queryValue = column === 'email' ? value.toLowerCase() : value
  const { data, error } = await supabase
    .from('customer_profiles')
    .select('user_id,email,customer_number,contract_customer_ref,external_customer_id')
    .eq(column, queryValue)
    .limit(3)
    .returns<UserLookupRow[]>()
  if (error) throw new Error(error.message)
  return data ?? []
}

function portalProfileConflicts(
  row: UserLookupRow,
  args: {
    customerNumber: string | null
    externalCustomerId: string | null
    customerEmail: string | null
  },
): boolean {
  if (
    args.customerNumber &&
    (row.customer_number || row.contract_customer_ref) &&
    ![row.customer_number, row.contract_customer_ref].includes(args.customerNumber)
  ) return true
  if (
    args.externalCustomerId &&
    row.external_customer_id &&
    row.external_customer_id !== args.externalCustomerId
  ) return true
  if (
    args.customerEmail &&
    row.email &&
    row.email.toLowerCase() !== args.customerEmail
  ) return true
  return false
}

async function resolveUserIdentity(
  supabase: ReturnType<typeof serviceClient>,
  args: {
    portalUserId?: string | null
    customerNumber?: string | null
    externalCustomerId?: string | null
    customerEmail?: string | null
  },
): Promise<IdentityResolution> {
  const portalUserId = normalizeText(args.portalUserId)
  const customerNumber = normalizeText(args.customerNumber)
  const externalCustomerId = normalizeText(args.externalCustomerId)
  const customerEmail = normalizeEmail(args.customerEmail)
  const normalized = { customerNumber, externalCustomerId, customerEmail }

  if (portalUserId) {
    const { data, error } = await supabase
      .from('customer_profiles')
      .select('user_id,email,customer_number,contract_customer_ref,external_customer_id')
      .eq('user_id', portalUserId)
      .maybeSingle<UserLookupRow>()
    if (error) throw new Error(error.message)
    if (data) {
      if (portalProfileConflicts(data, normalized)) {
        return {
          userId: null,
          status: 'ambiguous',
          error: 'Portal user ID conflicts with customer identifiers in the OPS event.',
        }
      }
      return { userId: data.user_id, status: 'resolved', error: null }
    }
  }

  const [externalRows, customerNumberRows, contractRefRows, emailRows] = await Promise.all([
    profilesBy(supabase, 'external_customer_id', externalCustomerId),
    profilesBy(supabase, 'customer_number', customerNumber),
    profilesBy(supabase, 'contract_customer_ref', customerNumber),
    profilesBy(supabase, 'email', customerEmail),
  ])
  if ([externalRows, customerNumberRows, contractRefRows, emailRows].some((rows) => rows.length > 1)) {
    return { userId: null, status: 'ambiguous', error: 'At least one customer identifier matched multiple portal profiles.' }
  }

  const externalUser = externalRows[0]?.user_id ?? null
  const customerUsers = new Set([...customerNumberRows, ...contractRefRows].map((row) => row.user_id))
  if (customerUsers.size > 1) {
    return { userId: null, status: 'ambiguous', error: 'Customer number matched different portal profiles.' }
  }
  const customerUser = [...customerUsers][0] ?? null
  const emailUser = emailRows[0]?.user_id ?? null
  const candidates = new Set([externalUser, customerUser, emailUser].filter((value): value is string => Boolean(value)))
  if (candidates.size > 1) {
    return { userId: null, status: 'ambiguous', error: 'Customer identifiers matched different portal profiles.' }
  }
  if (externalUser) return { userId: externalUser, status: 'resolved', error: null }
  if (candidates.size === 1) {
    const userId = [...candidates][0]
    const matchingAttributes = Number(customerUser === userId) + Number(emailUser === userId)
    if (matchingAttributes >= 2) return { userId, status: 'resolved', error: null }
    return { userId: null, status: 'pending', error: 'At least two matching customer attributes are required before automatic portal linking.' }
  }
  return { userId: null, status: 'pending', error: 'No local portal profile matched the OPS event yet.' }
}

async function backfillProfileIdentity(
  supabase: ReturnType<typeof serviceClient>,
  userId: string | null,
  event: {
    customer_number?: string | null
    external_customer_id?: string | null
    customer_email?: string | null
    metadata: Record<string, unknown>
  },
) {
  if (!userId) return
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  const email = normalizeEmail(event.customer_email)
  const customerNumber = normalizeText(event.customer_number)
  const externalCustomerId = normalizeText(event.external_customer_id)

  if (email) patch.email = email
  if (customerNumber) {
    patch.customer_number = customerNumber
    patch.contract_customer_ref = customerNumber
  }
  if (externalCustomerId && externalCustomerId !== customerNumber) {
    patch.external_customer_id = externalCustomerId
  }

  if (Object.keys(patch).length <= 1) return

  await supabase
    .from('customer_profiles')
    .update(patch)
    .eq('user_id', userId)
}

export async function POST(req: Request) {
  if (env('GRIDEX_ENABLE_OPS_WEBHOOKS') !== 'true') {
    return NextResponse.json({ error: 'Webhooks are disabled.' }, { status: 404 })
  }

  const secretConfig = webhookSecret()
  if (secretConfig.conflict) {
    console.error('[ops webhook] conflicting webhook secrets are configured')
    return NextResponse.json({ error: 'Webhook configuration conflict.' }, { status: 503 })
  }
  const secret = secretConfig.secret
  if (!secret) {
    return NextResponse.json({ error: 'Webhook secret is not configured.' }, { status: 503 })
  }
  const rawBody = await req.text()
  const toleranceSeconds = Number(env('GRIDEX_OPS_WEBHOOK_TOLERANCE_SECONDS') ?? '300')
  const signature = verifyOpsWebhookSignature({
    rawBody,
    headers: req.headers,
    secret,
    toleranceSeconds: Number.isFinite(toleranceSeconds) ? toleranceSeconds : 300,
  })

  if (!signature.ok) {
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 })
  }

  const event = parseOpsWebhookEnvelope(payload)
  if (!event) {
    return NextResponse.json({ error: 'Invalid webhook event envelope.' }, { status: 400 })
  }
  const headerEventId = req.headers.get('x-gridex-event-id')
  const headerEventType = req.headers.get('x-gridex-event-type')
  if ((headerEventId && headerEventId !== event.event_id) || (headerEventType && headerEventType !== event.event_type)) {
    console.error('[ops webhook] header/body mismatch', { headerEventId, headerEventType, eventId: event.event_id, eventType: event.event_type })
    return NextResponse.json({ error: 'Webhook headers do not match the signed body.' }, { status: 400 })
  }
  if (event.tenant_reference) {
    try {
      const expectedTenantReference = (await getVerifiedOpsIntegrationContext()).tenant_reference
      if (event.tenant_reference !== expectedTenantReference) {
        return NextResponse.json({ error: 'Webhook tenant does not match this deployment.' }, { status: 403 })
      }
    } catch (error) {
      console.error('[ops webhook] tenant verification failed', {
        status: error && typeof error === 'object' && 'status' in error ? Number((error as { status: unknown }).status) : null,
      })
      return NextResponse.json({ error: 'Webhook tenant context is unavailable.' }, { status: 503 })
    }
  }

  const supabase = serviceClient()
  const payloadHash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(rawBody)
  )
  const payloadHashHex = Array.from(new Uint8Array(payloadHash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')

  const deliveryId = req.headers.get('x-gridex-delivery-id') ?? event.delivery_id

  const now = new Date().toISOString()
  let logRow: WebhookLogRow | null = null
  const { data: inserted, error: logError } = await supabase
    .from('ops_webhook_events')
    .insert({
      event_id: event.event_id,
      event_type: event.event_type,
      company_id: event.company_id,
      customer_id: event.customer_id,
      customer_number: event.customer_number,
      external_customer_id: event.external_customer_id,
      customer_email: event.customer_email,
      portal_user_id: event.portal_user_id,
      delivery_id: deliveryId,
      header_event_id: headerEventId,
      header_event_type: headerEventType,
      tenant_reference: event.tenant_reference,
      channel: event.channel,
      publication_revision: event.publication_revision,
      publication_reason: event.publication_reason,
      event_timestamp: event.occurred_at,
      occurred_at: event.occurred_at,
      status: 'processing',
      signature_valid: true,
      payload_hash: payloadHashHex,
      payload: event.raw,
      attempt_count: 1,
      last_attempt_at: now,
    })
    .select('id,event_id,status,attempt_count,last_attempt_at,payload_hash')
    .single<WebhookLogRow>()

  if (logError) {
    const duplicate = logError.code === '23505' || logError.message.toLowerCase().includes('duplicate')
    if (!duplicate) return NextResponse.json({ error: logError.message }, { status: 500 })

    const { data: existing, error: existingError } = await supabase
      .from('ops_webhook_events')
      .select('id,event_id,status,attempt_count,last_attempt_at,payload_hash')
      .eq('event_id', event.event_id)
      .maybeSingle<WebhookLogRow>()
    if (existingError || !existing) {
      return NextResponse.json({ error: existingError?.message ?? 'Webhook state unavailable.' }, { status: 500 })
    }
    if (existing.payload_hash && existing.payload_hash !== payloadHashHex) {
      return NextResponse.json(
        { error: 'Webhook event ID was reused with a different payload.' },
        { status: 409 },
      )
    }
    if (existing.status === 'processed') {
      return NextResponse.json({ ok: true, duplicate: true, event_id: event.event_id })
    }

    const lastAttempt = existing.last_attempt_at ? Date.parse(existing.last_attempt_at) : 0
    const processingIsFresh =
      existing.status === 'processing' &&
      Number.isFinite(lastAttempt) &&
      Date.now() - lastAttempt < 10 * 60_000
    if (processingIsFresh) {
      return NextResponse.json({ ok: true, duplicate: true, processing: true, event_id: event.event_id })
    }

    const claimQuery = supabase
      .from('ops_webhook_events')
      .update({
        status: 'processing',
        payload_hash: payloadHashHex,
        payload: event.raw,
        delivery_id: deliveryId,
        error_message: null,
        attempt_count: (existing.attempt_count ?? 0) + 1,
        last_attempt_at: now,
      })
      .eq('id', existing.id)
      .eq('attempt_count', existing.attempt_count ?? 0)
      .in('status', ['failed', 'received', 'processing'])

    const { data: claimed, error: claimError } = await claimQuery
      .select('id,event_id,status,attempt_count,last_attempt_at,payload_hash')
      .maybeSingle<WebhookLogRow>()
    if (claimError) {
      return NextResponse.json({ error: claimError.message }, { status: 500 })
    }
    if (!claimed) {
      return NextResponse.json({ ok: true, duplicate: true, processing: true, event_id: event.event_id })
    }
    logRow = claimed
  } else {
    logRow = inserted
  }

  if (!logRow) return NextResponse.json({ error: 'Webhook could not be claimed.' }, { status: 500 })

  if (!isSupportedOpsWebhookEventType(event.event_type)) {
    const { error: ignoredError } = await supabase
      .from('ops_webhook_events')
      .update({
        status: 'processed',
        processed_at: new Date().toISOString(),
        next_attempt_at: null,
        notification_created: false,
        handling_note: 'ignored_unknown_type',
        error_message: null,
      })
      .eq('id', logRow.id)
      .eq('status', 'processing')
    if (ignoredError) return NextResponse.json({ error: ignoredError.message }, { status: 500 })
    return NextResponse.json({ ok: true, ignored: true, event_id: event.event_id }, { status: 202 })
  }

  if (event.event_type === 'contracts.publication.changed') {
    if (!event.channel || event.channel !== 'website' || !event.publication_revision) {
      const { error: invalidPublicationError } = await supabase
        .from('ops_webhook_events')
        .update({
          status: 'failed',
          processed_at: new Date().toISOString(),
          next_attempt_at: null,
          notification_created: false,
          handling_note: 'invalid_publication_event',
          error_message: 'Publication event requires channel=website and publication_revision.',
        })
        .eq('id', logRow.id)
        .eq('status', 'processing')
      if (invalidPublicationError) return NextResponse.json({ error: invalidPublicationError.message }, { status: 500 })
      return NextResponse.json({ error: 'Invalid publication event.' }, { status: 400 })
    }

    const { data: existingState } = await supabase
      .from('ops_publication_state')
      .select('publication_revision,event_timestamp,event_id')
      .eq('tenant_reference', event.tenant_reference)
      .eq('channel', event.channel)
      .maybeSingle<{ publication_revision: string | null; event_timestamp: string | null; event_id: string | null }>()
    const incomingAt = Date.parse(event.occurred_at)
    const existingAt = Date.parse(existingState?.event_timestamp ?? '')
    const stale = Number.isFinite(existingAt) && Number.isFinite(incomingAt) && incomingAt < existingAt
    if (!stale && existingState?.event_id !== event.event_id) {
      const { error: stateError } = await supabase.from('ops_publication_state').upsert({
        tenant_reference: event.tenant_reference,
        channel: event.channel,
        publication_revision: event.publication_revision,
        etag: null,
        event_id: event.event_id,
        event_timestamp: event.occurred_at,
        publication_reason: event.publication_reason,
        changed_at: event.occurred_at,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'tenant_reference,channel' })
      if (stateError) return NextResponse.json({ error: stateError.message }, { status: 500 })
      invalidateOpsPublicContractsCache({ tenantReference: event.tenant_reference, channel: event.channel, publicationRevision: event.publication_revision })
    }
    const { error: publicationError } = await supabase
      .from('ops_webhook_events')
      .update({
        status: 'processed',
        processed_at: new Date().toISOString(),
        next_attempt_at: null,
        notification_created: false,
        handling_note: stale ? 'publication_event_ignored_as_stale' : 'publication_state_updated',
        error_message: null,
      })
      .eq('id', logRow.id)
      .eq('status', 'processing')
    if (publicationError) return NextResponse.json({ error: publicationError.message }, { status: 500 })
    return NextResponse.json({
      ok: true,
      event_id: event.event_id,
      publication_revision: event.publication_revision,
      cache_invalidated: !stale,
    })
  }

  const notification = customerNotificationForEvent(event)
  let notificationCreated = false

  try {
    if (notification) {
      const resolution = await resolveUserIdentity(supabase, {
        portalUserId: event.portal_user_id,
        customerNumber: event.customer_number,
        externalCustomerId: event.external_customer_id,
        customerEmail: event.customer_email,
      })
      const userId = resolution.userId
      await backfillProfileIdentity(supabase, userId, event)

      const { error: notificationError } = await supabase
        .from('customer_notifications')
        .insert({
          user_id: userId,
          identity_resolution_status: resolution.status,
          identity_resolution_error: resolution.error,
          identity_resolution_attempt_count: resolution.status === 'resolved' ? 0 : 1,
          identity_resolution_last_attempt_at: resolution.status === 'resolved' ? null : now,
          identity_resolution_next_attempt_at:
            resolution.status === 'pending' ? new Date(Date.now() + 5 * 60_000).toISOString() : null,
          channel: 'portal',
          category: notification.category,
          title: notification.title,
          body: notification.body,
          related_entity_type: 'ops_event',
          related_entity_id: event.event_id,
          is_read: false,
          delivery_status: 'ready',
          customer_number: event.customer_number,
          external_customer_id: event.external_customer_id,
          customer_email: event.customer_email,
          ops_event_id: event.event_id,
          link_href: notification.link_href,
          priority: 'normal',
          metadata: {
            source: 'ops_webhook',
            event_type: event.event_type,
            tenant_reference: event.tenant_reference,
            customer_id: event.customer_id,
            customer_number: event.customer_number,
            external_customer_id: event.external_customer_id,
            ...event.metadata,
          },
        })

      if (notificationError) {
        const duplicate =
          notificationError.code === '23505' ||
          notificationError.message.toLowerCase().includes('duplicate')
        if (!duplicate) throw new Error(notificationError.message)
      } else {
        notificationCreated = true
      }
    }

    const { data: completed, error: processedError } = await supabase
      .from('ops_webhook_events')
      .update({
        status: 'processed',
        processed_at: new Date().toISOString(),
        next_attempt_at: null,
        notification_created: notificationCreated,
        error_message: null,
      })
      .eq('id', logRow.id)
      .eq('status', 'processing')
      .select('id')
      .maybeSingle<{ id: string }>()
    if (processedError) throw new Error(`Webhook completion state failed: ${processedError.message}`)
    if (!completed?.id) throw new Error('Webhook completion state was lost to a concurrent worker.')


    return NextResponse.json({ ok: true, event_id: event.event_id, notificationCreated })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook processing failed.'
    const { error: failedStateError } = await supabase
      .from('ops_webhook_events')
      .update({
        status: 'failed',
        processed_at: new Date().toISOString(),
        next_attempt_at: new Date(Date.now() + 5 * 60_000).toISOString(),
        error_message: message,
      })
      .eq('id', logRow.id)
      .eq('status', 'processing')
    if (failedStateError) {
      console.error('[ops webhook] failed to persist failed processing state', failedStateError)
    }

    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 })
  }
}
