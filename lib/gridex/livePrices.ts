import type { SupabaseClient } from '@supabase/supabase-js'
import type { PriceArea } from '@/lib/gridex/pricing/types'
import { isStrictCalendarDate, stockholmCalendarDate, stockholmDayBounds } from '@/lib/website/businessDate'
import {
  isPriceArea,
  resolvePriceAreaForPostalCode,
} from '@/lib/gridex/postalAreas'

export type LivePriceEntry = {
  sekPerKwh: number
  eurPerKwh: number | null
  exchangeRate: number | null
  timeStart: string
  timeEnd: string
}

export type LivePriceSummary = {
  source: 'elprisetjustnu'
  sourceLabel: string
  priceArea: PriceArea
  postalCode: string | null
  date: string
  current: LivePriceEntry | null
  entries: LivePriceEntry[]
  stats: {
    averageSekPerKwh: number | null
    averageOrePerKwh: number | null
    minSekPerKwh: number | null
    maxSekPerKwh: number | null
    samples: number
  }
  disclaimer: string
}

type ExternalEntry = {
  SEK_per_kWh?: unknown
  EUR_per_kWh?: unknown
  EXR?: unknown
  time_start?: unknown
  time_end?: unknown
}

function parseIsoDate(input?: string | null, now = new Date()): string {
  if (!input) return stockholmCalendarDate(now)
  if (!isStrictCalendarDate(input)) {
    throw Object.assign(new Error('Datum måste anges som YYYY-MM-DD.'), {
      status: 400,
    })
  }

  return input
}

function marketUrl(params: { date: string; area: PriceArea }) {
  const template =
    process.env.SPOT_PRICE_API_URL_TEMPLATE ??
    'https://www.elprisetjustnu.se/api/v1/prices/{YEAR}/{MONTH}-{DAY}_{AREA}.json'

  return template
    .replaceAll('{YEAR}', params.date.slice(0, 4))
    .replaceAll('{MONTH}', params.date.slice(5, 7))
    .replaceAll('{DAY}', params.date.slice(8, 10))
    .replaceAll('{AREA}', params.area)
}

function priceNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string' || !/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:e[+-]?\d+)?$/i.test(value.trim())) return null
  const parsed = Number(value.trim().replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeExternalEntry(entry: ExternalEntry): LivePriceEntry | null {
  if (!entry || typeof entry !== 'object') return null
  const sek = priceNumber(entry.SEK_per_kWh)
  const timeStart =
    typeof entry.time_start === 'string' ? entry.time_start : null
  const timeEnd = typeof entry.time_end === 'string' ? entry.time_end : null

  if (sek === null || !timeStart || !timeEnd || !Number.isFinite(Date.parse(timeStart)) || !Number.isFinite(Date.parse(timeEnd)) || Date.parse(timeEnd) <= Date.parse(timeStart)) return null

  return {
    sekPerKwh: sek,
    eurPerKwh: priceNumber(entry.EUR_per_kWh),
    exchangeRate: priceNumber(entry.EXR),
    timeStart,
    timeEnd,
  }
}

function currentEntry(entries: LivePriceEntry[], now = new Date()) {
  const nowMs = now.getTime()
  return (
    entries.find((entry) => {
      const start = new Date(entry.timeStart).getTime()
      const end = new Date(entry.timeEnd).getTime()
      return Number.isFinite(start) && Number.isFinite(end) && start <= nowMs && end > nowMs
    }) ?? null
  )
}

function stats(entries: LivePriceEntry[], date: string): LivePriceSummary['stats'] {
  const bounds = stockholmDayBounds(date)
  let coveredUntil = bounds.start
  let coveredSamples = 0
  for (const entry of entries) {
    if (Date.parse(entry.timeStart) !== coveredUntil) break
    coveredUntil = Date.parse(entry.timeEnd)
    coveredSamples++
  }
  if (coveredSamples !== entries.length || coveredUntil !== bounds.end) {
    return {
      averageSekPerKwh: null,
      averageOrePerKwh: null,
      minSekPerKwh: null,
      maxSekPerKwh: null,
      samples: entries.length,
    }
  }

  const values = entries.map((entry) => entry.sekPerKwh)
  const durations = entries.map((entry) => Date.parse(entry.timeEnd) - Date.parse(entry.timeStart))
  const avg = values.reduce((sum, value, index) => sum + value * durations[index], 0) / durations.reduce((sum, duration) => sum + duration, 0)

  return {
    averageSekPerKwh: avg,
    averageOrePerKwh: avg * 100,
    minSekPerKwh: Math.min(...values),
    maxSekPerKwh: Math.max(...values),
    samples: values.length,
  }
}

export async function fetchDayAheadPrices(params: {
  area: PriceArea
  date?: string | null
}): Promise<LivePriceEntry[]> {
  if (!isPriceArea(params.area)) throw Object.assign(new Error('Ogiltigt elområde.'), { status: 400 })
  const date = parseIsoDate(params.date)
  const response = await fetch(marketUrl({ date, area: params.area }), {
    headers: { accept: 'application/json' },
    next: { revalidate: date < stockholmCalendarDate() ? 300 : 60 },
    signal: AbortSignal.timeout(8_000),
  })

  if (response.status === 404) return []

  if (!response.ok) {
    throw Object.assign(
      new Error(`Elpris-API svarade med ${response.status}.`),
      { status: 502 }
    )
  }

  const json = (await response.json()) as unknown
  if (!Array.isArray(json)) return []

  const entries = json
    .map((entry) => normalizeExternalEntry(entry as ExternalEntry))
    .filter((entry): entry is LivePriceEntry => entry !== null)
    .sort((a, b) => Date.parse(a.timeStart) - Date.parse(b.timeStart))

  let previousEnd = -Infinity
  for (const entry of entries) {
    if (Date.parse(entry.timeStart) < previousEnd) {
      throw Object.assign(new Error('Elpris-API returnerade överlappande prisintervall.'), { status: 502 })
    }
    previousEnd = Date.parse(entry.timeEnd)
  }
  return entries
}

export async function getLivePriceSummary(params: {
  supabase?: SupabaseClient
  postalCode?: string | null
  area?: string | null
  date?: string | null
  now?: Date
}): Promise<LivePriceSummary> {
  let priceArea: PriceArea
  let postalCode: string | null = null

  if (params.area && !isPriceArea(params.area)) throw Object.assign(new Error('Ogiltigt elområde.'), { status: 400 })
  if (params.area && isPriceArea(params.area)) {
    priceArea = params.area
  } else if (params.postalCode) {
    if (!params.supabase) throw new Error('Postnummeruppslagningen är otillgänglig.')
    const resolved = await resolvePriceAreaForPostalCode(
      params.supabase,
      params.postalCode
    )
    priceArea = resolved.priceArea
    postalCode = resolved.postalCode
  } else {
    throw Object.assign(new Error('Ange area eller postalCode.'), {
      status: 400,
    })
  }

  const date = parseIsoDate(params.date, params.now)
  const entries = await fetchDayAheadPrices({
    area: priceArea,
    date,
  })

  return {
    source: 'elprisetjustnu',
    sourceLabel: 'Elpriset just nu.se',
    priceArea,
    postalCode,
    date,
    current: currentEntry(entries, params.now),
    entries,
    stats: stats(entries, date),
    disclaimer:
      'Priserna kommer från elprisetjustnu.se och visas utan moms, skatter, elnätsavgifter och elhandlarens påslag.',
  }
}
