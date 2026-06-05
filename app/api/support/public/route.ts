import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { supabaseService } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

type PublicSupportPayload = {
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

function clientIp(h: Headers): string | null {
  const xff = h.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]?.trim() || null
  return h.get('x-real-ip')?.trim() || null
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

    const ip = clientIp(h)
    const userAgent = h.get('user-agent')
    const clientRequestId = `public:${email}:${Date.now()}`

    const { data: ticket, error: ticketError } = await supabaseService
      .from('customer_support_tickets')
      .insert({
        user_id: null,
        subject,
        description: message,
        category,
        priority: 'normal',
        status: 'open',
        metadata: {
          source: 'public_kundservice_form',
          customer_name: name,
          customer_email: email,
          customer_phone: phone || null,
          client_request_id: clientRequestId,
          ip,
          user_agent: userAgent,
        },
      })
      .select('id')
      .single<{ id: string }>()

    if (ticketError) {
      throw new Error(ticketError.message)
    }

    const { error: messageError } = await supabaseService
      .from('customer_support_messages')
      .insert({
        ticket_id: ticket.id,
        sender_user_id: null,
        sender_type: 'customer',
        body: message,
      })

    if (messageError) {
      throw new Error(messageError.message)
    }

    await supabaseService.from('system_emails').insert({
      to_email: email,
      subject: 'Vi har tagit emot ditt ärende hos Gridex AB',
      body: `Hej ${name},\n\nTack för ditt meddelande. Vi har tagit emot ditt ärende och återkommer till dig via e-post.\n\nÄmne: ${subject}\n\nVänliga hälsningar,\nGridex AB`,
    })

    return NextResponse.json({ ok: true, ticketId: ticket.id })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Kunde inte skicka ärendet.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
