import { NextResponse } from 'next/server'
import { fetchMonthlySpotAverageFromElprisetJustNu } from '@/lib/gridex/pricing/elprisetjustnu'
import type { PriceArea } from '@/lib/gridex/pricing/types'
import { prevYearMonth } from '@/lib/gridex/pricing/validators'

export const dynamic = 'force-dynamic'

const AREAS = new Set<PriceArea>(['SE1', 'SE2', 'SE3', 'SE4'])

function parseArea(value: string | null): PriceArea {
  const area = (value ?? 'SE3').toUpperCase() as PriceArea
  return AREAS.has(area) ? area : 'SE3'
}

function parseMonth(value: string | null, fallback: number): number {
  const month = Number(value)
  return Number.isInteger(month) && month >= 1 && month <= 12 ? month : fallback
}

function parseYear(value: string | null, fallback: number): number {
  const year = Number(value)
  return Number.isInteger(year) && year >= 2020 && year <= 2100 ? year : fallback
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const fallbackPeriod = prevYearMonth(new Date())
    const area = parseArea(url.searchParams.get('area'))
    const year = parseYear(url.searchParams.get('year'), fallbackPeriod.year)
    const month = parseMonth(url.searchParams.get('month'), fallbackPeriod.month)

    const average = await fetchMonthlySpotAverageFromElprisetJustNu({
      year,
      month,
      priceArea: area,
    })

    if (!average) {
      return NextResponse.json(
        { error: 'Spotpris kunde inte hämtas för vald period och elområde.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      priceArea: area,
      year,
      month,
      avgSpotOre: average.avgSpotOre,
      samples: average.samples,
      source: average.source,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Kunde inte hämta spotpris.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
