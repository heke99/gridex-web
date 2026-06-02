import { NextResponse } from 'next/server'
import { calculateCustomerOffer } from '@/lib/gridex/offers'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { isPriceArea } from '@/lib/gridex/postalAreas'

export const dynamic = 'force-dynamic'

type ApiError = Error & { status?: number }

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const supabase = await createSupabaseServerClient()
    const result = await calculateCustomerOffer({
      supabase,
      contractSlug: String(body.contractSlug ?? ''),
      postalCode: body.postalCode ? String(body.postalCode) : null,
      manualPriceArea: isPriceArea(body.manualPriceArea)
        ? body.manualPriceArea
        : null,
      kwh: Number(body.kwh ?? 2000),
    })

    return NextResponse.json(result)
  } catch (err) {
    const error = err as ApiError
    return NextResponse.json(
      { error: error.message ?? 'Kunde inte beräkna erbjudande.' },
      { status: error.status ?? 500 }
    )
  }
}
