import { NextResponse } from 'next/server'
import { supabaseService } from '@/lib/supabase/service'
import { hashDocument } from '@/lib/contracts/hash'

export async function POST(req: Request) {
  const body = await req.json()

  const ip =
    req.headers.get('x-forwarded-for') ??
    req.headers.get('x-real-ip') ??
    'unknown'

  const userAgent = req.headers.get('user-agent') ?? 'unknown'

  const documentHash = hashDocument(body.documentContent)

  await supabaseService.from('legal_acceptances').insert({
    agreement_id: body.agreementId,
    type: body.type,
    version: body.version,
    document_hash: documentHash,
    ip_address: ip,
    user_agent: userAgent,
    accepted_at: new Date().toISOString(),
  })

  return NextResponse.json({ success: true })
}