import { NextResponse } from 'next/server'
import { supabaseService } from '@/lib/supabase/service'
import { hashDocument } from '@/lib/contracts/hash'
import { checkRateLimit, clientIpFromHeaders } from '@/lib/security/rateLimit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ACCEPTANCE_TYPES = new Set([
  'terms',
  'privacy',
  'privacy_policy',
  'cancellation_right',
  'withdrawal',
  'power_of_attorney',
  'price_terms',
])

type LegalAcceptBody = {
  agreementId?: unknown
  agreement_id?: unknown
  token?: unknown
  signToken?: unknown
  emailSignToken?: unknown
  acceptanceToken?: unknown
  type?: unknown
  version?: unknown
  documentContent?: unknown
}

function text(value: unknown, max = 500): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > max) return null
  return trimmed
}

function clientSafeError(status: number, message = 'Godkännandet kunde inte registreras.') {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(req: Request) {
  const ip = clientIpFromHeaders(req.headers)
  const rate = await checkRateLimit(`legal_accept:${ip}`, {
    limit: 20,
    windowMs: 15 * 60 * 1000,
  })

  if (!rate.allowed) {
    return clientSafeError(429, 'För många försök. Vänta en stund och försök igen.')
  }

  const body = (await req.json().catch(() => null)) as LegalAcceptBody | null
  const agreementId = text(body?.agreementId ?? body?.agreement_id, 120)
  const token = text(
    body?.acceptanceToken ?? body?.emailSignToken ?? body?.signToken ?? body?.token,
    300,
  )
  const type = text(body?.type, 80)
  const version = text(body?.version, 120)
  const documentContent = text(body?.documentContent, 200_000)

  if (!agreementId || !token || !type || !version || !documentContent) {
    return clientSafeError(400)
  }

  if (!ACCEPTANCE_TYPES.has(type)) {
    return clientSafeError(400)
  }

  const { data: agreement, error: agreementError } = await supabaseService
    .from('contract_agreements')
    .select('id,email_token,email_sign_token,status')
    .eq('id', agreementId)
    .maybeSingle<{
      id: string
      email_token: string | null
      email_sign_token: string | null
      status: string | null
    }>()

  if (agreementError) {
    console.error('[legal.accept] agreement lookup failed', agreementError)
    return clientSafeError(500)
  }

  const tokenMatches = Boolean(
    agreement && (agreement.email_sign_token === token || agreement.email_token === token),
  )

  if (!agreement || !tokenMatches) {
    return clientSafeError(403)
  }

  const documentHash = hashDocument(documentContent)
  const ipAddress = ip || 'unknown'
  const userAgent = req.headers.get('user-agent') ?? 'unknown'

  const { data: existing, error: existingError } = await supabaseService
    .from('legal_acceptances')
    .select('id')
    .eq('agreement_id', agreementId)
    .eq('type', type)
    .eq('version', version)
    .eq('document_hash', documentHash)
    .maybeSingle<{ id: string }>()

  if (existingError) {
    console.error('[legal.accept] existing lookup failed', existingError)
    return clientSafeError(500)
  }

  if (existing?.id) {
    return NextResponse.json({ success: true, idempotent: true })
  }

  const { error: insertError } = await supabaseService.from('legal_acceptances').insert({
    agreement_id: agreementId,
    type,
    version,
    document_hash: documentHash,
    ip_address: ipAddress,
    user_agent: userAgent,
    accepted_at: new Date().toISOString(),
  })

  if (insertError) {
    console.error('[legal.accept] insert failed', insertError)
    return clientSafeError(500)
  }

  return NextResponse.json({ success: true })
}
