import { NextResponse } from 'next/server'
import { fetchMonthlySpotAverageFromElprisetJustNu, SpotPriceCoverageError } from '@/lib/gridex/pricing/elprisetjustnu'
import { isPriceArea } from '@/lib/gridex/postalAreas'
import { prevYearMonth } from '@/lib/gridex/pricing/validators'

export const dynamic = 'force-dynamic'

function parsePeriodPart(value: string | null, fallback: number, min: number, max: number): number | null {
  if (value === null) return fallback
  if (!/^\d+$/.test(value)) return null
  const parsed = Number(value)
  return parsed >= min && parsed <= max ? parsed : null
}

function invalidField(field: string) {
  return NextResponse.json({ error: 'Ogiltigt värde för elområde eller period.', field }, { status: 400 })
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const fallback = prevYearMonth(new Date())
  const area = (searchParams.get('area') ?? 'SE3').toUpperCase()
  if (!isPriceArea(area)) return invalidField('area')
  const year = parsePeriodPart(searchParams.get('year'), fallback.year, 2020, 2100)
  if (year === null) return invalidField('year')
  const month = parsePeriodPart(searchParams.get('month'), fallback.month, 1, 12)
  if (month === null) return invalidField('month')

  try {
    const average = await fetchMonthlySpotAverageFromElprisetJustNu({ year, month, priceArea: area })
    if (!average) {
      return NextResponse.json({
        error: 'Spotpris saknas för vald period och elområde.',
        code: 'spot_prices_not_published',
      }, { status: 404 })
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
    if (error instanceof SpotPriceCoverageError) {
      return NextResponse.json({
        error: 'Prisunderlaget täcker bara delar av månaden.',
        code: 'spot_prices_incomplete',
      }, { status: 422 })
    }
    return NextResponse.json({
      error: 'Priskällan är tillfälligt otillgänglig. Försök igen om en stund.',
      code: 'spot_provider_unavailable',
    }, { status: 503 })
  }
}
