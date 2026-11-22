import { NextResponse } from 'next/server'
import { getLivePriceSummary } from '@/lib/gridex/livePrices'
import { stockholmCalendarDate } from '@/lib/website/businessDate'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type ApiError = Error & { status?: number }

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const area = url.searchParams.get('area')
    const postalCode = url.searchParams.get('postalCode')
    const supabase = !area && postalCode ? await createSupabaseServerClient() : undefined
    const date = url.searchParams.get('date')
    const result = await getLivePriceSummary({
      supabase,
      postalCode,
      area,
      date,
    })

    const cacheable = Boolean(area && date && !url.searchParams.has('postalCode') && result.stats.averageSekPerKwh !== null)
    const maxAge = result.date < stockholmCalendarDate() ? 300 : 60
    return NextResponse.json({ ...result, current: null }, {
      headers: { 'Cache-Control': cacheable ? `public, max-age=0, s-maxage=${maxAge}` : 'private, no-store' },
    })
  } catch (err) {
    const error = err as ApiError
    return NextResponse.json(
      { error: error.message ?? 'Kunde inte hämta dagspriser.' },
      { status: error.status ?? 500 }
    )
  }
}
