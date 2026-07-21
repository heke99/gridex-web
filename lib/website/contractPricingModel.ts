export type WebsitePricingModel =
  | 'monthly_fixed'
  | 'spot_monthly'
  | 'spot_hourly'
  | 'spot_quarterly'
  | 'fixed_kwh_price'
  | 'portfolio'
  | 'mix'

export type PublicContractPricingDescriptor = {
  type?: string | null
  pricing_model?: string | null
  product_code?: string | null
  name?: string | null
  fixed_price_ore_per_kwh?: number | null
  monthly_fixed_price_sek?: number | null
  raw?: Record<string, unknown>
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(typeof value === 'string' ? value.trim().replace(',', '.') : value)
  return Number.isFinite(parsed) ? parsed : null
}

function pricingIntervalMinutes(contract: PublicContractPricingDescriptor): number | null {
  const raw = record(contract.raw)
  const pricing = record(raw?.pricing) ?? record(raw?.price) ?? record(raw?.specification)
  const sources = [pricing, raw].filter((value): value is Record<string, unknown> => Boolean(value))
  const keys = [
    'pricing_interval_minutes',
    'pricingIntervalMinutes',
    'price_interval_minutes',
    'priceIntervalMinutes',
    'market_price_interval_minutes',
    'marketPriceIntervalMinutes',
    'settlement_price_interval_minutes',
    'settlementPriceIntervalMinutes',
    'settlement_interval_minutes',
    'settlementIntervalMinutes',
    'price_resolution_minutes',
    'priceResolutionMinutes',
    'granularity_minutes',
    'granularityMinutes',
  ]

  for (const source of sources) {
    for (const key of keys) {
      const value = finiteNumber(source[key])
      if (value !== null && value > 0 && value <= 1440) return value
    }
  }
  return null
}

function normalizedContractDescriptor(contract: PublicContractPricingDescriptor): string {
  const raw = record(contract.raw)
  const pricing = record(raw?.pricing) ?? record(raw?.price) ?? record(raw?.specification)
  return [
    contract.type,
    contract.pricing_model,
    contract.product_code,
    contract.name,
    contract.raw?.contract_type,
    contract.raw?.contractType,
    contract.raw?.pricing_model,
    contract.raw?.pricingModel,
    raw?.billing_model,
    raw?.billingModel,
    raw?.settlement_model,
    raw?.settlementModel,
    raw?.pricing_frequency,
    raw?.pricingFrequency,
    raw?.price_resolution,
    raw?.priceResolution,
    pricing?.type,
    pricing?.model,
    pricing?.pricing_model,
    pricing?.pricingModel,
    pricing?.frequency,
    pricing?.resolution,
  ]
    .filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
    .join(' ')
    .trim()
    .toLocaleLowerCase('sv-SE')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function resolveWebsitePricingModel(
  contract: PublicContractPricingDescriptor,
): WebsitePricingModel {
  const descriptor = normalizedContractDescriptor(contract)
  const intervalMinutes = pricingIntervalMinutes(contract)
  if (
    contract.monthly_fixed_price_sek !== null &&
    contract.monthly_fixed_price_sek !== undefined
  ) {
    return 'monthly_fixed'
  }
  if (/monthly_fixed|fixed_monthly|fixed monthly|fast manadspris/.test(descriptor)) {
    return 'monthly_fixed'
  }
  if (
    /spot_quarter|quarter_hour|quarterly|quarterly_spot|variable_quarter|15[ _-]?(minute|min)|kvartspris|kvart/.test(
      descriptor,
    )
  ) {
    return 'spot_quarterly'
  }
  if (/spot_hourly|hourly_spot|variable_hourly|hourly|timpris|timspot|per timme/.test(descriptor)) {
    return 'spot_hourly'
  }
  if (
    contract.type === 'fixed' ||
    /fixed_kwh|fastpris|fast elpris/.test(descriptor) ||
    contract.fixed_price_ore_per_kwh !== null &&
      contract.fixed_price_ore_per_kwh !== undefined
  ) {
    return 'fixed_kwh_price'
  }
  if (contract.type === 'mix' || contract.type === 'mixed' || /mixavtal|mixed/.test(descriptor)) {
    return 'mix'
  }
  if (
    contract.type === 'portfolio' ||
    contract.type === 'portfolio_managed' ||
    /portfolj/.test(descriptor)
  ) {
    return 'portfolio'
  }
  if (
    /variable_monthly|spot_monthly|monthly_spot|month_average|monthly_average|rorligt manadspris|manadspris/.test(
      descriptor,
    )
  ) {
    return 'spot_monthly'
  }
  if (intervalMinutes !== null && intervalMinutes <= 15) return 'spot_quarterly'
  if (intervalMinutes !== null && intervalMinutes <= 60) return 'spot_hourly'
  return 'spot_monthly'
}

export function usesElprisetJustNu(model: WebsitePricingModel): boolean {
  return model === 'spot_monthly' || model === 'spot_hourly' || model === 'spot_quarterly'
}

export function usesDirectPublishedPricing(model: WebsitePricingModel): boolean {
  return usesElprisetJustNu(model) || model === 'fixed_kwh_price' || model === 'monthly_fixed'
}
