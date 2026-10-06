import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { supabaseService } from '@/lib/supabase/service'
import { checkRateLimit, clientIpFromHeaders } from '@/lib/security/rateLimit'
import { hashIp } from '@/lib/ops/client'
import { createHash } from 'node:crypto'

export const dynamic = 'force-dynamic'

type PublicSupportPayload = {
  client_operation_id?: unknown
  name?: unknown
  email?: unknown
  phone?: unknown
  category?: unknown
  subject?: unknown
  message?: unknown
  website?: unknown
}

function asText(value: unknown, maxLength: number): string {
  return String(value ?? '').trim().slice(0, maxLength)
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}



export async function POST(req: Request) {
  try {
    const body = (await req.json()) as PublicSupportPayload
    const h = await headers()

    const honeypot = asText(body.website, 200)
    if (honeypot) {
      return NextResponse.json({ ok: true })
    }

    const name = asText(body.name, 120)
    const email = asText(body.email, 180).toLowerCase()
    const phone = asText(body.phone, 60)
    const category = asText(body.category, 80) || 'general'
    const subject = asText(body.subject, 180)
    const message = asText(body.message, 4000)

    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: 'Fyll i namn, e-post, ämne och meddelande.' },
        { status: 400 }
      )
    }

    if (!isEmail(email)) {
      return NextResponse.json(
        { error: 'Ange en giltig e-postadress.' },
        { status: 400 }
      )
    }

    const ip = clientIpFromHeaders(h)
    const rate = await checkRateLimit(`public-support:${ip ?? email}`, {
      limit: 6,
      windowMs: 15 * 60 * 1000,
    })
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'För många meddelanden på kort tid. Vänta en stund och försök igen.' },
        { status: 429 }
      )
    }

    const userAgent = h.get('user-agent')
    const operationId = asText(body.client_operation_id, 80)
    if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(operationId)) {
      return NextResponse.json({ error: 'Åtgärds-ID saknas. Ladda om sidan och försök igen.' }, { status: 400 })
    }
    const payloadHash = createHash('sha256').update(JSON.stringify({ name, email, phone, category, subject, message })).digest('hex')
    const { data: ticketId, error } = await supabaseService.rpc('gridex_create_public_inquiry_v1', {
      p_operation_id: operationId, p_payload_hash: payloadHash,
      p_name: name, p_email: email, p_phone: phone || null, p_category: category,
      p_subject: subject, p_message: message, p_ip_hash: hashIp(ip), p_user_agent: userAgent,
    })
    if (error || !ticketId) {
      const conflict = error?.message?.includes('idempotency_conflict')
      return NextResponse.json({ error: conflict ? 'Samma åtgärds-ID har redan använts för ett annat ärende.' : 'Ärendet kunde inte sparas just nu.' }, { status: conflict ? 409 : 503 })
    }
    return NextResponse.json({ ok: true, ticketId, confirmation_status: 'queued' })

  } catch (error) {
    console.error('[public support] intake failed', { code: error instanceof Error ? error.name : 'unknown' })
    return NextResponse.json({ error: 'Kunde inte skicka ärendet just nu.' }, { status: 503 })
  }
}
