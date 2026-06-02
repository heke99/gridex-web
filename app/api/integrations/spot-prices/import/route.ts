import { NextResponse } from 'next/server'
import { verifyIntegrationRequest } from '@/lib/integrations/auth'
import {
  importMonthlySpotPrices,
  normalizePriceAreas,
  previousMonth,
  validateYearMonth,
} from '@/lib/integrations/spotMarket'
import { supabaseService } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

type ApiError = Error & { status?: number }

async function runImport(params: {
  year?: unknown
  month?: unknown
  areas?: unknown
  publish?: unknown
  reason?: unknown
}) {
  const fallback = previousMonth()
  const { year, month } = validateYearMonth(
    params.year ?? fallback.year,
    params.month ?? fallback.month
  )

  const result = await importMonthlySpotPrices(supabaseService, {
    year,
    month,
    areas: normalizePriceAreas(params.areas),
    publish: params.publish === true || params.publish === 'true',
    publishReason:
      typeof params.reason === 'string' && params.reason.trim()
        ? params.reason.trim()
        : null,
  })

  return NextResponse.json({ ok: true, result })
}

export async function POST(req: Request) {
  const auth = verifyIntegrationRequest(req, { allowCronSecret: true })

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.message },
      { status: auth.status }
    )
  }

  try {
    const body = await req.json().catch(() => ({}))
    return await runImport(body)
  } catch (err) {
    const error = err as ApiError

    return NextResponse.json(
      { error: error.message ?? 'Spot price import failed' },
      { status: error.status ?? 500 }
    )
  }
}

export async function GET(req: Request) {
  const auth = verifyIntegrationRequest(req, { allowCronSecret: true })

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.message },
      { status: auth.status }
    )
  }

  try {
    const url = new URL(req.url)
    return await runImport({
      year: url.searchParams.get('year'),
      month: url.searchParams.get('month'),
      areas: url.searchParams.get('areas')?.split(','),
      publish: url.searchParams.get('publish'),
      reason: url.searchParams.get('reason'),
    })
  } catch (err) {
    const error = err as ApiError

    return NextResponse.json(
      { error: error.message ?? 'Spot price import failed' },
      { status: error.status ?? 500 }
    )
  }
}
