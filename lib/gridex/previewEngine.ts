// lib/gridex/previewEngine.ts
// Backward-compatible façade over pricing domain layer.
// Never remove functionality – only extend.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ContractProduct, CustomerSpecResult, PriceArea } from './pricing/types'
import { computeCustomerSpecDomain } from './pricing/engine'
import type { PricingVersionSelection } from './pricing/versioning'

export type {
  PriceArea,
  ContractType,
  PublishedPricingVersion,
  ContractProduct,
  ContractAreaPricing,
  SpotAreaSettings,
  PortfolioAreaPricing,
  MoneySpecLine,
  CustomerSpecResult,
} from './pricing/types'

export type { PricingVersionSelection } from './pricing/versioning'

/**
 * computeCustomerSpec
 * Facade used by UI + API routes.
 * Backward compatible: keep signature stable, only extend via optional params.
 */
export async function computeCustomerSpec(params: {
  supabase: SupabaseClient
  contract: ContractProduct
  priceArea: PriceArea
  kwh: number
  now?: Date
  vatRate?: number
  // NEW: Engine versioning
  selection?: PricingVersionSelection
}): Promise<CustomerSpecResult> {
  const { spec } = await computeCustomerSpecDomain({
    ctx: {
      supabase: params.supabase,
      now: params.now,
      vatRate: params.vatRate,
    },
    contract: params.contract,
    priceArea: params.priceArea,
    kwh: params.kwh,
    selection: params.selection,
  })

  return spec
}