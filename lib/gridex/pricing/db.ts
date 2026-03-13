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
   SAFE QUERY WRAPPER
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
   ENTERPRISE: robust for DATE vs TIMESTAMPTZ casting
============================================================ */

function toIsoDate(isoOrDate: string): string {
  if (isoOrDate.length >= 10) return isoOrDate.slice(0, 10)
  return isoOrDate
}

function parseValidFromToDate(value: unknown): Date | null {
  if (value == null) return null
  const s = String(value)
  const d = new Date(s.length === 10 ? `${s}T00:00:00.000Z` : s)
  return Number.isFinite(d.getTime()) ? d : null
}

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
  const today = toIsoDate(nowIso)

  const baseQuery = supabase
    .from('contract_pricing_versions')
    .select(selectCommon)
    .eq('contract_id', contractId)
    .lte('valid_from', today)
    .order('valid_from', { ascending: false })
    .limit(1)

  if (hasStatus) {
    const res = await tryQuery<PublishedPricingVersion | null>(
      baseQuery.eq('status', 'published').maybeSingle()
    )
    if (res.data) return res.data
  } else {
    const res = await tryQuery<PublishedPricingVersion | null>(
      baseQuery.eq('is_published', true).maybeSingle()
    )
    if (res.data) return res.data
  }

  const fallbackQuery = supabase
    .from('contract_pricing_versions')
    .select(selectCommon)
    .eq('contract_id', contractId)
    .order('valid_from', { ascending: false })
    .limit(5)

  const fallbackRes = hasStatus
    ? await tryQuery<PublishedPricingVersion[]>(fallbackQuery.eq('status', 'published'))
    : await tryQuery<PublishedPricingVersion[]>(fallbackQuery.eq('is_published', true))

  if (fallbackRes.error || !fallbackRes.data || fallbackRes.data.length === 0) {
    return null
  }

  const now = new Date(nowIso)
  const todayDate = new Date(`${today}T00:00:00.000Z`)

  for (const v of fallbackRes.data) {
    const vf = parseValidFromToDate(v.valid_from)
    if (!vf) continue

    const isDateOnly = String(v.valid_from).length === 10
    const isLive = isDateOnly
      ? vf.getTime() <= todayDate.getTime()
      : vf.getTime() <= now.getTime()

    if (isLive) return v
  }

  return null
}

/* ============================================================
   AREA PRICING
============================================================ */

export async function fetchAreaPricingForVersion(
  supabase: SupabaseClient,
  pricingVersionId: string
): Promise<ContractAreaPricing[]> {
  const select =
    'id,pricing_version_id,price_area,price_per_kwh_ore,markup_ore,variable_fee_ore,elcert_ore,monthly_fee_sek'

  const res = await tryQuery<ContractAreaPricing[]>(
    supabase
      .from('contract_area_pricing')
      .select(select)
      .eq('pricing_version_id', pricingVersionId)
      .order('price_area', { ascending: true })
  )

  if (res.error) return []
  return res.data ?? []
}

export async function fetchAreaPricing(
  supabase: SupabaseClient,
  pricingVersionId: string,
  priceArea: PriceArea
): Promise<ContractAreaPricing | null> {
  const rows = await fetchAreaPricingForVersion(supabase, pricingVersionId)
  return rows.find((r) => r.price_area === priceArea) ?? null
}

/* ============================================================
   ACTIVE SPOT BASIS PERIOD
============================================================ */

type SpotBasisConfigRow = {
  active_year: number
  active_month: number
}

export async function fetchActiveSpotBasisPeriod(
  supabase: SupabaseClient,
  now: Date
): Promise<{ year: number; month: number }> {
  const fallback = prevYearMonth(now)

  const res = await tryQuery<SpotBasisConfigRow | null>(
    supabase
      .from('gridex_spot_basis_config')
      .select('active_year,active_month')
      .eq('id', 1)
      .maybeSingle()
  )

  if (res.error || !res.data) return fallback

  const y = Number(res.data.active_year)
  const m = Number(res.data.active_month)

  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return fallback
  }

  return { year: y, month: m }
}

/* ============================================================
   SPOT AVG (ADMIN TABLE FIRST)
============================================================ */

type MonthlySpotRow = {
  avg_spot_ore: number
}

type LegacySpotRow = {
  avg_ore: number
}

export async function fetchPrevMonthSpotAvgOre(
  supabase: SupabaseClient,
  priceArea: PriceArea,
  year: number,
  month: number
): Promise<number> {
  const res = await tryQuery<MonthlySpotRow | null>(
    supabase
      .from('gridex_monthly_spot_prices')
      .select('avg_spot_ore')
      .eq('price_area', priceArea)
      .eq('year', year)
      .eq('month', month)
      .maybeSingle()
  )

  if (res.data?.avg_spot_ore != null) {
    const v = safeNumber(res.data.avg_spot_ore, 0)
    if (v > 0) return v
  }

  const legacy = await tryQuery<LegacySpotRow | null>(
    supabase
      .from('gridex_spot_monthly_avg')
      .select('avg_ore')
      .eq('price_area', priceArea)
      .eq('year', year)
      .eq('month', month)
      .maybeSingle()
  )

  if (legacy.data?.avg_ore != null) {
    const v = safeNumber(legacy.data.avg_ore, 0)
    if (v > 0) return v
  }

  return 0
}

export async function fetchPrevMonthlySpotAvg(
  supabase: SupabaseClient,
  priceArea: PriceArea,
  now: Date
): Promise<{ year: number; month: number; avgSpotOre: number } | null> {
  const active = await fetchActiveSpotBasisPeriod(supabase, now)

  const avg = await fetchPrevMonthSpotAvgOre(
    supabase,
    priceArea,
    active.year,
    active.month
  )

  if (!Number.isFinite(avg) || avg <= 0) return null

  return {
    year: active.year,
    month: active.month,
    avgSpotOre: avg,
  }
}

/* ============================================================
   SPOT SETTINGS
============================================================ */

export async function fetchSpotSettings(
  supabase: SupabaseClient,
  params: {
    pricingVersionId: string
    contractId: string
    priceArea: PriceArea
  }
): Promise<{
  settings: SpotAreaSettings | null
  keyMode: 'pricing_version_id'
  probes: { spotHasElcertOre: boolean }
}> {
  const row = await fetchAreaPricing(
    supabase,
    params.pricingVersionId,
    params.priceArea
  )

  const spotHasElcertOre = row ? row.elcert_ore !== undefined : false

  if (!row) {
    return {
      settings: null,
      keyMode: 'pricing_version_id',
      probes: { spotHasElcertOre },
    }
  }

  const settings: SpotAreaSettings = {
    pricing_version_id: params.pricingVersionId,
    contract_id: params.contractId,
    price_area: params.priceArea,
    markup_ore: row.markup_ore ?? 0,
    variable_fee_ore: row.variable_fee_ore ?? 0,
    monthly_fee_sek: row.monthly_fee_sek ?? 0,
    elcert_ore: row.elcert_ore ?? 0,
  }

  return {
    settings,
    keyMode: 'pricing_version_id',
    probes: { spotHasElcertOre },
  }
}

/* ============================================================
   PORTFOLIO / FIXED
============================================================ */

export async function fetchPortfolioPricing(
  supabase: SupabaseClient,
  params: {
    pricingVersionId: string
    contractId: string
    priceArea: PriceArea
  }
): Promise<{
  row: PortfolioAreaPricing | null
  keyMode: 'pricing_version_id'
  probes: { portfolioHasElcertOre: boolean }
}> {
  const row = await fetchAreaPricing(
    supabase,
    params.pricingVersionId,
    params.priceArea
  )

  const portfolioHasElcertOre = row ? row.elcert_ore !== undefined : false

  if (!row) {
    return {
      row: null,
      keyMode: 'pricing_version_id',
      probes: { portfolioHasElcertOre },
    }
  }

  const out: PortfolioAreaPricing = {
    pricing_version_id: params.pricingVersionId,
    contract_id: params.contractId,
    price_area: params.priceArea,
    fixed_price_ore: row.price_per_kwh_ore ?? 0,
    variable_fee_ore: row.variable_fee_ore ?? 0,
    monthly_fee_sek: row.monthly_fee_sek ?? 0,
    elcert_ore: row.elcert_ore ?? 0,
  }

  return {
    row: out,
    keyMode: 'pricing_version_id',
    probes: { portfolioHasElcertOre },
  }
}

/* ============================================================
   PUBLIC: FETCH LIVE PUBLISHED CONTRACTS (FRONTEND /avtal)
   ENTERPRISE SAFE – Compatible with status OR is_published
============================================================ */

export type LivePublishedContract = {
  contract: {
    id: string
    name: string
    slug?: string
    contract_type: string
    is_active: boolean
    created_at?: string
    short_description?: string
    badge_text?: string
    sort_order?: number | null
    is_featured?: boolean
  }
  pricingVersion: PublishedPricingVersion

  id: string
  name: string
  slug?: string
  contract_type: string
  short_description?: string
  badge_text?: string
  sort_order?: number | null
  is_featured?: boolean
}

type ContractProductRow = {
  id: string
  name: string
  slug: string | null
  contract_type: string
  is_active: boolean
  created_at: string | null
  sort_order?: number | null
  short_description?: string | null
  badge_text?: string | null
  is_featured?: boolean | null
}

async function fetchActiveContractsOrdered(
  supabase: SupabaseClient
): Promise<PostgrestSingleResponse<ContractProductRow[]>> {
  const res1 = await tryQuery<ContractProductRow[]>(
    supabase
      .from('contract_products')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
  )

  if (!res1.error) return res1

  if (looksLikeMissingColumn(res1.error, 'sort_order')) {
    const res2 = await tryQuery<ContractProductRow[]>(
      supabase
        .from('contract_products')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .order('name', { ascending: true })
    )
    return res2
  }

  return res1
}

export async function fetchLivePublishedContracts(
  supabase: SupabaseClient,
  nowIso: string
): Promise<LivePublishedContract[]> {
  const res = await fetchActiveContractsOrdered(supabase)

  if (res.error || !res.data || res.data.length === 0) return []

  const result: LivePublishedContract[] = []

  for (const contract of res.data) {
    const version = await fetchActivePublishedPricingVersion(
      supabase,
      contract.id,
      nowIso
    )

    if (!version) continue

    result.push({
      contract: {
        id: contract.id,
        name: contract.name,
        slug: contract.slug ?? undefined,
        contract_type: contract.contract_type,
        is_active: contract.is_active,
        created_at: contract.created_at ?? undefined,
        short_description: contract.short_description ?? undefined,
        badge_text: contract.badge_text ?? undefined,
        sort_order: contract.sort_order ?? null,
        is_featured: Boolean(contract.is_featured),
      },
      pricingVersion: version,

      id: contract.id,
      name: contract.name,
      slug: contract.slug ?? undefined,
      contract_type: contract.contract_type,
      short_description: contract.short_description ?? undefined,
      badge_text: contract.badge_text ?? undefined,
      sort_order: contract.sort_order ?? null,
      is_featured: Boolean(contract.is_featured),
    })
  }

  return result
}