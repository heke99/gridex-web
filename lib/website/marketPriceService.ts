import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import {
  fetchDailySpotSeriesFromElprisetJustNu,
  fetchMonthlySpotAverageFromElprisetJustNu,
  stockholmDateParts,
} from '@/lib/gridex/pricing/elprisetjustnu'
import type { OpsPublicContract, OpsWebsiteMarketPriceInput, OpsWebsitePriceArea } from '@/lib/ops/client'

function contractKind(contract: OpsPublicContract): 'fixed' | 'monthly_fixed' | 'portfolio' | 'monthly' | 'hour' | 'quarter' | 'mix' {
  const value = String(contract.contract_type ?? contract.type).toLowerCase()
  if (value === 'fixed') return 'fixed'
  if (value === 'monthly_fixed' || value === 'fixed_monthly') return 'monthly_fixed'
  if (value === 'portfolio' || value === 'portfolio_managed') return 'portfolio'
  if (value === 'mix' || value === 'mixed') return 'mix'
  if (/quarter|15[_ -]?min|kvart/.test(value)) return 'quarter'
  if (/hour|tim/.test(value)) return 'hour'
  return 'monthly'
}
function previousCompleteMonth(now = new Date()) {
  const current = stockholmDateParts(now)
  const date = new Date(Date.UTC(current.year, current.month - 2, 1))
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 }
}
function previousStockholmDay(now = new Date()) {
  const current = stockholmDateParts(now)
  const date = new Date(Date.UTC(current.year, current.month - 1, current.day - 1))
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() }
}
function weightedAverage(intervals: Array<{ amount_ore_per_kwh: number; duration_minutes: number }>): number {
  const minutes = intervals.reduce((sum, interval) => sum + interval.duration_minutes, 0)
  if (!Number.isFinite(minutes) || minutes < 1) throw new Error('Marknadsprisserien saknar giltig tidslängd.')
  return Number((intervals.reduce((sum, interval) => sum + interval.amount_ore_per_kwh * interval.duration_minutes, 0) / minutes).toFixed(6))
}

export async function buildOpsMarketPriceInput(input: {
  contract: OpsPublicContract
  priceArea: OpsWebsitePriceArea
}): Promise<OpsWebsiteMarketPriceInput | null> {
  const kind = contractKind(input.contract)
  if (kind === 'fixed' || kind === 'monthly_fixed' || kind === 'portfolio') return null

  if (kind === 'hour' || kind === 'quarter') {
    const day = previousStockholmDay()
    const intervals = await fetchDailySpotSeriesFromElprisetJustNu({ ...day, priceArea: input.priceArea })
    if (!intervals.length) throw new Error('Marknadspris saknas för senaste kompletta marknadsdygn.')
    const totalMinutes = intervals.reduce((sum, interval) => sum + interval.duration_minutes, 0)
    if (totalMinutes < 1_380 || totalMinutes > 1_500) throw new Error('Marknadsprisserien täcker inte ett komplett 23-, 24- eller 25-timmarsdygn.')
    const representativeInterval = Math.round(
      [...intervals].sort((a, b) => a.duration_minutes - b.duration_minutes)[Math.floor(intervals.length / 2)]?.duration_minutes ?? 0,
    )
    const requiredInterval = kind === 'quarter' ? 15 : 60
    const method = representativeInterval === requiredInterval
      ? `${kind}_flat_consumption_profile_actual_intervals`
      : `${kind}_flat_consumption_profile_source_${representativeInterval}_minute_estimate`
    const payload = {
      provider: 'elprisetjustnu',
      price_area_code: input.priceArea,
      period_start: intervals[0]!.time_start,
      period_end: intervals[intervals.length - 1]!.time_end,
      amount_ore_per_kwh: weightedAverage(intervals),
      interval_minutes: representativeInterval,
      calculation_method: method,
      expected_intervals: representativeInterval > 0 ? Math.round(totalMinutes / representativeInterval) : intervals.length,
      received_intervals: intervals.length,
      completeness_ratio: 1,
    }
    return {
      ...payload,
      payload_sha256: createHash('sha256').update(JSON.stringify({ payload, intervals })).digest('hex'),
    }
  }

  const period = previousCompleteMonth()
  const spot = await fetchMonthlySpotAverageFromElprisetJustNu({ year: period.year, month: period.month, priceArea: input.priceArea })
  if (!spot) throw new Error('Marknadspris saknas för föregående kompletta kalendermånad.')
  const payload = {
    provider: 'elprisetjustnu',
    price_area_code: input.priceArea,
    period_start: spot.periodStart,
    period_end: spot.periodEnd,
    amount_ore_per_kwh: spot.avgSpotOre,
    interval_minutes: spot.sourceIntervalMinutes ?? spot.intervalMinutes,
    calculation_method: kind === 'mix' ? 'mix_monthly_spot_component_historical' : 'monthly_historical_weighted_average',
    expected_intervals: spot.samples,
    received_intervals: spot.samples,
    completeness_ratio: 1,
  }
  return { ...payload, payload_sha256: createHash('sha256').update(JSON.stringify(payload)).digest('hex') }
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) throw new Error('Market price audit storage is not configured.')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function persistMarketPriceSnapshot(input: OpsWebsiteMarketPriceInput | null): Promise<string | null> {
  if (!input) return null
  const start = input.period_start.slice(0, 10)
  const end = input.period_end.slice(0, 10)
  const interval = input.interval_minutes ?? null
  const expected = input.expected_intervals ?? null
  const received = input.received_intervals ?? null
  const { data, error } = await serviceClient().from('market_price_snapshots').insert({
    provider: input.provider,
    price_area_code: input.price_area_code,
    period_type: interval === 15 ? 'quarter_day' : interval === 60 ? 'hour_day' : 'calendar_month',
    period_start: start,
    period_end: end,
    average_ore_per_kwh: input.amount_ore_per_kwh,
    source_interval_minutes: interval,
    expected_intervals: expected,
    received_intervals: received,
    completeness_ratio: input.completeness_ratio ?? (expected && received ? received / expected : 1),
    valid_until: new Date(Date.now() + 20 * 60_000).toISOString(),
    provider_payload_sha256: input.payload_sha256 ?? null,
    calculation_version: input.calculation_method ?? 'market-input-2026-07-23.1',
  }).select('id').single<{ id: string }>()
  if (error) throw new Error(`Market price audit storage failed: ${error.message}`)
  return data.id
}
