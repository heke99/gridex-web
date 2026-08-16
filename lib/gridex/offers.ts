import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ContractType,
  CustomerSpecResult,
  PriceArea,
} from '@/lib/gridex/pricing/types'

export type OfferCalculation = {
  contract: {
    id: string
    slug: string
    name: string
    contractType: ContractType
  }
  pricingVersionId: string
  priceArea: PriceArea
  postalCode: string | null
  kwh: number
  pricePerKwhOre: number
  totalMonthlyCostSek: number
  totalMonthlyCostInclVatSek: number
  totalYearlyCostSek: number
  specification: {
    basis:
      | {
          type: 'previous_month_avg_spot'
          year: number
          month: number
          spotAvgOre: number
          source?:
            | 'gridex_monthly_spot_prices'
            | 'gridex_spot_monthly_avg'
            | 'elprisetjustnu_api'
        }
      | {
          type: 'fixed_price'
          fixedPriceOre: number
        }
    fees: {
      markupOre?: number
      variableFeeOre: number
      elcertOre: number
      monthlyFeeSek: number
    }
    lines: CustomerSpecResult['lines']
  }
  legalText: string
  customerNotice: string
  snapshot: Record<string, unknown>
}

/**
 * Fail-closed compatibility boundary for the retired local commercial pricing
 * engine. Customer-facing offers, quotes and price snapshots must come from
 * the canonical Gridex Ops API so the website can never create a second
 * commercial source of truth.
 *
 * This export remains temporarily so dormant legacy signup code cannot silently
 * regain local pricing. Any attempted call is rejected before customer/order
 * data is written.
 */
export async function calculateCustomerOffer(_params: {
  supabase: SupabaseClient
  contractSlug: string
  postalCode?: string | null
  manualPriceArea?: PriceArea | null
  kwh: number
}): Promise<OfferCalculation> {
  throw Object.assign(
    new Error(
      'Legacy local avtalsprissättning är avstängd. Använd canonical Gridex Ops quote/application-flöde.'
    ),
    {
      status: 410,
      code: 'LEGACY_COMMERCIAL_PRICING_DISABLED',
    }
  )
}
