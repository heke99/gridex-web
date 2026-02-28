// lib/gridex/pricing/db.ts

import type { SupabaseClient } from '@supabase/supabase-js'
import type { PostgrestSingleResponse, PostgrestError } from '@supabase/postgrest-js'
import type {
  ContractAreaPricing,
  PortfolioAreaPricing,
  PriceArea,
  PublishedPricingVersion,
  SpotAreaSettings,
} from './types'
import { prevYearMonth, safeNumber } from './validators'
import { looksLikeMissingColumn } from './schema'

/* ============================================================
   SAFE QUERY WRAPPER (100% type-correct)
============================================================ */

export async function tryQuery<T>(
  p: PromiseLike<PostgrestSingleResponse<T>>
): Promise<PostgrestSingleResponse<T>> {
  try {
    return await p
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)

    const pgErr: PostgrestError = {
      name: 'PostgrestError',
      message,
      details: '',
      hint: '',
      code: 'QUERY_FAILED',
    }

    return {
      data: null,
      error: pgErr,
      count: null,
      status: 500,
      statusText: 'Query failed',
    } as PostgrestSingleResponse<T>
  }
}

/* ============================================================
   FETCH ACTIVE PUBLISHED VERSION (LIVE only)
============================================================ */

export async function fetchActivePublishedPricingVersion(
  supabase: SupabaseClient,
  contractId: string,
  nowIso: string
): Promise<PublishedPricingVersion | null> {
  const selectCommon = 'id,contract_id,version_number,valid_from,status,is_published'

  const probe = await tryQuery<{ status: string | null } | null>(
    supabase
      .from('contract_pricing_versions')
      .select('status')
      .eq('contract_id', contractId)
      .limit(1)
      .maybeSingle()
  )

  const hasStatus = !looksLikeMissingColumn(probe.error, 'status')

  const baseQuery = supabase
    .from('contract_pricing_versions')
    .select(selectCommon)
    .eq('contract_id', contractId)
    .lte('valid_from', nowIso)
    .order('valid_from', { ascending: false })
    .limit(1)

  if (hasStatus) {
    const res = await tryQuery<PublishedPricingVersion | null>(
      baseQuery.eq('status', 'published').maybeSingle()
    )
    return res.data ?? null
  }

  const res = await tryQuery<PublishedPricingVersion | null>(
    baseQuery.eq('is_published', true).maybeSingle()
  )

  return res.data ?? null
}

/* ============================================================
   AREA PRICING (raw)
============================================================ */

export async function fetchAreaPricingForVersion(
  supabase: SupabaseClient,
  pricingVersionId: string
): Promise<ContractAreaPricing[]> {
  const res = await tryQuery<ContractAreaPricing[]>(
    supabase
      .from('contract_area_pricing')
      .select('id,pricing_version_id,price_area,price_per_kwh_ore,markup_ore,monthly_fee_sek')
      .eq('pricing_version_id', pricingVersionId)
      .order('price_area', { ascending: true })
  )

  if (res.error || !res.data) return []
  return res.data
}

/* ============================================================
   SPOT SETTINGS / PORTFOLIO SETTINGS (placeholders kept)
============================================================ */

export async function fetchSpotSettingsForArea(
  supabase: SupabaseClient,
  priceArea: PriceArea
): Promise<SpotAreaSettings> {
  // Placeholder kept for forward-compat. No-op today.
  void supabase
  prevYearMonth(new Date())

  return {
    pricing_version_id: '',
    contract_id: '',
    price_area: priceArea,
    markup_ore: null,
    variable_fee_ore: null,
    monthly_fee_sek: null,
    elcert_ore: null,
  }
}

export async function fetchPortfolioPricingForArea(
  supabase: SupabaseClient,
  priceArea: PriceArea
): Promise<{ price_area: PriceArea } | null> {
  void supabase
  return { price_area: priceArea }
}

/* ============================================================
   SPOT AVG
============================================================ */

export async function fetchPrevMonthSpotAvgOre(
  supabase: SupabaseClient,
  priceArea: PriceArea,
  year: number,
  month: number
): Promise<number> {
  const res = await tryQuery<{ avg_ore: number } | null>(
    supabase
      .from('gridex_spot_monthly_avg')
      .select('avg_ore')
      .eq('price_area', priceArea)
      .eq('year', year)
      .eq('month', month)
      .maybeSingle()
  )

  return safeNumber(res.data?.avg_ore ?? 0, 0)
}

/* ============================================================
   LIVE CONTRACTS (used by /avtal + /teckna)
============================================================ */

export async function fetchLivePublishedContracts(
  supabase: SupabaseClient,
  nowIso: string
): Promise<Array<{ id: string; name: string; slug: string; contract_type: 'spot_hourly' | 'portfolio_managed' | 'fixed' }>> {
  const resContracts = await tryQuery<
    Array<{ id: string; name: string; slug: string; contract_type: 'spot_hourly' | 'portfolio_managed' | 'fixed' }>
  >(
    supabase
      .from('contract_products')
      .select('id,name,slug,contract_type')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
  )

  const contracts = resContracts.data ?? []
  if (resContracts.error || contracts.length === 0) return []

  const ids = contracts.map((c) => c.id)

  const probe = await tryQuery<{ status: string | null } | null>(
    supabase
      .from('contract_pricing_versions')
      .select('status')
      .in('contract_id', ids)
      .limit(1)
      .maybeSingle()
  )

  const hasStatus = !looksLikeMissingColumn(probe.error, 'status')

  let publishedIds = new Set<string>()

  const base = supabase
    .from('contract_pricing_versions')
    .select('contract_id')
    .in('contract_id', ids)
    .lte('valid_from', nowIso)

  if (hasStatus) {
    const res = await tryQuery<Array<{ contract_id: string }>>(base.eq('status', 'published'))
    if (res.data) publishedIds = new Set(res.data.map((r) => r.contract_id))
  } else {
    const res = await tryQuery<Array<{ contract_id: string }>>(base.eq('is_published', true))
    if (res.data) publishedIds = new Set(res.data.map((r) => r.contract_id))
  }

  return contracts.filter((c) => publishedIds.has(c.id))
}

/* ============================================================
   ✅ BACKWARD-COMPAT EXPORTS FOR engine.ts (DO NOT REMOVE)
============================================================ */

export async function fetchAreaPricing(
  supabase: SupabaseClient,
  pricingVersionId: string,
  priceArea: PriceArea
): Promise<ContractAreaPricing | null> {
  const rows = await fetchAreaPricingForVersion(supabase, pricingVersionId)
  return rows.find((r) => r.price_area === priceArea) ?? null
}

export async function fetchPrevMonthlySpotAvg(
  supabase: SupabaseClient,
  priceArea: PriceArea,
  now: Date
): Promise<{ year: number; month: number; avgSpotOre: number } | null> {
  const ym = prevYearMonth(now)
  const avg = await fetchPrevMonthSpotAvgOre(supabase, priceArea, ym.year, ym.month)
  if (!Number.isFinite(avg) || avg <= 0) return null
  return { year: ym.year, month: ym.month, avgSpotOre: avg }
}

export async function fetchSpotSettings(
  supabase: SupabaseClient,
  params: { pricingVersionId: string; contractId: string; priceArea: PriceArea }
): Promise<{
  settings: SpotAreaSettings | null
  keyMode: 'pricing_version_id'
  probes: { spotHasElcertOre: boolean }
}> {
  const row = await fetchAreaPricing(supabase, params.pricingVersionId, params.priceArea)

  if (!row) {
    return { settings: null, keyMode: 'pricing_version_id', probes: { spotHasElcertOre: false } }
  }

  const settings: SpotAreaSettings = {
    pricing_version_id: params.pricingVersionId ?? '',
    contract_id: params.contractId ?? '',
    price_area: params.priceArea,
    markup_ore: row.markup_ore ?? 0,
    variable_fee_ore: 0,
    monthly_fee_sek: row.monthly_fee_sek ?? 0,
    elcert_ore: 0,
  }

  return { settings, keyMode: 'pricing_version_id', probes: { spotHasElcertOre: false } }
}

export async function fetchPortfolioPricing(
  supabase: SupabaseClient,
  params: { pricingVersionId: string; contractId: string; priceArea: PriceArea }
): Promise<{
  row: PortfolioAreaPricing | null
  keyMode: 'pricing_version_id'
  probes: { portfolioHasElcertOre: boolean }
}> {
  const row = await fetchAreaPricing(supabase, params.pricingVersionId, params.priceArea)

  if (!row) {
    return { row: null, keyMode: 'pricing_version_id', probes: { portfolioHasElcertOre: false } }
  }

  const out: PortfolioAreaPricing = {
    pricing_version_id: params.pricingVersionId ?? '',
    contract_id: params.contractId ?? '',
    price_area: params.priceArea,
    fixed_price_ore: row.price_per_kwh_ore ?? 0,
    variable_fee_ore: 0,
    monthly_fee_sek: row.monthly_fee_sek ?? 0,
    elcert_ore: 0,
  }

  return { row: out, keyMode: 'pricing_version_id', probes: { portfolioHasElcertOre: false } }
}