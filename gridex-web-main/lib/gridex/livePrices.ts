import type { SupabaseClient } from '@supabase/supabase-js'
import type { PriceArea } from '@/lib/gridex/pricing/types'
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
    averageSekPerKwh: number
    averageOrePerKwh: number
    minSekPerKwh: number
    maxSekPerKwh: number
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

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function parseIsoDate(input?: string | null): Date {
  if (!input) return new Date()

  const match = input.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) {
    throw Object.assign(new Error('Datum måste anges som YYYY-MM-DD.'), {
      status: 400,
    })
  }

  const date = new Date(`${input}T00:00:00+01:00`)
  if (!Number.isFinite(date.getTime())) {
    throw Object.assign(new Error('Ogiltigt datum.'), { status: 400 })
  }

  return date
}

function marketUrl(params: { date: Date; area: PriceArea }) {
  const template =
    process.env.SPOT_PRICE_API_URL_TEMPLATE ??
    'https://www.elprisetjustnu.se/api/v1/prices/{YEAR}/{MONTH}-{DAY}_{AREA}.json'

  return template
    .replaceAll('{YEAR}', String(params.date.getFullYear()))
    .replaceAll('{MONTH}', pad2(params.date.getMonth() + 1))
    .replaceAll('{DAY}', pad2(params.date.getDate()))
    .replaceAll('{AREA}', params.area)
}

function normalizeExternalEntry(entry: ExternalEntry): LivePriceEntry | null {
  const sek = Number(entry.SEK_per_kWh)
  const timeStart =
    typeof entry.time_start === 'string' ? entry.time_start : null
  const timeEnd = typeof entry.time_end === 'string' ? entry.time_end : null

  if (!Number.isFinite(sek) || !timeStart || !timeEnd) return null

  const eur = Number(entry.EUR_per_kWh)
  const exr = Number(entry.EXR)

  return {
    sekPerKwh: sek,
    eurPerKwh: Number.isFinite(eur) ? eur : null,
    exchangeRate: Number.isFinite(exr) ? exr : null,
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
    }) ??
    [...entries]
      .reverse()
      .find((entry) => new Date(entry.timeStart).getTime() <= nowMs) ??
    entries[0] ??
    null
  )
}

function stats(entries: LivePriceEntry[]) {
  if (entries.length === 0) {
    return {
      averageSekPerKwh: 0,
      averageOrePerKwh: 0,
      minSekPerKwh: 0,
      maxSekPerKwh: 0,
      samples: 0,
    }
  }

  const values = entries.map((entry) => entry.sekPerKwh)
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length

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
  const date = parseIsoDate(params.date)
  const response = await fetch(marketUrl({ date, area: params.area }), {
    headers: { accept: 'application/json' },
    next: { revalidate: 15 * 60 },
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

  return json
    .map((entry) => normalizeExternalEntry(entry as ExternalEntry))
    .filter((entry): entry is LivePriceEntry => entry !== null)
}

export async function getLivePriceSummary(params: {
  supabase: SupabaseClient
  postalCode?: string | null
  area?: string | null
  date?: string | null
  now?: Date
}): Promise<LivePriceSummary> {
  let priceArea: PriceArea
  let postalCode: string | null = null

  if (params.area && isPriceArea(params.area)) {
    priceArea = params.area
  } else if (params.postalCode) {
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

  const date = parseIsoDate(params.date)
  const entries = await fetchDayAheadPrices({
    area: priceArea,
    date: toIsoDate(date),
  })

  return {
    source: 'elprisetjustnu',
    sourceLabel: 'Elpriset just nu.se',
    priceArea,
    postalCode,
    date: toIsoDate(date),
    current: currentEntry(entries, params.now),
    entries,
    stats: stats(entries),
    disclaimer:
      'Priserna kommer från elprisetjustnu.se och visas utan moms, skatter, elnätsavgifter och elhandlarens påslag.',
  }
}
