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

async function resolveUserId(args: {
  portalUserId?: string | null
  customerNumber?: string | null
  customerEmail?: string | null
}) {
  if (args.portalUserId) return args.portalUserId
  const supabase = serviceClient()

  if (args.customerNumber) {
    const { data } = await supabase
      .from('customer_profiles')
      .select('user_id')
      .or(
        `contract_customer_ref.eq.${args.customerNumber},customer_number.eq.${args.customerNumber}`
      )
      .limit(1)
      .maybeSingle<UserLookupRow>()
    if (data?.user_id) return data.user_id
  }

  if (args.customerEmail) {
    const { data } = await supabase
      .from('customer_profiles')
      .select('user_id')
      .eq('email', args.customerEmail.toLowerCase())
      .limit(1)
      .maybeSingle<UserLookupRow>()
    if (data?.user_id) return data.user_id
  }

  return null
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

  const { data: logRow, error: logError } = await supabase
    .from('ops_webhook_events')
    .insert({
      event_id: event.event_id,
      event_type: event.event_type,
      customer_id: event.customer_id,
      customer_number: event.customer_number,
      customer_email: event.customer_email,
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
      const userId = await resolveUserId({
        portalUserId: event.portal_user_id,
        customerNumber: event.customer_number,
        customerEmail: event.customer_email,
      })

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
          customer_email: event.customer_email,
          ops_event_id: event.event_id,
          link_href: notification.link_href,
          priority: 'normal',
          metadata: {
            source: 'ops_webhook',
            event_type: event.event_type,
            customer_id: event.customer_id,
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
