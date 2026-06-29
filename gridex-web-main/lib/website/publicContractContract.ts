export type PublicContractApiShape = {
  id?: string | null
  offer_reference: string
  product_code: string | null
  name: string
  type: string
  customer_types: string[] | null
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
  privacy_policy_version: string | null
  withdrawal_version: string | null
  power_of_attorney_required: boolean | null
  power_of_attorney_version: string | null
  price_terms_version: string | null
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

/**
 * Normalizes the documented public-contract DTO. It intentionally does not
 * require, expose or derive OPS-internal price-plan identifiers.
 */
export function normalizePublicContractApiPayload(value: unknown): PublicContractApiShape | null {
  const row = record(value)
  if (!row) return null

  const pricing = record(row.pricing) ?? {}
  const legal = record(row.legal) ?? {}
  const offerReference = text(row.offer_reference ?? row.offerReference ?? row.id)
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
    customer_types: typeList(row.customer_type ?? row.customerType ?? row.customer_types ?? row.customerTypes),
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
    spot_share: number(pricing.spot_share ?? pricing.spotShare ?? row.spot_share),
    portfolio_share: number(pricing.portfolio_share ?? pricing.portfolioShare ?? row.portfolio_share),
    valid_from: text(row.valid_from ?? row.validFrom),
    valid_to: text(row.valid_to ?? row.validTo),
    terms_version: text(legal.terms_version ?? legal.termsVersion ?? row.terms_version),
    privacy_policy_version: text(legal.privacy_policy_version ?? legal.privacyPolicyVersion ?? row.privacy_policy_version),
    withdrawal_version: text(
      legal.withdrawal_version ?? legal.withdrawalVersion ?? legal.cancellation_right_version ?? row.withdrawal_version,
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
    price_terms_version: text(legal.price_terms_version ?? legal.priceTermsVersion ?? row.price_terms_version),
  }
}
