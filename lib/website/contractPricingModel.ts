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

function normalizedContractDescriptor(contract: PublicContractPricingDescriptor): string {
  return [
    contract.type,
    contract.pricing_model,
    contract.product_code,
    contract.name,
    contract.raw?.contract_type,
    contract.raw?.contractType,
    contract.raw?.pricing_model,
    contract.raw?.pricingModel,
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
    /spot_quarter|quarter_hour|quarterly|15[ _-]?(minute|min)|kvartspris|kvart/.test(
      descriptor,
    )
  ) {
    return 'spot_quarterly'
  }
  if (/spot_hourly|hourly_spot|hourly|timpris|timspot|per timme/.test(descriptor)) {
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
  return 'spot_monthly'
}

export function usesElprisetJustNu(model: WebsitePricingModel): boolean {
  return model === 'spot_monthly' || model === 'spot_hourly' || model === 'spot_quarterly'
}

export function usesDirectPublishedPricing(model: WebsitePricingModel): boolean {
  return usesElprisetJustNu(model) || model === 'fixed_kwh_price' || model === 'monthly_fixed'
}
