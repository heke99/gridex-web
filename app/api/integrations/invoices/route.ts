import { NextResponse } from 'next/server'
import { verifyIntegrationRequest } from '@/lib/integrations/auth'
import {
  importExternalInvoice,
  type ExternalInvoicePayload,
} from '@/lib/integrations/invoices'
import { supabaseService } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type ApiError = Error & { status?: number }

export async function POST(req: Request) {
  const auth = verifyIntegrationRequest(req)

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.message },
      { status: auth.status }
    )
  }

  try {
    const payload = (await req.json()) as ExternalInvoicePayload
    const result = await importExternalInvoice(supabaseService, payload)

    return NextResponse.json({
      ok: true,
      result,
    })
  } catch (err) {
    const error = err as ApiError

    return NextResponse.json(
      { error: error.message ?? 'Invoice import failed' },
      { status: error.status ?? 500 }
    )
  }
}
