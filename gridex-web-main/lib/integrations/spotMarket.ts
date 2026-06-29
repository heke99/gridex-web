import type { SupabaseClient } from '@supabase/supabase-js'

export type PriceArea = 'SE1' | 'SE2' | 'SE3' | 'SE4'

export const PRICE_AREAS: PriceArea[] = ['SE1', 'SE2', 'SE3', 'SE4']

type ElprisetJustNuEntry = {
  SEK_per_kWh?: unknown
  EUR_per_kWh?: unknown
  EXR?: unknown
  time_start?: unknown
  time_end?: unknown
}

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

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function isPriceArea(value: unknown): value is PriceArea {
  return typeof value === 'string' && PRICE_AREAS.includes(value as PriceArea)
}

export function normalizePriceAreas(input: unknown): PriceArea[] {
  if (!Array.isArray(input) || input.length === 0) return PRICE_AREAS

  const areas = input
    .map((value) => String(value).trim().toUpperCase())
    .filter(isPriceArea)

  return areas.length > 0 ? Array.from(new Set(areas)) : PRICE_AREAS
}

export function validateYearMonth(year: unknown, month: unknown) {
  const parsedYear = Number(year)
  const parsedMonth = Number(month)

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
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth() + 1

  if (month === 1) return { year: year - 1, month: 12 }
  return { year, month: month - 1 }
}

function marketUrl(params: {
  baseUrl?: string
  year: number
  month: number
  day: number
  area: PriceArea
}) {
  const template =
    params.baseUrl ??
    process.env.SPOT_PRICE_API_URL_TEMPLATE ??
    'https://www.elprisetjustnu.se/api/v1/prices/{YEAR}/{MONTH}-{DAY}_{AREA}.json'

  return template
    .replaceAll('{YEAR}', String(params.year))
    .replaceAll('{MONTH}', pad2(params.month))
    .replaceAll('{DAY}', pad2(params.day))
    .replaceAll('{AREA}', params.area)
}

async function fetchDailyPrices(params: {
  year: number
  month: number
  day: number
  area: PriceArea
}): Promise<number[]> {
  const url = marketUrl(params)
  const response = await fetch(url, {
    headers: { accept: 'application/json' },
    next: { revalidate: 60 * 60 },
  })

  if (response.status === 404) {
    return []
  }

  if (!response.ok) {
    throw Object.assign(
      new Error(`Spot price API failed for ${params.area} ${url}: ${response.status}`),
      { status: 502 }
    )
  }

  const data = (await response.json()) as unknown
  if (!Array.isArray(data)) return []

  return data
    .map((entry: ElprisetJustNuEntry) => Number(entry.SEK_per_kWh))
    .filter((value) => Number.isFinite(value))
}

async function importAreaMonth(params: {
  year: number
  month: number
  area: PriceArea
}): Promise<ImportedSpotArea> {
  const values: number[] = []
  const dayCount = daysInMonth(params.year, params.month)

  for (let day = 1; day <= dayCount; day += 1) {
    const daily = await fetchDailyPrices({ ...params, day })
    values.push(...daily)
  }

  if (values.length === 0) {
    throw Object.assign(
      new Error(
        `No spot price samples found for ${params.area} ${params.year}-${pad2(params.month)}`
      ),
      { status: 422 }
    )
  }

  const avgSekPerKwh =
    values.reduce((sum, value) => sum + value, 0) / values.length

  return {
    priceArea: params.area,
    year: params.year,
    month: params.month,
    avgSpotOre: Number((avgSekPerKwh * 100).toFixed(6)),
    samples: values.length,
  }
}

async function queueSyncJob(
  supabase: SupabaseClient,
  result: Omit<SpotImportResult, 'syncJobId'>
): Promise<string | null> {
  const { data, error } = await supabase
    .from('integration_sync_jobs')
    .insert({
      provider_key: 'elprisetjustnu',
      entity_type: 'spot_monthly_prices',
      entity_id: `${result.year}-${pad2(result.month)}`,
      direction: 'inbound',
      status: 'success',
      payload: {
        source: result.source,
        year: result.year,
        month: result.month,
        areas: result.areas,
      },
      response_payload: {},
      idempotency_key: `elprisetjustnu:spot:${result.year}-${pad2(result.month)}`,
    })
    .select('id')
    .single<{ id: string }>()

  if (error) {
    console.error('[spotMarket.queueSyncJob] failed', error)
    return null
  }

  return data.id
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
  const areas = params.areas?.length ? params.areas : PRICE_AREAS
  const imported: ImportedSpotArea[] = []

  for (const area of areas) {
    imported.push(
      await importAreaMonth({
        year: params.year,
        month: params.month,
        area,
      })
    )
  }

  const upsertRows = imported.map((area) => ({
    price_area: area.priceArea,
    year: area.year,
    month: area.month,
    avg_spot_ore: area.avgSpotOre,
    source: 'elprisetjustnu',
    source_payload: { samples: area.samples },
  }))

  const { error } = await supabase
    .from('gridex_monthly_spot_prices')
    .upsert(upsertRows, { onConflict: 'price_area,year,month' })

  if (error) {
    throw Object.assign(new Error(error.message), { status: 500 })
  }

  if (params.publish) {
    const { error: publishError } = await supabase.rpc(
      'gridex_spot_publish_active_basis',
      {
        p_year: params.year,
        p_month: params.month,
        p_reason:
          params.publishReason ??
          `Autoimport från elprisetjustnu (${params.year}-${pad2(params.month)})`,
      }
    )

    if (publishError) {
      throw Object.assign(new Error(publishError.message), { status: 500 })
    }
  }

  const result = {
    source: 'elprisetjustnu',
    year: params.year,
    month: params.month,
    areas: imported,
  }

  return {
    ...result,
    syncJobId: await queueSyncJob(supabase, result),
  }
}
