import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  customerNotificationForEvent,
  parseOpsWebhookPayload,
  verifyOpsWebhookSignature,
} from '@/lib/webhooks/opsWebhook'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type WebhookLogRow = {
  id: string
  event_id: string
  status: string
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

function profileMatchesIdentity(
  row: UserLookupRow,
  args: {
    customerNumber?: string | null
    externalCustomerId?: string | null
    customerEmail?: string | null
  },
) {
  const customerNumber = normalizeText(args.customerNumber)
  const externalCustomerId = normalizeText(args.externalCustomerId)
  const email = normalizeEmail(args.customerEmail)

  if (!customerNumber && !externalCustomerId && !email) return true
  if (customerNumber && [row.customer_number, row.contract_customer_ref].includes(customerNumber)) return true
  if (externalCustomerId && row.external_customer_id === externalCustomerId) return true
  if (email && row.email?.toLowerCase() === email) return true
  return false
}

async function uniqueProfileBy(
  supabase: ReturnType<typeof serviceClient>,
  column: 'external_customer_id' | 'customer_number' | 'contract_customer_ref' | 'email',
  value: string | null,
): Promise<UserLookupRow | null> {
  if (!value) return null
  const queryValue = column === 'email' ? value.toLowerCase() : value
  const { data } = await supabase
    .from('customer_profiles')
    .select('user_id,email,customer_number,contract_customer_ref,external_customer_id')
    .eq(column, queryValue)
    .limit(2)
    .returns<UserLookupRow[]>()

  return data?.length === 1 ? data[0] : null
}

async function resolveUserId(
  supabase: ReturnType<typeof serviceClient>,
  args: {
    portalUserId?: string | null
    customerNumber?: string | null
    externalCustomerId?: string | null
    customerEmail?: string | null
  },
) {
  const portalUserId = normalizeText(args.portalUserId)
  const customerNumber = normalizeText(args.customerNumber)
  const externalCustomerId = normalizeText(args.externalCustomerId)
  const customerEmail = normalizeEmail(args.customerEmail)

  if (portalUserId) {
    const { data } = await supabase
      .from('customer_profiles')
      .select('user_id,email,customer_number,contract_customer_ref,external_customer_id')
      .eq('user_id', portalUserId)
      .maybeSingle<UserLookupRow>()

    if (data && profileMatchesIdentity(data, args)) return data.user_id
  }

  const byExternal = await uniqueProfileBy(supabase, 'external_customer_id', externalCustomerId)
  if (byExternal?.user_id) return byExternal.user_id

  const byCustomerNumber =
    (await uniqueProfileBy(supabase, 'customer_number', customerNumber)) ??
    (await uniqueProfileBy(supabase, 'contract_customer_ref', customerNumber))
  if (byCustomerNumber?.user_id) return byCustomerNumber.user_id

  const byEmail = await uniqueProfileBy(supabase, 'email', customerEmail)
  if (byEmail?.user_id) return byEmail.user_id

  return null
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

  const secret = env('GRIDEX_OPS_WEBHOOK_SECRET') ?? env('GRIDEX_WEBHOOK_SIGNING_SECRET')
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

  const event = parseOpsWebhookPayload(payload)
  if (!event) {
    return NextResponse.json({ error: 'Unsupported webhook event.' }, { status: 400 })
  }

  const supabase = serviceClient()
  const payloadHash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(rawBody)
  )
  const payloadHashHex = Array.from(new Uint8Array(payloadHash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')

  const deliveryId = req.headers.get('x-gridex-delivery-id')

  const { data: logRow, error: logError } = await supabase
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
      occurred_at: event.occurred_at,
      status: 'received',
      signature_valid: true,
      payload_hash: payloadHashHex,
      payload: event.raw,
    })
    .select('id,event_id,status')
    .single<WebhookLogRow>()

  if (logError) {
    const duplicate =
      logError.code === '23505' || logError.message.toLowerCase().includes('duplicate')
    if (duplicate) {
      return NextResponse.json({ ok: true, duplicate: true })
    }
    return NextResponse.json({ error: logError.message }, { status: 500 })
  }

  const notification = customerNotificationForEvent(event)
  let notificationCreated = false

  try {
    if (notification) {
      const userId = await resolveUserId(supabase, {
        portalUserId: event.portal_user_id,
        customerNumber: event.customer_number,
        externalCustomerId: event.external_customer_id,
        customerEmail: event.customer_email,
      })
      await backfillProfileIdentity(supabase, userId, event)

      const { error: notificationError } = await supabase
        .from('customer_notifications')
        .insert({
          user_id: userId,
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
            company_id: event.company_id,
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

    await supabase
      .from('ops_webhook_events')
      .update({
        status: 'processed',
        processed_at: new Date().toISOString(),
        notification_created: notificationCreated,
      })
      .eq('id', logRow.id)

    return NextResponse.json({ ok: true, event_id: event.event_id, notificationCreated })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook processing failed.'
    await supabase
      .from('ops_webhook_events')
      .update({
        status: 'failed',
        processed_at: new Date().toISOString(),
        error_message: message,
      })
      .eq('id', logRow.id)

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
