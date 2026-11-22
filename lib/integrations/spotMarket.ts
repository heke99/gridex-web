import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchMonthlySpotAverageFromElprisetJustNu, stockholmDateParts } from '@/lib/gridex/pricing/elprisetjustnu'

export type PriceArea = 'SE1' | 'SE2' | 'SE3' | 'SE4'

export const PRICE_AREAS: PriceArea[] = ['SE1', 'SE2', 'SE3', 'SE4']

export type ImportedSpotArea = {
  priceArea: PriceArea
  year: number
  month: number
  avgSpotOre: number
  samples: number
}

export type SpotImportResult = {
  source: string
  year: number
  month: number
  areas: ImportedSpotArea[]
  syncJobId: string | null
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

export function normalizePriceAreas(input: unknown): PriceArea[] {
  if (input === undefined) return [...PRICE_AREAS]
  if (!Array.isArray(input) || input.length === 0) {
    throw Object.assign(new Error('Ange minst ett giltigt elområde.'), { status: 400 })
  }
  const areas = input.map(value => typeof value === 'string' ? value.trim().toUpperCase() : null)
  if (!areas.every((area): area is PriceArea => area !== null && PRICE_AREAS.some(valid => valid === area))) {
    throw Object.assign(new Error('Ogiltigt elområde. Ange SE1, SE2, SE3 eller SE4.'), { status: 400 })
  }
  return [...new Set(areas)]
}

export function validateYearMonth(year: unknown, month: unknown) {
  const parsePart = (value: unknown) =>
    typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value.trim()))
      ? Number(value)
      : NaN
  const parsedYear = parsePart(year)
  const parsedMonth = parsePart(month)

  if (
    !Number.isInteger(parsedYear) ||
    parsedYear < 2000 ||
    parsedYear > 2100 ||
    !Number.isInteger(parsedMonth) ||
    parsedMonth < 1 ||
    parsedMonth > 12
  ) {
    throw Object.assign(new Error('Invalid year/month'), { status: 400 })
  }

  return { year: parsedYear, month: parsedMonth }
}

export function previousMonth(now = new Date()) {
  const { year, month } = stockholmDateParts(now)

  if (month === 1) return { year: year - 1, month: 12 }
  return { year, month: month - 1 }
}

export async function importMonthlySpotPrices(
  supabase: SupabaseClient,
  params: {
    year: number
    month: number
    areas?: PriceArea[]
    publish?: boolean
    publishReason?: string | null
  }
): Promise<SpotImportResult> {
  const areas = normalizePriceAreas(params.areas)
  const imported: ImportedSpotArea[] = []

  for (const area of areas) {
    try {
      const aggregate = await fetchMonthlySpotAverageFromElprisetJustNu({
        year: params.year,
        month: params.month,
        priceArea: area,
      })
      if (!aggregate) throw new Error('Missing monthly price aggregate')
      imported.push({
        priceArea: area,
        year: params.year,
        month: params.month,
        avgSpotOre: aggregate.avgSpotOre,
        samples: aggregate.samples,
      })
    } catch (error) {
      console.warn('[spotMarket] monthly source unavailable', { area, year: params.year, month: params.month, error })
      throw Object.assign(new Error(`Komplett prisdata för ${area} ${params.year}-${pad2(params.month)} kunde inte hämtas.`), { status: 502 })
    }
  }

  const { data: syncJobId, error } = await supabase.rpc('gridex_import_monthly_spot_prices', {
    p_year: params.year,
    p_month: params.month,
    p_areas: imported,
    p_publish: params.publish === true,
    p_reason: params.publishReason ?? `Autoimport från elprisetjustnu (${params.year}-${pad2(params.month)})`,
  })
  if (error || typeof syncJobId !== 'string') {
    console.error('[spotMarket] monthly import failed', { code: error?.code })
    throw Object.assign(new Error('Månadspriserna kunde inte sparas eller publiceras.'), { status: 500 })
  }

  return {
    source: 'elprisetjustnu',
    year: params.year,
    month: params.month,
    areas: imported,
    syncJobId,
  }
}
