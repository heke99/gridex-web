import { NextResponse } from 'next/server'
import { getLivePriceSummary } from '@/lib/gridex/livePrices'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type ApiError = Error & { status?: number }

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const supabase = await createSupabaseServerClient()
    const result = await getLivePriceSummary({
      supabase,
      postalCode: url.searchParams.get('postalCode'),
      area: url.searchParams.get('area'),
      date: url.searchParams.get('date'),
    })

    return NextResponse.json({
      ...result,
      current: null,
    })
  } catch (err) {
    const error = err as ApiError
    return NextResponse.json(
      { error: error.message ?? 'Kunde inte hämta dagspriser.' },
      { status: error.status ?? 500 }
    )
  }
}
