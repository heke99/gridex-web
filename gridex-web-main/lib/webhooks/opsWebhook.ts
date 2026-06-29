import { createHmac, timingSafeEqual } from 'node:crypto'

export type OpsWebhookEvent = {
  event_id: string
  event_type: string
  occurred_at: string
  company_id?: string | null
  customer_id?: string | null
  customer_number?: string | null
  external_customer_id?: string | null
  customer_email?: string | null
  portal_user_id?: string | null
  title?: string | null
  message?: string | null
  link_href?: string | null
  metadata: Record<string, unknown>
  raw: Record<string, unknown>
}

const ALLOWED_EVENT_TYPES = new Set([
  'customer.created',
  'customer.updated',
  'customer_number.assigned',
  'contract.application_received',
  'contract.confirmation_sent',
  'contract.cooling_off_sent',
  'contract.needs_facility_data',
  'power_of_attorney.signed',
  'document.created',
  'facility_data.received',
  'facility_data.verified',
  'invoice.created',
  'invoice.sent',
  'invoice.disputed',
  'metering_values.updated',
  'customer.opened_document',
  'customer.downloaded_document',
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
}): { ok: true; timestamp: string } | { ok: false; reason: string } {
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

  if (!timestamp) return { ok: false, reason: 'missing_timestamp' }

  const ts = Number(timestamp)
  if (!Number.isFinite(ts)) return { ok: false, reason: 'invalid_timestamp' }
  const tsMs = ts > 10_000_000_000 ? ts : ts * 1000
  const drift = Math.abs(Date.now() - tsMs)
  if (drift > args.toleranceSeconds * 1000) {
    return { ok: false, reason: 'timestamp_outside_tolerance' }
  }

  const expected = createHmac('sha256', args.secret)
    .update(`${timestamp}.${args.rawBody}`)
    .digest('hex')

  if (!safeEqualHex(signature, expected)) {
    return { ok: false, reason: 'invalid_signature' }
  }

  return { ok: true, timestamp }
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
    company_id: text(root.company_id) ?? text(data.company_id),
    customer_id: text(root.customer_id) ?? text(data.customer_id),
    customer_number: text(root.customer_number) ?? text(data.customer_number),
    external_customer_id:
      text(root.external_customer_id) ??
      text(root.externalCustomerId) ??
      text(data.external_customer_id) ??
      text(data.externalCustomerId),
    customer_email:
      text(root.customer_email) ??
      text(root.email) ??
      text(data.customer_email) ??
      text(data.email),
    portal_user_id:
      text(root.portal_user_id) ??
      text(root.customer_portal_user_id) ??
      text(data.portal_user_id) ??
      text(data.customer_portal_user_id) ??
      text(data.user_id),
    title: text(root.title) ?? text(data.title),
    message: text(root.message) ?? text(root.summary) ?? text(data.message) ?? text(data.summary),
    link_href: text(root.link_href) ?? text(data.link_href),
    metadata: object(root.metadata ?? data.metadata ?? data),
    raw: root,
  }
}

export function customerNotificationForEvent(event: OpsWebhookEvent) {
  switch (event.event_type) {
    case 'customer.created':
    case 'customer_number.assigned':
      return {
        category: 'customer',
        title: 'Ditt kundkonto är skapat',
        body: 'Ditt kundkonto är skapat och kan användas på Mina sidor när inloggningen är klar.',
        link_href: '/mina-sidor',
      }
    case 'customer.updated':
      return {
        category: 'customer',
        title: 'Dina kunduppgifter är uppdaterade',
        body: 'Dina uppgifter har uppdaterats.',
        link_href: '/mina-sidor',
      }
    case 'contract.application_received':
      return {
        category: 'application',
        title: 'Vi har tagit emot din teckning',
        body: 'Din teckning är mottagen. Vi går igenom uppgifterna och återkommer om något behöver kompletteras.',
        link_href: '/mina-sidor',
      }
    case 'contract.confirmation_sent':
      return {
        category: 'contract',
        title: 'Avtalsbekräftelse har skickats',
        body: 'Vi har skickat en bekräftelse för ditt elavtal.',
        link_href: '/mina-sidor',
      }
    case 'contract.cooling_off_sent':
      return {
        category: 'contract',
        title: 'Information om ångerrätt har skickats',
        body: 'Information om ångerrätt finns nu kopplad till ditt avtal.',
        link_href: '/mina-sidor',
      }
    case 'contract.needs_facility_data':
      return {
        category: 'contract',
        title: 'Komplettera anläggningsuppgifter',
        body: 'Vi behöver komplettera anläggningsuppgifter innan leverantörsbytet kan fortsätta.',
        link_href: '/mina-sidor',
      }
    case 'power_of_attorney.signed':
      return {
        category: 'document',
        title: 'Fullmakten är signerad',
        body: 'Din fullmakt är mottagen och kopplad till ditt ärende.',
        link_href: '/mina-sidor',
      }
    case 'document.created':
      return {
        category: 'document',
        title: 'Nytt dokument finns på Mina sidor',
        body: 'Ett nytt dokument finns nu tillgängligt.',
        link_href: '/mina-sidor/dokument',
      }
    case 'facility_data.received':
      return {
        category: 'facility',
        title: 'Anläggningsuppgifter mottagna',
        body: 'Vi har tagit emot dina anläggningsuppgifter.',
        link_href: '/mina-sidor',
      }
    case 'facility_data.verified':
      return {
        category: 'facility',
        title: 'Anläggningsuppgifter verifierade',
        body: 'Dina anläggningsuppgifter är verifierade.',
        link_href: '/mina-sidor',
      }
    case 'invoice.created':
    case 'invoice.sent':
      return {
        category: 'invoice',
        title: 'Ny faktura finns på Mina sidor',
        body: 'En ny faktura finns nu tillgänglig.',
        link_href: '/mina-sidor/fakturor',
      }
    case 'invoice.disputed':
      return {
        category: 'invoice',
        title: 'Faktura markerad för granskning',
        body: 'En faktura har markerats för granskning.',
        link_href: '/mina-sidor/fakturor',
      }
    case 'metering_values.updated':
      return {
        category: 'metering',
        title: 'Mätvärden har uppdaterats',
        body: 'Dina mätvärden har uppdaterats på Mina sidor.',
        link_href: '/mina-sidor',
      }
    default:
      return null
  }
}
