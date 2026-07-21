import type { PriceArea } from './types'

export type ElprisetJustNuEntry = {
  SEK_per_kWh?: unknown
  EUR_per_kWh?: unknown
  EXR?: unknown
  time_start?: unknown
  time_end?: unknown
}

export type SpotApiAverage = {
  source: 'elprisetjustnu_api'
  priceArea: PriceArea
  year: number
  month: number
  day?: number
  avgSpotOre: number
  samples: number
  intervalMinutes: number | null
  sourceSamples: number
  sourceIntervalMinutes: number | null
  avgSpotEurPerKwh: number | null
  exchangeRate: number | null
  periodStart: string
  periodEnd: string
}

export type MonthlySpotApiAverage = SpotApiAverage & {
  day?: never
}

export type DailySpotApiAverage = SpotApiAverage & {
  day: number
}

type SpotSample = {
  sekPerKwh: number
  eurPerKwh: number | null
  exchangeRate: number | null
  durationMinutes: number
  startMs: number
  endMs: number
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function apiNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(typeof value === 'string' ? value.trim().replace(',', '.') : value)
  return Number.isFinite(parsed) ? parsed : null
}

function apiTimeoutMs(): number {
  const configured = apiNumber(process.env.SPOT_PRICE_API_TIMEOUT_MS)
  return configured !== null && configured >= 1_000 && configured <= 30_000
    ? Math.round(configured)
    : 8_000
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

function parsedTimeRange(entry: ElprisetJustNuEntry): {
  durationMinutes: number
  startMs: number
  endMs: number
} | null {
  if (typeof entry.time_start !== 'string' || typeof entry.time_end !== 'string') return null
  const start = Date.parse(entry.time_start)
  const end = Date.parse(entry.time_end)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null
  const minutes = (end - start) / 60_000
  return Number.isFinite(minutes) && minutes > 0 && minutes <= 180
    ? { durationMinutes: minutes, startMs: start, endMs: end }
    : null
}

function parseSample(entry: unknown): SpotSample | null {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null
  const row = entry as ElprisetJustNuEntry
  const sekPerKwh = apiNumber(row.SEK_per_kWh)
  if (sekPerKwh === null) return null
  const time = parsedTimeRange(row)
  if (!time) return null
  return {
    sekPerKwh,
    eurPerKwh: apiNumber(row.EUR_per_kWh),
    exchangeRate: apiNumber(row.EXR),
    ...time,
  }
}

function representativeIntervalMinutes(samples: SpotSample[]): number | null {
  const durations = samples
    .map((sample) => sample.durationMinutes)
    .filter((value) => Number.isFinite(value) && value >= 5)
    .map((value) => Math.round(value))
    .sort((a, b) => a - b)
  if (!durations.length) return null
  return durations[Math.floor(durations.length / 2)] ?? null
}

function weightedAverage(
  samples: SpotSample[],
  selector: (sample: SpotSample) => number | null,
): number | null {
  if (!samples.length) return null
  const usable = samples.filter((sample) => selector(sample) !== null)
  const totalMinutes = usable.reduce((sum, sample) => sum + sample.durationMinutes, 0)
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return null
  const weighted = usable.reduce(
    (sum, sample) => sum + (selector(sample) ?? 0) * sample.durationMinutes,
    0,
  )
  return weighted / totalMinutes
}

function weightedAverageOre(samples: SpotSample[]): number | null {
  const average = weightedAverage(samples, (sample) => sample.sekPerKwh)
  return average === null ? null : Number((average * 100).toFixed(6))
}

function averageEurPerKwh(samples: SpotSample[]): number | null {
  const average = weightedAverage(samples, (sample) => sample.eurPerKwh)
  return average === null ? null : Number(average.toFixed(8))
}

function averageExchangeRate(samples: SpotSample[]): number | null {
  const average = weightedAverage(samples, (sample) => sample.exchangeRate)
  return average === null ? null : Number(average.toFixed(8))
}

function validateSampleTimeline(samples: SpotSample[]): SpotSample[] {
  const ordered = [...samples].sort((a, b) => a.startMs - b.startMs)
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1]
    const current = ordered[index]
    if (!previous || !current) continue
    if (current.startMs < previous.endMs) {
      throw new Error('Elprisetjustnu API returnerade överlappande prisintervall.')
    }
    if (current.startMs - previous.endMs > 1_000) {
      throw new Error('Elprisetjustnu API returnerade ett ofullständigt marknadsdygn med luckor i prisintervallen.')
    }
  }
  if (ordered.length) {
    const totalDurationMinutes = ordered.reduce((sum, sample) => sum + sample.durationMinutes, 0)
    if (totalDurationMinutes < 1_380 || totalDurationMinutes > 1_500) {
      throw new Error('Elprisetjustnu API returnerade inte ett komplett marknadsdygn.')
    }
  }
  return ordered
}

async function fetchDailySpotSamples(params: {
  year: number
  month: number
  day: number
  area: PriceArea
}): Promise<SpotSample[]> {
  const response = await fetch(marketUrl(params), {
    headers: { accept: 'application/json' },
    next: { revalidate: 5 * 60 },
    signal: AbortSignal.timeout(apiTimeoutMs()),
  })

  if (response.status === 404) return []

  if (!response.ok) {
    throw new Error(
      `Elprisetjustnu API svarade med ${response.status} för ${params.area} ${params.year}-${pad2(params.month)}-${pad2(params.day)}.`,
    )
  }

  const data = (await response.json()) as unknown
  if (!Array.isArray(data)) {
    throw new Error('Elprisetjustnu API returnerade ett ogiltigt prisformat.')
  }

  const samples = data.map(parseSample).filter((sample): sample is SpotSample => Boolean(sample))
  if (data.length > 0 && samples.length === 0) {
    throw new Error('Elprisetjustnu API saknade giltiga SEK-priser eller tidsintervall.')
  }
  return validateSampleTimeline(samples)
}

export function stockholmDateParts(now = new Date()): {
  year: number
  month: number
  day: number
} {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Stockholm',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now)
  const year = Number(parts.find((part) => part.type === 'year')?.value)
  const month = Number(parts.find((part) => part.type === 'month')?.value)
  const day = Number(parts.find((part) => part.type === 'day')?.value)
  if ([year, month, day].every(Number.isFinite)) return { year, month, day }
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() }
}

export async function fetchDailySpotAverageFromElprisetJustNu(params: {
  year: number
  month: number
  day: number
  priceArea: PriceArea
  reportingIntervalMinutes?: 15 | 60
}): Promise<DailySpotApiAverage | null> {
  const samples = await fetchDailySpotSamples({
    year: params.year,
    month: params.month,
    day: params.day,
    area: params.priceArea,
  })
  const avgSpotOre = weightedAverageOre(samples)
  if (avgSpotOre === null) return null

  const marketIntervalMinutes = representativeIntervalMinutes(samples)
  const totalDurationMinutes = samples.reduce((sum, sample) => sum + sample.durationMinutes, 0)
  const reportingIntervalMinutes = params.reportingIntervalMinutes ?? marketIntervalMinutes
  const reportedSamples = reportingIntervalMinutes && reportingIntervalMinutes > 0
    ? Math.round(totalDurationMinutes / reportingIntervalMinutes)
    : samples.length

  return {
    source: 'elprisetjustnu_api',
    priceArea: params.priceArea,
    year: params.year,
    month: params.month,
    day: params.day,
    avgSpotOre,
    samples: reportedSamples,
    intervalMinutes: reportingIntervalMinutes,
    sourceSamples: samples.length,
    sourceIntervalMinutes: marketIntervalMinutes,
    avgSpotEurPerKwh: averageEurPerKwh(samples),
    exchangeRate: averageExchangeRate(samples),
    periodStart: `${params.year}-${pad2(params.month)}-${pad2(params.day)}`,
    periodEnd: `${params.year}-${pad2(params.month)}-${pad2(params.day)}`,
  }
}

export async function fetchMonthlySpotAverageFromElprisetJustNu(params: {
  year: number
  month: number
  priceArea: PriceArea
  throughDay?: number
}): Promise<MonthlySpotApiAverage | null> {
  const calendarDayCount = daysInMonth(params.year, params.month)
  const dayCount = params.throughDay === undefined
    ? calendarDayCount
    : Math.min(calendarDayCount, Math.max(1, Math.floor(params.throughDay)))
  const days = Array.from({ length: dayCount }, (_, index) => index + 1)
  const dailySamples = await Promise.all(
    days.map((day) =>
      fetchDailySpotSamples({
        year: params.year,
        month: params.month,
        day,
        area: params.priceArea,
      }),
    ),
  )

  const missingDays = dailySamples.flatMap((samples, index) =>
    samples.length ? [] : [index + 1],
  )
  if (missingDays.length) {
    throw new Error(
      `Elprisetjustnu saknar prisdata för ${params.priceArea} ${params.year}-${pad2(params.month)} dag ${missingDays.join(', ')}.`,
    )
  }

  const samples = dailySamples.flat()
  const avgSpotOre = weightedAverageOre(samples)
  if (avgSpotOre === null) return null

  return {
    source: 'elprisetjustnu_api',
    priceArea: params.priceArea,
    year: params.year,
    month: params.month,
    avgSpotOre,
    samples: samples.length,
    intervalMinutes: representativeIntervalMinutes(samples),
    sourceSamples: samples.length,
    sourceIntervalMinutes: representativeIntervalMinutes(samples),
    avgSpotEurPerKwh: averageEurPerKwh(samples),
    exchangeRate: averageExchangeRate(samples),
    periodStart: `${params.year}-${pad2(params.month)}-01`,
    periodEnd: `${params.year}-${pad2(params.month)}-${pad2(dayCount)}`,
  }
}
