// lib/gridex/pricing/db.ts

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ContractAreaPricing,
  PortfolioAreaPricing,
  PriceArea,
  PublishedPricingVersion,
  SpotAreaSettings,
} from './types'
import { prevYearMonth, safeNumber } from './validators'
import { looksLikeMissingColumn } from './schema'

type DbResult<T> = { data: T | null; error: unknown }

// ✅ Enterprise: Accept Supabase builders (PromiseLike), not only real Promises.
export async function tryQuery<T>(
  builder: PromiseLike<DbResult<T>>
): Promise<DbResult<T>> {
  try {
    const res = await builder
    return { data: res.data ?? null, error: res.error }
  } catch (e) {
    return { data: null, error: e }
  }
}

export async function fetchActivePublishedPricingVersion(
  supabase: SupabaseClient,
  contractId: string,
  nowIso: string
): Promise<{ version: PublishedPricingVersion | null; mode: 'status' | 'is_published'; probes: { versionsHasStatus: boolean; versionsHasIsPublished: boolean } }> {

  // Mode A: status='published'
  const q1 = await tryQuery<PublishedPricingVersion>(
    supabase
      .from('contract_pricing_versions')
      .select('id,contract_id,version_number,valid_from,status')
      .eq('contract_id', contractId)
      .eq('status', 'published')
      .lte('valid_from', nowIso)
      .order('valid_from', { ascending: false })
      .limit(1)
      .maybeSingle()
  )

  const versionsHasStatus = !looksLikeMissingColumn(q1.error, 'status')

  if (!q1.error && q1.data?.id) {
    return { version: q1.data, mode: 'status', probes: { versionsHasStatus, versionsHasIsPublished: true } }
  }

  // Mode B: is_published = true
  const q2 = await tryQuery<PublishedPricingVersion>(
    supabase
      .from('contract_pricing_versions')
      .select('id,contract_id,version_number,valid_from,is_published')
      .eq('contract_id', contractId)
      .eq('is_published', true)
      .lte('valid_from', nowIso)
      .order('valid_from', { ascending: false })
      .limit(1)
      .maybeSingle()
  )

  const versionsHasIsPublished = !looksLikeMissingColumn(q2.error, 'is_published')

  if (!q2.error && q2.data?.id) {
    return { version: q2.data, mode: 'is_published', probes: { versionsHasStatus, versionsHasIsPublished } }
  }

  // Decide “mode” for diagnostics even when missing.
  const inferredMode: 'status' | 'is_published' =
    looksLikeMissingColumn(q1.error, 'status') ? 'is_published' : 'status'

  return {
    version: null,
    mode: inferredMode,
    probes: { versionsHasStatus, versionsHasIsPublished },
  }
}

export async function fetchAreaPricing(
  supabase: SupabaseClient,
  pricingVersionId: string,
  priceArea: PriceArea
): Promise<ContractAreaPricing | null> {
  const { data, error } = await tryQuery<ContractAreaPricing>(
    supabase
      .from('contract_area_pricing')
      .select('id,pricing_version_id,price_area,price_per_kwh_ore,markup_ore,monthly_fee_sek')
      .eq('pricing_version_id', pricingVersionId)
      .eq('price_area', priceArea)
      .maybeSingle()
  )
  if (error) return null
  return data
}

async function probeOptionalElcertSpot(
  supabase: SupabaseClient,
  where: { pricing_version_id?: string; contract_id?: string; price_area: PriceArea }
): Promise<{ elcert_ore: number | null; hasColumn: boolean }> {
  // If elcert_ore column doesn't exist, this query fails; we detect and treat as absent.
  const base = supabase.from('gridex_spot_area_settings').select('elcert_ore')

  const builder =
    where.pricing_version_id
      ? base.eq('pricing_version_id', where.pricing_version_id).eq('price_area', where.price_area)
      : base.eq('contract_id', String(where.contract_id)).eq('price_area', where.price_area)

  const q = await tryQuery<{ elcert_ore: number | null }>(builder.maybeSingle())
  if (q.error && looksLikeMissingColumn(q.error, 'elcert_ore')) return { elcert_ore: null, hasColumn: false }
  if (q.error) return { elcert_ore: null, hasColumn: true }
  return { elcert_ore: q.data?.elcert_ore ?? null, hasColumn: true }
}

export async function fetchSpotSettings(
  supabase: SupabaseClient,
  opts: { pricingVersionId: string; contractId: string; priceArea: PriceArea }
): Promise<{ settings: SpotAreaSettings | null; keyMode: 'pricing_version_id' | 'contract_id'; probes: { spotHasElcertOre: boolean } }> {

  // Try pricing_version_id linkage
  const q1 = await tryQuery<SpotAreaSettings>(
    supabase
      .from('gridex_spot_area_settings')
      .select('price_area,markup_ore,variable_fee_ore,monthly_fee_sek,pricing_version_id')
      .eq('pricing_version_id', opts.pricingVersionId)
      .eq('price_area', opts.priceArea)
      .maybeSingle()
  )

  if (!q1.error && q1.data) {
    const el = await probeOptionalElcertSpot(supabase, {
      pricing_version_id: opts.pricingVersionId,
      price_area: opts.priceArea,
    })
    return {
      settings: { ...q1.data, elcert_ore: el.elcert_ore },
      keyMode: 'pricing_version_id',
      probes: { spotHasElcertOre: el.hasColumn },
    }
  }

  // Fallback: contract_id linkage
  const q2 = await tryQuery<SpotAreaSettings>(
    supabase
      .from('gridex_spot_area_settings')
      .select('price_area,markup_ore,variable_fee_ore,monthly_fee_sek,contract_id')
      .eq('contract_id', opts.contractId)
      .eq('price_area', opts.priceArea)
      .maybeSingle()
  )

  if (!q2.error && q2.data) {
    const el = await probeOptionalElcertSpot(supabase, {
      contract_id: opts.contractId,
      price_area: opts.priceArea,
    })
    return {
      settings: { ...q2.data, elcert_ore: el.elcert_ore },
      keyMode: 'contract_id',
      probes: { spotHasElcertOre: el.hasColumn },
    }
  }

  const inferredKey: 'pricing_version_id' | 'contract_id' =
    looksLikeMissingColumn(q1.error, 'pricing_version_id') ? 'contract_id' : 'pricing_version_id'

  // We still want to know if elcert exists. Probe can be expensive; keep conservative:
  return { settings: null, keyMode: inferredKey, probes: { spotHasElcertOre: true } }
}

async function probeOptionalElcertPortfolio(
  supabase: SupabaseClient,
  where: { pricing_version_id?: string; contract_id?: string; price_area: PriceArea }
): Promise<{ elcert_ore: number | null; hasColumn: boolean }> {
  const base = supabase.from('gridex_portfolio_area_pricing').select('elcert_ore')

  const builder =
    where.pricing_version_id
      ? base.eq('pricing_version_id', where.pricing_version_id).eq('price_area', where.price_area)
      : base.eq('contract_id', String(where.contract_id)).eq('price_area', where.price_area)

  const q = await tryQuery<{ elcert_ore: number | null }>(builder.maybeSingle())
  if (q.error && looksLikeMissingColumn(q.error, 'elcert_ore')) return { elcert_ore: null, hasColumn: false }
  if (q.error) return { elcert_ore: null, hasColumn: true }
  return { elcert_ore: q.data?.elcert_ore ?? null, hasColumn: true }
}

export async function fetchPortfolioPricing(
  supabase: SupabaseClient,
  opts: { pricingVersionId: string; contractId: string; priceArea: PriceArea }
): Promise<{ row: PortfolioAreaPricing | null; keyMode: 'pricing_version_id' | 'contract_id'; probes: { portfolioHasElcertOre: boolean } }> {

  const q1 = await tryQuery<PortfolioAreaPricing>(
    supabase
      .from('gridex_portfolio_area_pricing')
      .select('price_area,fixed_price_ore,variable_fee_ore,monthly_fee_sek,pricing_version_id')
      .eq('pricing_version_id', opts.pricingVersionId)
      .eq('price_area', opts.priceArea)
      .maybeSingle()
  )

  if (!q1.error && q1.data) {
    const el = await probeOptionalElcertPortfolio(supabase, {
      pricing_version_id: opts.pricingVersionId,
      price_area: opts.priceArea,
    })
    return {
      row: { ...q1.data, elcert_ore: el.elcert_ore },
      keyMode: 'pricing_version_id',
      probes: { portfolioHasElcertOre: el.hasColumn },
    }
  }

  const q2 = await tryQuery<PortfolioAreaPricing>(
    supabase
      .from('gridex_portfolio_area_pricing')
      .select('price_area,fixed_price_ore,variable_fee_ore,monthly_fee_sek,contract_id')
      .eq('contract_id', opts.contractId)
      .eq('price_area', opts.priceArea)
      .maybeSingle()
  )

  if (!q2.error && q2.data) {
    const el = await probeOptionalElcertPortfolio(supabase, {
      contract_id: opts.contractId,
      price_area: opts.priceArea,
    })
    return {
      row: { ...q2.data, elcert_ore: el.elcert_ore },
      keyMode: 'contract_id',
      probes: { portfolioHasElcertOre: el.hasColumn },
    }
  }

  const inferredKey: 'pricing_version_id' | 'contract_id' =
    looksLikeMissingColumn(q1.error, 'pricing_version_id') ? 'contract_id' : 'pricing_version_id'

  return { row: null, keyMode: inferredKey, probes: { portfolioHasElcertOre: true } }
}

export async function fetchPrevMonthlySpotAvg(
  supabase: SupabaseClient,
  priceArea: PriceArea,
  now: Date
): Promise<{ year: number; month: number; avgSpotOre: number } | null> {
  const { year, month } = prevYearMonth(now)

  const { data, error } = await tryQuery<{ avg_spot_ore: number | null }>(
    supabase
      .from('gridex_monthly_spot_prices')
      .select('avg_spot_ore')
      .eq('price_area', priceArea)
      .eq('year', year)
      .eq('month', month)
      .maybeSingle()
  )

  if (error || !data) return null
  const avg = safeNumber(data.avg_spot_ore, NaN)
  if (!Number.isFinite(avg)) return null
  return { year, month, avgSpotOre: avg }
}