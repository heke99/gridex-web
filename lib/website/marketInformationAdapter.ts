import type { SupabaseClient } from '@supabase/supabase-js'
import type { PriceArea } from '@/lib/gridex/pricing/types'
import { getLivePriceSummary, type LivePriceSummary } from '@/lib/gridex/livePrices'
import { fetchMonthlySpotAverageFromElprisetJustNu } from '@/lib/gridex/pricing/elprisetjustnu'

/**
 * Informational-only adapter for generic SE1–SE4 and historical pages.
 * It must never be imported by checkout, quote, customer application or invoice code.
 */
export const GENERIC_MARKET_INFORMATION_NOTICE =
  'Ej en personlig offert. Exklusive Gridex avtalsavgifter, moms, skatter och elnätsavgifter. Kan inte användas som avtals- eller faktureringspris.'

export async function getGenericCurrentMarketInformation(input: {
  supabase: SupabaseClient
  area: PriceArea
  date?: string | null
}): Promise<LivePriceSummary> {
  const result = await getLivePriceSummary(input)
  return { ...result, disclaimer: GENERIC_MARKET_INFORMATION_NOTICE }
}

export async function getGenericMonthlyMarketInformation(input: {
  year: number
  month: number
  priceArea: PriceArea
}) {
  return fetchMonthlySpotAverageFromElprisetJustNu(input)
}
