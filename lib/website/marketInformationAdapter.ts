import { createHash } from 'node:crypto'
import { unstable_cache } from 'next/cache.js'
import type { PriceArea } from '@/lib/gridex/pricing/types'
import { getLivePriceSummary, type LivePriceSummary } from '@/lib/gridex/livePrices'
import { fetchMonthlySpotAverageFromElprisetJustNu } from '@/lib/gridex/pricing/elprisetjustnu'

/**
 * Informational-only adapter for generic SE1–SE4 and historical pages.
 * It must never be imported by checkout, quote, customer application or invoice code.
 */
export const GENERIC_MARKET_INFORMATION_NOTICE =
  'Exklusive Gridex avtalsavgifter, moms, skatter och elnätsavgifter. Kan inte användas som avtals- eller faktureringspris.'

export async function getGenericCurrentMarketInformation(input: {
  area: PriceArea
  date?: string | null
}): Promise<LivePriceSummary> {
  const result = await getLivePriceSummary(input)
  return { ...result, disclaimer: GENERIC_MARKET_INFORMATION_NOTICE }
}

class MonthlyMarketInformationNotPublished extends Error {}

const sourceCacheKey = createHash('sha256')
  .update(process.env.SPOT_PRICE_API_URL_TEMPLATE ?? 'elprisetjustnu-default')
  .digest('hex')

const readPublishedMonthlyMarketInformation = unstable_cache(
  async (year: number, month: number, priceArea: PriceArea) => {
    const result = await fetchMonthlySpotAverageFromElprisetJustNu({ year, month, priceArea })
    if (!result) throw new MonthlyMarketInformationNotPublished()
    return result
  },
  ['public-monthly-spot-average-v1', sourceCacheKey],
  { revalidate: 15 * 60 },
)

export async function getGenericMonthlyMarketInformation(input: {
  year: number
  month: number
  priceArea: PriceArea
}) {
  try {
    return await readPublishedMonthlyMarketInformation(input.year, input.month, input.priceArea)
  } catch (error) {
    // A month with no publication has no reusable representation.
    if (error instanceof MonthlyMarketInformationNotPublished) return null
    throw error
  }
}
