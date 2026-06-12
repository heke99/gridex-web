import { createHmac, timingSafeEqual } from 'node:crypto'

export type OpsWebhookEvent = {
  event_id: string
  event_type: string
  occurred_at: string
  customer_id?: string | null
  customer_number?: string | null
  customer_email?: string | null
  portal_user_id?: string | null
  title?: string | null
  message?: string | null
  link_href?: string | null
  metadata: Record<string, unknown>
  raw: Record<string, unknown>
}

const ALLOWED_EVENT_TYPES = new Set([
  'customer.application.received',
  'customer.application.needs_facility_data',
  'customer.facility_data.requested',
  'customer.facility.verified',
  'customer.switch.requested',
  'customer.switch.confirmed',
  'customer.contract.active',
  'customer.invoice.created',
  'customer.invoice.due_soon',
  'customer.invoice.paid',
  'customer.metering_values.updated',
  'customer.document.created',
  'customer.message.created',
])

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function normalizeSignature(value: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const parts = trimmed.split(',').map((part) => part.trim())
  const shaPart = parts.find((part) => part.startsWith('sha256='))
  return (shaPart ?? trimmed).replace(/^sha256=/, '')
}

function safeEqualHex(a: string, b: string): boolean {
  if (!/^[a-f0-9]+$/i.test(a) || !/^[a-f0-9]+$/i.test(b)) return false
  const left = Buffer.from(a, 'hex')
  const right = Buffer.from(b, 'hex')
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

export function verifyOpsWebhookSignature(args: {
  rawBody: string
  headers: Headers
  secret: string
  toleranceSeconds: number
}): { ok: true; timestamp: string | null } | { ok: false; reason: string } {
  const signature = normalizeSignature(
    args.headers.get('x-gridex-signature') ??
      args.headers.get('x-gridex-webhook-signature') ??
      args.headers.get('x-webhook-signature')
  )

  if (!signature) return { ok: false, reason: 'missing_signature' }

  const timestamp =
    args.headers.get('x-gridex-timestamp') ??
    args.headers.get('x-webhook-timestamp') ??
    args.headers.get('x-timestamp')

  if (timestamp) {
    const ts = Number(timestamp)
    if (!Number.isFinite(ts)) return { ok: false, reason: 'invalid_timestamp' }
    const tsMs = ts > 10_000_000_000 ? ts : ts * 1000
    const drift = Math.abs(Date.now() - tsMs)
    if (drift > args.toleranceSeconds * 1000) {
      return { ok: false, reason: 'timestamp_outside_tolerance' }
    }
  }

  const candidates = [
    timestamp ? `${timestamp}.${args.rawBody}` : null,
    args.rawBody,
  ].filter((value): value is string => Boolean(value))

  for (const candidate of candidates) {
    const expected = createHmac('sha256', args.secret).update(candidate).digest('hex')
    if (safeEqualHex(signature, expected)) return { ok: true, timestamp }
  }

  return { ok: false, reason: 'invalid_signature' }
}

export function parseOpsWebhookPayload(payload: unknown): OpsWebhookEvent | null {
  const root = object(payload)
  const data = object(root.data)
  const eventType = text(root.event_type) ?? text(root.type)
  const eventId = text(root.event_id) ?? text(root.id) ?? text(data.event_id)

  if (!eventId || !eventType || !ALLOWED_EVENT_TYPES.has(eventType)) {
    return null
  }

  const occurredAt =
    text(root.occurred_at) ?? text(root.created_at) ?? new Date().toISOString()

  return {
    event_id: eventId,
    event_type: eventType,
    occurred_at: occurredAt,
    customer_id: text(root.customer_id) ?? text(data.customer_id),
    customer_number: text(root.customer_number) ?? text(data.customer_number),
    customer_email: text(root.customer_email) ?? text(data.customer_email),
    portal_user_id: text(root.portal_user_id) ?? text(data.portal_user_id) ?? text(data.user_id),
    title: text(root.title) ?? text(data.title),
    message: text(root.message) ?? text(root.summary) ?? text(data.message) ?? text(data.summary),
    link_href: text(root.link_href) ?? text(data.link_href),
    metadata: object(root.metadata ?? data.metadata ?? data),
    raw: root,
  }
}

export function customerNotificationForEvent(event: OpsWebhookEvent) {
  switch (event.event_type) {
    case 'customer.application.received':
      return {
        category: 'application',
        title: 'Vi har tagit emot din ansökan',
        body: 'Din ansökan är mottagen. Vi går igenom uppgifterna och återkommer om något behöver kompletteras.',
        link_href: '/mina-sidor',
      }
    case 'customer.application.needs_facility_data':
    case 'customer.facility_data.requested':
      return {
        category: 'facility',
        title: 'Vi kontrollerar dina anläggningsuppgifter',
        body: 'Vi arbetar med att verifiera uppgifterna för din anläggning. Du behöver inte skicka in en ny ansökan.',
        link_href: '/mina-sidor',
      }
    case 'customer.facility.verified':
      return {
        category: 'facility',
        title: 'Dina anläggningsuppgifter är verifierade',
        body: 'Vi har verifierat uppgifterna och kan gå vidare med nästa steg.',
        link_href: '/dashboard/contracts',
      }
    case 'customer.switch.requested':
      return {
        category: 'switch',
        title: 'Leverantörsbytet är påbörjat',
        body: 'Vi har skickat vidare leverantörsbytet för behandling.',
        link_href: '/dashboard/contracts',
      }
    case 'customer.switch.confirmed':
      return {
        category: 'switch',
        title: 'Leverantörsbytet är bekräftat',
        body: 'Ditt leverantörsbyte är bekräftat. Du kan följa statusen på Mina sidor.',
        link_href: '/dashboard/contracts',
      }
    case 'customer.contract.active':
      return {
        category: 'contract',
        title: 'Ditt avtal är aktivt',
        body: 'Ditt elavtal är nu aktivt.',
        link_href: '/dashboard/contracts',
      }
    case 'customer.invoice.created':
      return {
        category: 'invoice',
        title: 'Ny faktura finns på Mina sidor',
        body: 'En ny faktura finns nu tillgänglig.',
        link_href: '/dashboard/invoices',
      }
    case 'customer.invoice.due_soon':
      return {
        category: 'invoice',
        title: 'Faktura förfaller snart',
        body: 'Du har en faktura som snart förfaller.',
        link_href: '/dashboard/invoices',
      }
    case 'customer.invoice.paid':
      return {
        category: 'invoice',
        title: 'Faktura markerad som betald',
        body: 'Vi har registrerat betalningen.',
        link_href: '/dashboard/invoices',
      }
    case 'customer.metering_values.updated':
      return {
        category: 'metering',
        title: 'Mätvärden har uppdaterats',
        body: 'Dina mätvärden har uppdaterats på Mina sidor.',
        link_href: '/mina-sidor',
      }
    case 'customer.document.created':
      return {
        category: 'document',
        title: 'Ett nytt dokument finns tillgängligt',
        body: 'Ett nytt dokument finns nu på Mina sidor.',
        link_href: '/mina-sidor',
      }
    case 'customer.message.created':
      return {
        category: 'message',
        title: event.title || 'Nytt meddelande',
        body: event.message || 'Du har ett nytt meddelande på Mina sidor.',
        link_href: event.link_href || '/mina-sidor',
      }
    default:
      return null
  }
}
