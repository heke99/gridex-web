import type { PriceArea } from './types'

export type ElprisetJustNuEntry = {
  SEK_per_kWh?: unknown
  EUR_per_kWh?: unknown
  EXR?: unknown
  time_start?: unknown
  time_end?: unknown
}

export type MonthlySpotApiAverage = {
  source: 'elprisetjustnu_api'
  year: number
  month: number
  priceArea: PriceArea
  avgSpotOre: number
  samples: number
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function marketUrl(params: {
  year: number
  month: number
  day: number
  area: PriceArea
}): string {
  const template =
    process.env.SPOT_PRICE_API_URL_TEMPLATE ??
    'https://www.elprisetjustnu.se/api/v1/prices/{YEAR}/{MONTH}-{DAY}_{AREA}.json'

  return template
    .replaceAll('{YEAR}', String(params.year))
    .replaceAll('{MONTH}', pad2(params.month))
    .replaceAll('{DAY}', pad2(params.day))
    .replaceAll('{AREA}', params.area)
}

async function fetchDailySpotSamples(params: {
  year: number
  month: number
  day: number
  area: PriceArea
}): Promise<number[]> {
  const response = await fetch(marketUrl(params), {
    headers: { accept: 'application/json' },
    next: { revalidate: 60 * 60 * 24 },
  })

  if (response.status === 404) return []

  if (!response.ok) {
    throw new Error(
      `elprisetjustnu API svarade med ${response.status} för ${params.area} ${params.year}-${pad2(params.month)}-${pad2(params.day)}.`
    )
  }

  const data = (await response.json()) as unknown
  if (!Array.isArray(data)) return []

  return data
    .map((entry) => Number((entry as ElprisetJustNuEntry).SEK_per_kWh))
    .filter((value) => Number.isFinite(value))
}

export async function fetchMonthlySpotAverageFromElprisetJustNu(params: {
  year: number
  month: number
  priceArea: PriceArea
}): Promise<MonthlySpotApiAverage | null> {
  const dayCount = daysInMonth(params.year, params.month)
  const days = Array.from({ length: dayCount }, (_, index) => index + 1)

  const dailySamples = await Promise.all(
    days.map((day) =>
      fetchDailySpotSamples({
        year: params.year,
        month: params.month,
        day,
        area: params.priceArea,
      }).catch(() => [])
    )
  )

  const values = dailySamples.flat()
  if (values.length === 0) return null

  const avgSekPerKwh = values.reduce((sum, value) => sum + value, 0) / values.length

  return {
    source: 'elprisetjustnu_api',
    year: params.year,
    month: params.month,
    priceArea: params.priceArea,
    avgSpotOre: Number((avgSekPerKwh * 100).toFixed(6)),
    samples: values.length,
  }
}
