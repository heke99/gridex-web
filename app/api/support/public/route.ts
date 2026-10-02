import { supabaseService } from '@/lib/supabase/service'
import { checkRateLimit, clientIpFromHeaders } from '@/lib/security/rateLimit'
import { hashIp } from '@/lib/ops/client'
import { privateJsonResponse, readWebJson, webErrorResponse } from '@/lib/api/webBoundary'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function inputText(value: unknown, max: number, required = false): string | null {
  if (value === undefined && !required) return ''
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) return null
  return value.trim()
}

export async function POST(request: Request) {
  try {
    const read = await readWebJson<unknown>(request, { maxBytes: 24 * 1024 })
    if (!read.ok) return read.response
    if (!read.value || typeof read.value !== 'object' || Array.isArray(read.value)) {
      return webErrorResponse({ code: 'validation_error', message: 'Begäran måste vara ett JSON-objekt.', retryable: false }, 400)
    }
    const body = read.value as Record<string, unknown>
    if (Object.keys(body).some((key) => !['name','email','phone','category','subject','message','website'].includes(key))) {
      return webErrorResponse({ code: 'validation_error', message: 'Begäran innehåller ett otillåtet fält.', retryable: false }, 400)
    }
    const honeypot = inputText(body.website, 200)
    if (honeypot) return privateJsonResponse({ ok: true })
    const requestId = request.headers.get('Idempotency-Key') ?? ''
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
      return webErrorResponse({ code: 'validation_error', message: 'Begäran saknar ett giltigt ID.', retryable: false }, 400)
    }
    const name = inputText(body.name, 120, true)
    const email = inputText(body.email, 180, true)?.toLowerCase() ?? null
    const phone = inputText(body.phone, 60)
    const category = inputText(body.category ?? 'general', 80, true)
    const subject = inputText(body.subject, 180, true)
    const message = inputText(body.message, 4000, true)
    if (!name || !email || phone === null || !category || !subject || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return webErrorResponse({ code: 'validation_error', message: 'Kontrollera namn, e-post, ämne och meddelande.', retryable: false }, 400)
    }
    const ip = clientIpFromHeaders(request.headers)
    const rate = await checkRateLimit(`public-support:${hashIp(ip) ?? 'unknown'}`, { limit: 6, windowMs: 15 * 60 * 1000 })
    if (!rate.allowed) {
      return webErrorResponse({ code: 'rate_limited', message: 'För många meddelanden. Vänta en stund och försök igen.', retryable: true }, 429, {
        'Retry-After': String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))),
      })
    }
    const { error } = await supabaseService.rpc('gridex_create_public_support_contact', {
      p_request_id: requestId, p_name: name, p_email: email, p_phone: phone,
      p_category: category, p_subject: subject, p_message: message, p_ip_hash: hashIp(ip),
    })
    if (error) {
      if (error.code === '22023' && error.message.includes('PUBLIC_SUPPORT_IDEMPOTENCY_CONFLICT')) {
        return webErrorResponse({ code: 'idempotency_conflict', message: 'Begäran har redan använts med andra uppgifter. Skicka ett nytt meddelande.', retryable: false }, 409)
      }
      console.error('[public support] Contact persistence failed', { code: error.code })
      return webErrorResponse({ code: 'support_unavailable', message: 'Meddelandet kunde inte sparas. Försök igen eller mejla support@gridex.se.', retryable: true }, 503)
    }
    return privateJsonResponse({ ok: true, request_id: requestId })
  } catch {
    return webErrorResponse({ code: 'support_unavailable', message: 'Meddelandet kunde inte sparas. Försök igen eller mejla support@gridex.se.', retryable: true }, 503)
  }
}
