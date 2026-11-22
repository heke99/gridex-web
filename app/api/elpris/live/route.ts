import { NextResponse } from 'next/server'
import { getLivePriceSummary } from '@/lib/gridex/livePrices'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type ApiError = Error & { status?: number }

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const area = url.searchParams.get('area')
    const postalCode = url.searchParams.get('postalCode')
    const supabase = !area && postalCode ? await createSupabaseServerClient() : undefined
    const result = await getLivePriceSummary({
      supabase,
      postalCode,
      area,
      date: url.searchParams.get('date'),
    })

    return NextResponse.json(result)
  } catch (err) {
    const error = err as ApiError
    return NextResponse.json(
      { error: error.message ?? 'Kunde inte hämta livepris.' },
      { status: error.status ?? 500 }
    )
  }
}
