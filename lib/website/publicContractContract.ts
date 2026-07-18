export type PublicContractApiShape = {
  id?: string | null
  offer_reference: string
  product_code: string | null
  name: string
  type: string
  customer_types: string[] | null
  pricing_visibility: Record<string, boolean>
  pricing_components: PublicPricingComponent[]
  portfolio_monthly_prices: PublicPortfolioMonthlyPrice[]
  monthly_fee_sek: number | null
  invoice_fee_sek: number | null
  markup_ore_per_kwh: number | null
  variable_markup_ore_per_kwh: number | null
  fixed_price_ore_per_kwh: number | null
  monthly_fixed_price_sek: number | null
  elcert_ore_per_kwh: number | null
  portfolio_price_ore_per_kwh: number | null
  vat_rate: number | null
  pricing_model: string | null
  spot_share: number | null
  portfolio_share: number | null
  valid_from: string | null
  valid_to: string | null
  terms_version: string | null
  terms_version_id: string | null
  terms_url: string | null
  privacy_policy_version: string | null
  privacy_policy_version_id: string | null
  privacy_policy_url: string | null
  withdrawal_version: string | null
  withdrawal_version_id: string | null
  withdrawal_url: string | null
  power_of_attorney_required: boolean | null
  power_of_attorney_version: string | null
  power_of_attorney_version_id: string | null
  power_of_attorney_url: string | null
  price_terms_version: string | null
  price_terms_version_id: string | null
  price_terms_url: string | null
}

export type PublicPricingComponent = {
  component_code: string
  name: string
  amount: number
  unit: string
  website_card_visible: boolean
  calculation_base: string | null
}

export type PublicPortfolioMonthlyPrice = {
  year: number
  month: number
  price_area_code: string
  price_plan_version_id: string | null
  amount: number
  unit: string
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function number(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(typeof value === 'string' ? value.replace(',', '.') : value)
  return Number.isFinite(parsed) ? parsed : null
}

function boolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (value === 'true' || value === 1 || value === '1') return true
  if (value === 'false' || value === 0 || value === '0') return false
  return null
}

function amount(value: unknown): number | null {
  const row = record(value)
  return number(row?.amount ?? value)
}

function typeList(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    const values = value.map(text).filter((item): item is string => Boolean(item))
    return values.length ? values : null
  }

  const single = text(value)
  return single ? [single] : null
}

function normalizedCustomerTypes(row: Record<string, unknown>): string[] | null {
  const canonical = typeList(row.customer_types ?? row.customerTypes)
  if (canonical?.length) return canonical

  const singular = text(row.customer_type ?? row.customerType)?.toLowerCase()
  if (singular === 'both') return ['private', 'business']
  return singular ? [singular] : null
}

function normalizedShare(value: unknown): number | null {
  const parsed = number(value)
  if (parsed === null) return null
  return parsed > 1 ? parsed / 100 : parsed
}

function pricingVisibility(value: unknown): Record<string, boolean> {
  const row = record(value)
  if (!row) return {}
  return Object.fromEntries(
    Object.entries(row).flatMap(([key, raw]) => {
      const visible = boolean(raw)
      return visible === null ? [] : [[key, visible]]
    }),
  )
}

function pricingComponents(value: unknown): PublicPricingComponent[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const row = record(item)
    if (!row) return []
    const componentCode = text(row.component_code ?? row.componentCode ?? row.code)
    const componentName = text(row.name ?? row.label ?? componentCode)
    const componentAmount = amount(row.amount ?? row.value)
    const unit = text(row.unit)
    if (!componentCode || !componentName || componentAmount === null || !unit) return []
    return [{
      component_code: componentCode,
      name: componentName,
      amount: componentAmount,
      unit,
      website_card_visible: boolean(row.website_card_visible ?? row.websiteCardVisible) ?? true,
      calculation_base: text(row.calculation_base ?? row.calculationBase),
    }]
  })
}

function portfolioMonthlyPrices(value: unknown): PublicPortfolioMonthlyPrice[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const row = record(item)
    if (!row) return []
    const year = number(row.year)
    const month = number(row.month)
    const priceAreaCode = text(row.price_area_code ?? row.priceAreaCode ?? row.price_area)
    const price = amount(row.price ?? row.amount ?? row.portfolio_price)
    const unit = text(record(row.price)?.unit ?? row.unit) ?? 'ore_per_kwh'
    if (
      year === null ||
      month === null ||
      month < 1 ||
      month > 12 ||
      !priceAreaCode ||
      price === null
    ) return []
    return [{
      year,
      month,
      price_area_code: priceAreaCode.toUpperCase(),
      price_plan_version_id: text(row.price_plan_version_id ?? row.pricePlanVersionId),
      amount: price,
      unit,
    }]
  })
}

/**
 * Normalizes the documented public-contract DTO. It intentionally does not
 * require, expose or derive OPS-internal price-plan identifiers.
 */
export function normalizePublicContractApiPayload(value: unknown): PublicContractApiShape | null {
  const row = record(value)
  if (!row) return null

  const pricing = record(row.pricing) ?? {}
  const legal = record(row.legal) ?? {}
  const offerReference = text(row.offer_reference ?? row.offerReference)
  const productCode = text(row.code ?? row.product_code ?? row.productCode)
  const name = text(row.name)
  const type = text(row.type)

  if (!offerReference || !name || !type) return null

  return {
    id: text(row.id),
    offer_reference: offerReference,
    product_code: productCode,
    name,
    type,
    customer_types: normalizedCustomerTypes(row),
    pricing_visibility: pricingVisibility(pricing.visibility),
    pricing_components: pricingComponents(pricing.components),
    portfolio_monthly_prices: portfolioMonthlyPrices(
      pricing.portfolio_monthly_prices ?? pricing.portfolioMonthlyPrices,
    ),
    monthly_fee_sek: amount(pricing.monthly_fee ?? pricing.monthlyFee ?? row.monthly_fee_sek),
    invoice_fee_sek: amount(pricing.invoice_fee ?? pricing.invoiceFee ?? row.invoice_fee_sek),
    markup_ore_per_kwh: amount(pricing.markup ?? pricing.markup_ore_per_kwh ?? row.markup_ore_per_kwh),
    variable_markup_ore_per_kwh: amount(
      pricing.variable_markup ?? pricing.variable_fee ?? pricing.variable_markup_ore_per_kwh ?? row.variable_markup_ore_per_kwh,
    ),
    fixed_price_ore_per_kwh: amount(pricing.fixed_price ?? pricing.fixed_price_ore_per_kwh ?? row.fixed_price_ore_per_kwh),
    monthly_fixed_price_sek: amount(
      pricing.monthly_fixed_price ??
        pricing.monthlyFixedPrice ??
        pricing.monthly_price ??
        pricing.monthlyPrice ??
        row.monthly_fixed_price_sek ??
        row.monthlyFixedPriceSek ??
        row.monthly_price_sek,
    ),
    elcert_ore_per_kwh: amount(pricing.elcert ?? pricing.elcert_ore_per_kwh ?? row.elcert_ore_per_kwh),
    portfolio_price_ore_per_kwh: amount(
      pricing.portfolio_price ??
        pricing.portfolioPrice ??
        pricing.portfolio_price_ore_per_kwh ??
        row.portfolio_price_ore_per_kwh,
    ),
    vat_rate: number(pricing.vat_rate ?? pricing.vatRate ?? row.vat_rate ?? row.vatRate),
    pricing_model: text(pricing.pricing_model ?? pricing.pricingModel ?? row.pricing_model ?? row.pricingModel),
    spot_share: normalizedShare(pricing.spot_share ?? pricing.spotShare ?? row.spot_share),
    portfolio_share: normalizedShare(pricing.portfolio_share ?? pricing.portfolioShare ?? row.portfolio_share),
    valid_from: text(row.valid_from ?? row.validFrom),
    valid_to: text(row.valid_to ?? row.validTo),
    terms_version: text(legal.terms_version ?? legal.termsVersion ?? row.terms_version),
    terms_version_id: text(legal.terms_version_id ?? legal.termsVersionId ?? row.terms_version_id ?? row.termsVersionId),
    terms_url: text(legal.terms_url ?? legal.termsUrl ?? row.terms_url ?? row.termsUrl),
    privacy_policy_version: text(legal.privacy_policy_version ?? legal.privacyPolicyVersion ?? row.privacy_policy_version),
    privacy_policy_version_id: text(
      legal.privacy_policy_version_id ??
        legal.privacyPolicyVersionId ??
        row.privacy_policy_version_id ??
        row.privacyPolicyVersionId,
    ),
    privacy_policy_url: text(
      legal.privacy_policy_url ?? legal.privacyPolicyUrl ?? row.privacy_policy_url ?? row.privacyPolicyUrl,
    ),
    withdrawal_version: text(
      legal.withdrawal_version ?? legal.withdrawalVersion ?? legal.cancellation_right_version ?? row.withdrawal_version,
    ),
    withdrawal_version_id: text(
      legal.withdrawal_version_id ??
        legal.withdrawalVersionId ??
        legal.cancellation_right_version_id ??
        legal.cancellationRightVersionId ??
        row.withdrawal_version_id ??
        row.withdrawalVersionId ??
        row.cancellation_right_version_id ??
        row.cancellationRightVersionId,
    ),
    withdrawal_url: text(
      legal.withdrawal_url ??
        legal.withdrawalUrl ??
        legal.cancellation_right_url ??
        legal.cancellationRightUrl ??
        row.withdrawal_url ??
        row.withdrawalUrl ??
        row.cancellation_right_url ??
        row.cancellationRightUrl,
    ),
    power_of_attorney_required: boolean(
      legal.power_of_attorney_required ?? legal.powerOfAttorneyRequired ?? row.power_of_attorney_required,
    ),
    power_of_attorney_version: text(
      legal.power_of_attorney_version ??
        legal.powerOfAttorneyVersion ??
        legal.power_of_attorney_text_version ??
        legal.powerOfAttorneyTextVersion ??
        legal.power_of_attorney_legal_text_version ??
        legal.powerOfAttorneyLegalTextVersion ??
        legal.poa_version ??
        legal.poaVersion ??
        row.power_of_attorney_version ??
        row.powerOfAttorneyVersion ??
        row.power_of_attorney_text_version ??
        row.powerOfAttorneyTextVersion ??
        row.power_of_attorney_legal_text_version ??
        row.powerOfAttorneyLegalTextVersion ??
        row.poa_version ??
        row.poaVersion,
    ),
    power_of_attorney_version_id: text(
      legal.power_of_attorney_version_id ??
        legal.powerOfAttorneyVersionId ??
        legal.power_of_attorney_text_version_id ??
        legal.powerOfAttorneyTextVersionId ??
        legal.power_of_attorney_legal_text_version_id ??
        legal.powerOfAttorneyLegalTextVersionId ??
        legal.poa_version_id ??
        legal.poaVersionId ??
        row.power_of_attorney_version_id ??
        row.powerOfAttorneyVersionId ??
        row.power_of_attorney_text_version_id ??
        row.powerOfAttorneyTextVersionId ??
        row.power_of_attorney_legal_text_version_id ??
        row.powerOfAttorneyLegalTextVersionId ??
        row.poa_version_id ??
        row.poaVersionId,
    ),
    power_of_attorney_url: text(
      legal.power_of_attorney_url ??
        legal.powerOfAttorneyUrl ??
        legal.power_of_attorney_text_url ??
        legal.powerOfAttorneyTextUrl ??
        legal.poa_url ??
        legal.poaUrl ??
        row.power_of_attorney_url ??
        row.powerOfAttorneyUrl ??
        row.power_of_attorney_text_url ??
        row.powerOfAttorneyTextUrl ??
        row.poa_url ??
        row.poaUrl,
    ),
    price_terms_version: text(legal.price_terms_version ?? legal.priceTermsVersion ?? row.price_terms_version),
    price_terms_version_id: text(
      legal.price_terms_version_id ?? legal.priceTermsVersionId ?? row.price_terms_version_id ?? row.priceTermsVersionId,
    ),
    price_terms_url: text(legal.price_terms_url ?? legal.priceTermsUrl ?? row.price_terms_url ?? row.priceTermsUrl),
  }
}
