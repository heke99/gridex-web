import { NextResponse } from 'next/server'
import { verifyIntegrationRequest } from '@/lib/integrations/auth'
import {
  importExternalInvoice,
  type ExternalInvoicePayload,
} from '@/lib/integrations/invoices'
import { supabaseService } from '@/lib/supabase/service'
import { readWebJson } from '@/lib/api/webBoundary'

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
    const parsed = await readWebJson<ExternalInvoicePayload>(req, { maxBytes: 256 * 1024, requireSameOrigin: false })
    if (!parsed.ok) {
      const body = await parsed.response.json()
      return NextResponse.json({ error: body.error.message }, { status: parsed.response.status, headers: parsed.response.headers })
    }
    const result = await importExternalInvoice(supabaseService, parsed.value)

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
