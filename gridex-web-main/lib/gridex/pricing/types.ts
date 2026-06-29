// lib/gridex/pricing/types.ts

import type { SupabaseClient } from '@supabase/supabase-js'

export type PriceArea = 'SE1' | 'SE2' | 'SE3' | 'SE4'
export type ContractType = 'spot_hourly' | 'portfolio_managed' | 'fixed'

export type PublishedPricingVersion = {
  id: string
  contract_id: string
  version_number: number | null
  valid_from: string
  /**
   * Enterprise: authoritative status when available.
   * Expected values: 'draft' | 'published'
   */
  status?: string | null
  /**
   * Backward compat: kept for older schema + existing code paths.
   * When status exists, DB trigger keeps these in sync.
   */
  is_published?: boolean | null
}

export type ContractProduct = {
  id: string
  name: string
  slug: string
  contract_type: ContractType
  is_active: boolean | null
}

export type ContractAreaPricing = {
  id: string
  pricing_version_id: string
  price_area: PriceArea
  // fixed/portfolio
  price_per_kwh_ore: number | null
  // spot
  markup_ore: number | null

  // shared
  variable_fee_ore: number | null
  elcert_ore: number | null
  monthly_fee_sek: number | null
}

/**
 * ✅ Extended (not removed): pricing_version_id / contract_id may be null depending on schema / joins.
 */
export type SpotAreaSettings = {
  pricing_version_id?: string | null
  contract_id?: string | null
  price_area: PriceArea
  markup_ore: number | null
  variable_fee_ore: number | null
  monthly_fee_sek: number | null
  elcert_ore?: number | null
}

/**
 * ✅ Extended (not removed): pricing_version_id / contract_id may be null depending on schema / joins.
 */
export type PortfolioAreaPricing = {
  pricing_version_id?: string | null
  contract_id?: string | null
  price_area: PriceArea
  fixed_price_ore: number | null
  variable_fee_ore: number | null
  monthly_fee_sek: number | null
  elcert_ore?: number | null
}

export type MoneySpecLine = {
  key: string
  label: string
  orePerKwh?: number
  sekPerMonth?: number
  note?: string
}

export type PricingDiagnostics = {
  vatRate: number
  spotBasis?: {
    year: number
    month: number
    avgSpotOre: number
    source?:
      | 'gridex_monthly_spot_prices'
      | 'gridex_spot_monthly_avg'
      | 'elprisetjustnu_api'
  }
  sources: {
    versionSelection: 'status' | 'is_published'
    spotSettingsKey: 'pricing_version_id' | 'contract_id'
    portfolioKey: 'pricing_version_id' | 'contract_id'
  }
  schemaProbes: {
    spotHasElcertOre: boolean
    portfolioHasElcertOre: boolean
    versionsHasStatus: boolean
    versionsHasIsPublished: boolean
  }
}

export type CustomerSpecResult = {
  contract: ContractProduct
  priceArea: PriceArea
  kwh: number
  pricingVersion: PublishedPricingVersion
  totalOrePerKwh: number
  totalMonthlyCostSek: number
  totalMonthlyCostInclVatSek: number
  energySubtotalSek: number
  lines: MoneySpecLine[]
  diagnostics: PricingDiagnostics
}

export type EngineContext = {
  supabase: SupabaseClient
  now?: Date
  vatRate?: number
}