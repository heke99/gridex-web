import type { components as WebsiteApiComponents } from '@/lib/ops/generated/website-api'
import {
  contractIssue,
  isBlockingContractIssue,
  requiresPublishedAreaPrices,
  type ContractIssueSeverity,
  type ContractValidationIssue,
} from '@/lib/website/publicContractPolicy'

export type WebsiteVisibility = 'visible' | 'summary_only' | 'hidden'

export type PublicEnergyDirection = 'consumption' | 'production'

export type PublicProductionPricing = {
  enabled: true
  compensation_model: 'fixed_compensation'
  resolution: 'monthly' | 'hourly' | 'quarterly'
  deduction_ore_per_kwh: number | null
  premium_ore_per_kwh: number | null
  fixed_compensation_ore_per_kwh: number | null
  compensation_ore_per_kwh: number | null
  compensation_sek_per_kwh: number | null
  settlement_mode: 'credit_invoice' | 'self_billing'
  billing_direction: 'credit_invoice' | 'self_billing'
  vat_rate: number | null
  vat_rate_percent: number | null
  vat_treatment: string | null
  metering_point_role: 'production'
}

export type PublicContractAreaPrice = {
  area_price_reference: string
  price_area: 'SE1' | 'SE2' | 'SE3' | 'SE4'
  energy_price_ore_per_kwh: number
  unit: 'ore_per_kwh'
  valid_from: string | null
  valid_to: string | null
}

/** @deprecated Presentation-only compatibility projection. Canonical commercial selection uses PublicContractAreaPrice. */
export type PublicAreaPricing = {
  price_area_code: 'SE1' | 'SE2' | 'SE3' | 'SE4'
  fixed_price_ore_per_kwh: number
  vat_included: boolean | null
  vat_rate: number | null
}


export type PublicLegalRequirement = {
  requirement_code: string
  acceptance_type: string
  required: boolean
  label: string
  document_reference: string | null
  document_version: string | null
  document_hash: string | null
  public_url: string | null
}

export type PublicContractPriceOptionCustomerType = 'private' | 'business' | 'both'
export type PublicContractPriceOptionType =
  | 'fixed'
  | 'variable_monthly'
  | 'variable_hourly'
  | 'variable_quarterly'
  | 'portfolio'
  | 'mixed'

type GeneratedContractPriceOption = WebsiteApiComponents['schemas']['ContractPriceOption']

/**
 * Runtime-normalized price option. It is derived from the generated OpenAPI
 * DTO while keeping the documented default/is_default transition compatible.
 */
export type PublicContractPriceOption = Omit<
  GeneratedContractPriceOption,
  | 'option_code'
  | 'customer_name'
  | 'price_type'
  | 'contract_type'
  | 'customer_type'
  | 'resolution'
  | 'currency'
  | 'unit'
  | 'fixed_price'
  | 'markup'
  | 'monthly_fee'
  | 'is_default'
  | 'binding_months'
  | 'notice_months'
  | 'auto_renew_enabled'
  | 'renewal_term_months'
  | 'default'
  | 'selection_required'
  | 'valid_from'
  | 'valid_to'
  | 'earliest_start_date'
  | 'latest_start_date'
  | 'area_prices'
> & {
  price_option_reference: string
  option_code: string | null
  customer_name: string | null
  price_type: PublicContractPriceOptionType
  contract_type: PublicContractPriceOptionType
  customer_type: PublicContractPriceOptionCustomerType
  resolution: 'monthly' | 'hourly' | 'quarterly' | null
  currency: string | null
  unit: string | null
  fixed_price: number | null
  markup: number | null
  monthly_fee: number | null
  binding_months: number | null
  notice_months: number | null
  auto_renew_enabled: boolean | null
  renewal_term_months: number | null
  is_default: boolean
  /** @deprecated Compatibility alias. Use is_default internally. */
  default: boolean
  selection_required: boolean
  valid_from: string | null
  valid_to: string | null
  earliest_start_date: string | null
  latest_start_date: string | null
  area_prices: PublicContractAreaPrice[]
}

export type PublicContractLegalModuleVersion = {
  id: string
  legal_bundle_version_id: string | null
  document_reference: string
  module_key: string
  version: string
  title: string
  published_at: string | null
  content_sha256: string | null
  origin: string | null
  url: string | null
}

export type PublicContractLegal = {
  legal_bundle_reference: string | null
  legal_bundle_version_id: string | null
  immutable: boolean
  module_versions: PublicContractLegalModuleVersion[]
}

export type PublicContractApiShape = {
  offer_reference: string
  product_code: string | null
  name: string
  contract_type: 'fixed' | 'variable_monthly' | 'variable_hourly' | 'variable_quarterly' | 'portfolio' | 'mixed'
  type: 'fixed' | 'variable_monthly' | 'variable_hourly' | 'variable_quarterly' | 'portfolio' | 'mixed'
  energy_direction: PublicEnergyDirection
  channel: 'website'
  customer_type: PublicContractPriceOptionCustomerType
  production_pricing: PublicProductionPricing | null
  customer_types: string[] | null
  price_areas: Array<'SE1' | 'SE2' | 'SE3' | 'SE4'>
  area_pricing: PublicAreaPricing[]
  pricing_visibility: Record<string, boolean>
  pricing_components: PublicPricingComponent[]
  calculation_components: PublicPricingComponent[]
  display_components: PublicPricingComponent[]
  summary_components: PublicPricingComponent[]
  price_options: PublicContractPriceOption[]
  legal_requirements: PublicLegalRequirement[]
  legal: PublicContractLegal
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
  binding_months: number | null
  notice_months: number | null
  automatic_renewal: boolean | null
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
  component_reference: string | null
  selection_policy: 'mandatory' | 'customer_optional' | 'admin_optional' | 'conditional' | null
  lifecycle:
    | 'recurring'
    | 'per_invoice'
    | 'per_site'
    | 'once_per_contract'
    | 'once_per_site'
    | 'annual'
    | 'consumption_based'
    | 'event_only'
    | null
  name: string
  amount: number
  currency: string | null
  unit: string
  calculation_inclusion: 'included' | 'excluded'
  website_visibility: WebsiteVisibility
  /** Compatibility projection. Never use this to represent summary_only. */
  website_card_visible: boolean
  calculation_base: string | null
  vat_included: boolean | null
  vat_rate: number | null
  billing_interval_months?: number | null
  invoices_per_year?: number | null
}

export type CanonicalPublishedPricingKey =
  | 'monthly_fee_sek'
  | 'invoice_fee_sek'
  | 'markup_ore_per_kwh'
  | 'variable_markup_ore_per_kwh'
  | 'elcert_ore_per_kwh'
  | 'fixed_price_ore_per_kwh'
  | 'monthly_fixed_price_sek'
  | 'portfolio_price_ore_per_kwh'
  | 'spot_share'
  | 'portfolio_share'
  | 'vat_rate'

function normalizedComponentToken(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function componentSearchText(component: PublicPricingComponent): string {
  return normalizedComponentToken(
    [component.component_code, component.name, component.unit, component.calculation_base]
      .filter(Boolean)
      .join(' '),
  )
}

function componentUnitKind(unitValue: unknown): 'invoice' | 'month' | 'energy' | 'percent' | 'other' {
  const rawUnit = String(unitValue ?? '').trim().toLowerCase()
  const unit = normalizedComponentToken(unitValue)
  if (/invoice|faktur|billing|bill|avi/.test(unit)) return 'invoice'
  if (/month|monthly|manad|manadsvis/.test(unit)) return 'month'
  if (/kwh|mwh|energy/.test(unit)) return 'energy'
  if (rawUnit.includes('%') || /percent|percentage|procent|pct/.test(unit)) return 'percent'
  return 'other'
}

const EXACT_COMPONENT_CODES: Record<CanonicalPublishedPricingKey, Set<string>> = {
  monthly_fee_sek: new Set([
    'monthly_fee',
    'monthlyfee',
    'manadsavgift',
    'subscription_fee',
    'subscription',
    'abonnemangsavgift',
    'base_fee',
    'fixed_fee',
    'administration_fee_monthly',
  ]),
  invoice_fee_sek: new Set([
    'invoice_fee',
    'invoicefee',
    'fakturaavgift',
    'faktureringsavgift',
    'billing_fee',
    'bill_fee',
    'paper_invoice_fee',
    'paper_billing_fee',
    'aviavgift',
    'administration_fee_invoice',
  ]),
  markup_ore_per_kwh: new Set([
    'markup',
    'supplier_markup',
    'supplier_margin',
    'energy_markup',
    'paslag',
    'elhandelspaslag',
    'management_fee',
  ]),
  variable_markup_ore_per_kwh: new Set([
    'variable_fee',
    'variable_markup',
    'variable_charge',
    'rorlig_avgift',
    'energy_fee',
    'kwh_fee',
  ]),
  elcert_ore_per_kwh: new Set([
    'elcert',
    'elcert_fee',
    'electricity_certificate',
    'electricity_certificate_fee',
    'certifikatavgift',
  ]),
  fixed_price_ore_per_kwh: new Set([
    'fixed_price',
    'fixed_kwh_price',
    'fixed_energy_price',
    'fastpris',
    'fast_elpris',
    'price_per_kwh',
  ]),
  monthly_fixed_price_sek: new Set([
    'monthly_fixed',
    'fixed_monthly',
    'monthly_fixed_price',
    'monthly_price',
    'fast_manadspris',
  ]),
  portfolio_price_ore_per_kwh: new Set([
    'portfolio_price',
    'managed_price',
    'portfoljpris',
    'portfolio_energy_price',
  ]),
  spot_share: new Set(['spot_share', 'variable_share', 'rorlig_andel']),
  portfolio_share: new Set(['portfolio_share', 'managed_share', 'portfoljandel']),
  vat_rate: new Set(['vat', 'vat_rate', 'moms', 'momssats']),
}

function componentMatchScore(
  component: PublicPricingComponent,
  key: CanonicalPublishedPricingKey,
): number {
  const code = normalizedComponentToken(component.component_code)
  const textValue = componentSearchText(component)
  const unitKind = componentUnitKind(component.unit)
  let score = EXACT_COMPONENT_CODES[key].has(code) ? 100 : 0

  switch (key) {
    case 'invoice_fee_sek':
      if (/invoice|faktur|billing|paper_bill|paper_invoice|aviavgift/.test(textValue)) score = Math.max(score, 90)
      if (unitKind === 'invoice') score = Math.max(score, 80)
      return score
    case 'monthly_fixed_price_sek':
      if (/monthly_fixed|fixed_monthly|monthly_price|manadspris|fast_manadspris/.test(textValue)) {
        score = Math.max(score, 90)
      }
      return unitKind === 'month' ? score : 0
    case 'monthly_fee_sek':
      if (/monthly_fee|manadsavgift|subscription|abonnemang|grundavgift|fast_avgift/.test(textValue)) {
        score = Math.max(score, 90)
      }
      if (/monthly_fixed|fixed_monthly|monthly_price|manadspris|fast_manadspris/.test(textValue)) return 0
      if (unitKind === 'month') score = Math.max(score, 75)
      return score
    case 'elcert_ore_per_kwh':
      if (/elcert|electricity_certificate|certifikat/.test(textValue)) score = Math.max(score, 90)
      return unitKind === 'energy' ? score : 0
    case 'portfolio_price_ore_per_kwh':
      if (/portfolio_price|managed_price|portfoljpris|portfolj_pris|forvaltat_pris/.test(textValue)) score = Math.max(score, 90)
      return unitKind === 'energy' ? score : 0
    case 'variable_markup_ore_per_kwh':
      if (/variable_fee|variable_markup|variable_charge|rorlig_avgift|energy_fee|kwh_fee|balansavgift/.test(textValue)) {
        score = Math.max(score, 90)
      }
      return unitKind === 'energy' ? score : 0
    case 'markup_ore_per_kwh':
      if (/markup|supplier_margin|energy_markup|paslag|marginal|forvaltningsavgift|handelsavgift/.test(textValue)) {
        score = Math.max(score, 90)
      }
      if (/variable_fee|variable_markup|rorlig_avgift|elcert|portfolio_price|fixed_price|fastpris/.test(textValue)) return 0
      return unitKind === 'energy' ? score : 0
    case 'fixed_price_ore_per_kwh':
      if (/fixed_price|fixed_kwh|fastpris|fast_pris|fast_elpris|fixed_energy_price|energy_price|energipris|elpris/.test(textValue)) {
        score = Math.max(score, 90)
      }
      return unitKind === 'energy' ? score : 0
    case 'spot_share':
      if (/spot_share|variable_share|rorlig_andel|spotandel/.test(textValue)) score = Math.max(score, 90)
      return unitKind === 'percent' || score >= 90 ? score : 0
    case 'portfolio_share':
      if (/portfolio_share|managed_share|portfoljandel|portfolio_andel/.test(textValue)) score = Math.max(score, 90)
      return unitKind === 'percent' || score >= 90 ? score : 0
    case 'vat_rate':
      if (/vat|moms|momssats/.test(textValue)) score = Math.max(score, 90)
      return unitKind === 'percent' || score >= 90 ? score : 0
  }
}

/**
 * Resolves the same visible OPS component that the public contract card renders.
 * Exact component codes win, then semantic aliases, then unambiguous units such
 * as SEK per invoice or SEK per month. Zero is a valid published amount.
 */
export function publishedPricingComponentAmount(
  components: readonly PublicPricingComponent[] | null | undefined,
  key: CanonicalPublishedPricingKey,
): number | null {
  let best: { score: number; index: number; amount: number } | null = null

  for (const [index, component] of (components ?? []).entries()) {
    if (component.website_card_visible === false || !Number.isFinite(component.amount)) continue
    const score = componentMatchScore(component, key)
    if (score <= 0) continue
    if (!best || score > best.score || (score === best.score && index < best.index)) {
      best = { score, index, amount: component.amount }
    }
  }

  return best?.amount ?? null
}

export function calculationPricingComponentAmount(
  components: readonly PublicPricingComponent[] | null | undefined,
  key: CanonicalPublishedPricingKey,
): number | null {
  let best: { score: number; index: number; amount: number } | null = null
  for (const [index, component] of (components ?? []).entries()) {
    if (component.calculation_inclusion === 'excluded' || !Number.isFinite(component.amount)) continue
    const score = componentMatchScore(component, key)
    if (score <= 0) continue
    if (!best || score > best.score || (score === best.score && index < best.index)) {
      best = { score, index, amount: component.amount }
    }
  }
  return best?.amount ?? null
}

export function publishedPricingComponentDiagnostics(
  components: readonly PublicPricingComponent[] | null | undefined,
): Array<{ code: string; name: string; amount: number; unit: string; visible: boolean }> {
  return (components ?? []).map((component) => ({
    code: component.component_code,
    name: component.name,
    amount: component.amount,
    unit: component.unit,
    visible: component.website_card_visible,
  }))
}

export type PublicPortfolioMonthlyPrice = {
  year: number
  month: number
  price_area_code: string
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

function amount(value: unknown, seen = new Set<unknown>()): number | null {
  const direct = number(value)
  if (direct !== null) return direct
  const row = record(value)
  if (!row || seen.has(value)) return null
  seen.add(value)

  for (const key of [
    'amount',
    'value',
    'price',
    'rate',
    'sek',
    'ore',
    'amount_sek',
    'amountSek',
    'amount_ore',
    'amountOre',
  ]) {
    const nested = amount(row[key], seen)
    if (nested !== null) return nested
  }
  return null
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

function websiteVisibility(value: unknown, fallback: WebsiteVisibility): WebsiteVisibility {
  const normalized = text(value)?.toLowerCase()
  if (normalized === 'visible' || normalized === 'summary_only' || normalized === 'hidden') return normalized
  const legacy = boolean(value)
  if (legacy === true) return 'visible'
  if (legacy === false) return 'hidden'
  return fallback
}

function pricingComponents(
  value: unknown,
  fallbackVisibility: WebsiteVisibility = 'hidden',
): PublicPricingComponent[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const row = record(item)
    if (!row) return []
    const explicitCode = text(row.component_code ?? row.componentCode ?? row.code ?? row.key ?? row.type)
    const componentName = text(row.name ?? row.label ?? row.title ?? row.description ?? explicitCode)
    const componentCode = explicitCode ?? componentName
    const componentAmount = amount(row.amount ?? row.value ?? row.price ?? row.rate)
    const amountRow = record(row.amount) ?? record(row.value) ?? record(row.price)
    const unit = text(
      row.unit ?? row.unit_code ?? row.unitCode ?? row.unit_type ?? row.unitType ??
      amountRow?.unit ?? amountRow?.unit_code ?? amountRow?.unitCode,
    )
    if (!componentCode || !componentName || componentAmount === null) return []
    const visibility = websiteVisibility(
      row.website_visibility ?? row.websiteVisibility ?? row.website_card_visible ??
      row.websiteCardVisible ?? row.visible_on_website ?? row.visibleOnWebsite ??
      row.show_on_website ?? row.showOnWebsite ?? row.visible,
      fallbackVisibility,
    )
    const inclusion = text(row.calculation_inclusion ?? row.calculationInclusion)?.toLowerCase() === 'excluded'
      ? 'excluded' as const
      : 'included' as const
    return [{
      component_code: componentCode,
      component_reference: text(row.component_reference ?? row.componentReference),
      selection_policy: (
        ['mandatory', 'customer_optional', 'admin_optional', 'conditional'].includes(
          text(row.selection_policy ?? row.selectionPolicy) ?? '',
        )
          ? text(row.selection_policy ?? row.selectionPolicy)
          : null
      ) as PublicPricingComponent['selection_policy'],
      lifecycle: (
        [
          'recurring',
          'per_invoice',
          'per_site',
          'once_per_contract',
          'once_per_site',
          'annual',
          'consumption_based',
          'event_only',
        ].includes(text(row.lifecycle) ?? '')
          ? text(row.lifecycle)
          : null
      ) as PublicPricingComponent['lifecycle'],
      name: componentName,
      amount: componentAmount,
      currency: text(row.currency ?? amountRow?.currency),
      unit: unit ?? '',
      calculation_inclusion: inclusion,
      website_visibility: visibility,
      website_card_visible: visibility === 'visible',
      calculation_base: text(row.calculation_base ?? row.calculationBase ?? row.base ?? row.applies_to ?? row.appliesTo),
      vat_included: boolean(row.vat_included ?? row.vatIncluded ?? amountRow?.vat_included ?? amountRow?.vatIncluded),
      vat_rate: number(row.vat_rate ?? row.vatRate ?? amountRow?.vat_rate ?? amountRow?.vatRate),
      billing_interval_months: number(row.billing_interval_months ?? row.billingIntervalMonths),
      invoices_per_year: number(row.invoices_per_year ?? row.invoicesPerYear),
    }]
  })
}

function strictCalendarDate(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null
  const normalized = text(value)
  if (!normalized || !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return undefined
  const [year, month, day] = normalized.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? normalized
    : undefined
}

export type PublicContractValidationIssue = ContractValidationIssue

type ValidationResult<T> = {
  value: T | null
  issues: PublicContractValidationIssue[]
}

const publicReferencePattern = /^[a-z0-9][a-z0-9_-]{2,99}$/i
const publicPriceAreas = new Set(['SE1', 'SE2', 'SE3', 'SE4'])

function validationIssue(
  code: string,
  path: string,
  severity: ContractIssueSeverity = 'blocking',
): PublicContractValidationIssue {
  return contractIssue({ code, path, severity, source: 'semantic' })
}

function hasBlockingIssues(issues: readonly PublicContractValidationIssue[]): boolean {
  return issues.some(isBlockingContractIssue)
}

function intervalsOverlap(
  left: Pick<PublicContractAreaPrice, 'valid_from' | 'valid_to'>,
  right: Pick<PublicContractAreaPrice, 'valid_from' | 'valid_to'>,
): boolean {
  const leftStart = left.valid_from ?? '0000-01-01'
  const rightStart = right.valid_from ?? '0000-01-01'
  const leftEnd = left.valid_to ?? '9999-12-31'
  const rightEnd = right.valid_to ?? '9999-12-31'
  return leftStart <= rightEnd && rightStart <= leftEnd
}

function canonicalAreaPrices(value: unknown, path: string): ValidationResult<PublicContractAreaPrice[]> {
  if (!Array.isArray(value)) {
    return { value: null, issues: [validationIssue('area_prices_invalid', path)] }
  }
  if (value.length === 0) return { value: [], issues: [] }

  const issues: PublicContractValidationIssue[] = []
  const rows: PublicContractAreaPrice[] = []
  const sourceIndexes: number[] = []
  const references = new Set<string>()

  value.forEach((item, index) => {
    const rowPath = `${path}[${index}]`
    const row = record(item)
    if (!row) {
      issues.push(validationIssue('area_price_invalid', rowPath))
      return
    }

    const reference = text(row.area_price_reference)
    if (!reference) issues.push(validationIssue('area_price_reference_missing', `${rowPath}.area_price_reference`))
    else if (!publicReferencePattern.test(reference)) issues.push(validationIssue('area_price_reference_invalid', `${rowPath}.area_price_reference`))
    else if (references.has(reference)) issues.push(validationIssue('duplicate_area_price_reference', `${rowPath}.area_price_reference`))

    // Canonical fields always win. Legacy aliases are accepted only as an explicit
    // compatibility bridge and never replace the required external reference,
    // unit or validity fields.
    const priceArea = text(row.price_area !== undefined ? row.price_area : row.price_area_code)?.toUpperCase()
    if (!priceArea || !publicPriceAreas.has(priceArea)) {
      issues.push(validationIssue('price_area_invalid', `${rowPath}.price_area`))
    }

    const rawEnergyPrice = row.energy_price_ore_per_kwh !== undefined
      ? row.energy_price_ore_per_kwh
      : row.fixed_price_ore_per_kwh
    const energyPrice = number(rawEnergyPrice)
    if (rawEnergyPrice === undefined || rawEnergyPrice === null) {
      issues.push(validationIssue('energy_price_ore_per_kwh_missing', `${rowPath}.energy_price_ore_per_kwh`))
    } else if (energyPrice === null || !Number.isFinite(energyPrice) || energyPrice <= 0) {
      issues.push(validationIssue('energy_price_ore_per_kwh_invalid', `${rowPath}.energy_price_ore_per_kwh`))
    }

    const unit = text(row.unit)
    if (unit !== 'ore_per_kwh') issues.push(validationIssue('area_price_unit_invalid', `${rowPath}.unit`))

    const validFromPresent = Object.hasOwn(row, 'valid_from')
    const validToPresent = Object.hasOwn(row, 'valid_to')
    const validFrom = strictCalendarDate(row.valid_from)
    const validTo = strictCalendarDate(row.valid_to)
    if (!validFromPresent || !validToPresent || validFrom === undefined || validTo === undefined || (validFrom && validTo && validFrom > validTo)) {
      issues.push(validationIssue('area_price_validity_invalid', `${rowPath}.${!validFromPresent || validFrom === undefined ? 'valid_from' : 'valid_to'}`))
    }

    if (
      reference && publicReferencePattern.test(reference) && !references.has(reference) &&
      priceArea && publicPriceAreas.has(priceArea) &&
      energyPrice !== null && Number.isFinite(energyPrice) && energyPrice > 0 &&
      unit === 'ore_per_kwh' &&
      validFromPresent && validToPresent && validFrom !== undefined && validTo !== undefined &&
      (!validFrom || !validTo || validFrom <= validTo)
    ) {
      references.add(reference)
      sourceIndexes.push(index)
      rows.push({
        area_price_reference: reference,
        price_area: priceArea as PublicContractAreaPrice['price_area'],
        energy_price_ore_per_kwh: energyPrice,
        unit: 'ore_per_kwh',
        valid_from: validFrom,
        valid_to: validTo,
      })
    }
  })

  for (let leftIndex = 0; leftIndex < rows.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < rows.length; rightIndex += 1) {
      const left = rows[leftIndex]
      const right = rows[rightIndex]
      if (left.price_area === right.price_area && intervalsOverlap(left, right)) {
        issues.push(validationIssue('overlapping_area_price_validity', `${path}[${sourceIndexes[rightIndex]}].valid_from`))
      }
    }
  }

  return { value: hasBlockingIssues(issues) ? null : rows, issues }
}

function parsePriceOptions(value: unknown, path = 'price_options'): ValidationResult<PublicContractPriceOption[]> {
  if (!Array.isArray(value) || value.length === 0) {
    return { value: null, issues: [validationIssue('price_options_missing', path)] }
  }
  const contractTypes = new Set<PublicContractPriceOptionType>([
    'fixed',
    'variable_monthly',
    'variable_hourly',
    'variable_quarterly',
    'portfolio',
    'mixed',
  ])
  const customerTypes = new Set<PublicContractPriceOptionCustomerType>(['private', 'business', 'both'])
  const references = new Set<string>()
  const options: PublicContractPriceOption[] = []
  const issues: PublicContractValidationIssue[] = []

  value.forEach((item, index) => {
    const rowPath = `${path}[${index}]`
    const row = record(item)
    if (!row) {
      issues.push(validationIssue('price_option_invalid', rowPath))
      return
    }

    const rowIssues: PublicContractValidationIssue[] = []
    const reference = text(row.price_option_reference)
    const optionCode = text(row.option_code)
    const customerName = text(row.customer_name)
    const contractType = text(row.contract_type) as PublicContractPriceOptionType | null
    const priceType = text(row.price_type) as PublicContractPriceOptionType | null
    const customerType = text(row.customer_type) as PublicContractPriceOptionCustomerType | null
    const bindingMonths = number(row.binding_months)
    const noticeMonths = number(row.notice_months)
    const autoRenew = boolean(row.auto_renew_enabled)
    const renewalTermMonths = number(row.renewal_term_months)
    const canonicalDefault = boolean(row.is_default)
    const deprecatedDefault = boolean(row.default)
    const selectionRequired = boolean(row.selection_required)
    const validFrom = strictCalendarDate(row.valid_from)
    const validTo = strictCalendarDate(row.valid_to)
    const earliestStartDate = strictCalendarDate(row.earliest_start_date)
    const latestStartDate = strictCalendarDate(row.latest_start_date)
    const resolutionValue = text(row.resolution)
    const resolution = resolutionValue && ['monthly', 'hourly', 'quarterly'].includes(resolutionValue)
      ? resolutionValue as PublicContractPriceOption['resolution']
      : null
    const areaResult = canonicalAreaPrices(row.area_prices, `${rowPath}.area_prices`)
    rowIssues.push(...areaResult.issues)

    if (!reference) rowIssues.push(validationIssue('price_option_reference_missing', `${rowPath}.price_option_reference`))
    else if (!publicReferencePattern.test(reference)) rowIssues.push(validationIssue('price_option_reference_invalid', `${rowPath}.price_option_reference`))
    else if (references.has(reference)) rowIssues.push(validationIssue('duplicate_price_option_reference', `${rowPath}.price_option_reference`))

    if (!optionCode) rowIssues.push(validationIssue('option_code_missing', `${rowPath}.option_code`))
    if (!customerName) rowIssues.push(validationIssue('customer_name_missing', `${rowPath}.customer_name`))
    if (!contractType || !contractTypes.has(contractType)) rowIssues.push(validationIssue('price_option_contract_type_invalid', `${rowPath}.contract_type`))
    if (!priceType || !contractTypes.has(priceType)) rowIssues.push(validationIssue('price_option_price_type_invalid', `${rowPath}.price_type`))
    if (!customerType || !customerTypes.has(customerType)) rowIssues.push(validationIssue('price_option_customer_type_invalid', `${rowPath}.customer_type`))

    if (bindingMonths === null || !Number.isInteger(bindingMonths) || bindingMonths < 0) {
      rowIssues.push(validationIssue('binding_months_invalid', `${rowPath}.binding_months`))
    }
    if (noticeMonths === null || !Number.isInteger(noticeMonths) || noticeMonths < 0) {
      rowIssues.push(validationIssue('notice_months_invalid', `${rowPath}.notice_months`))
    }
    if (autoRenew === null) {
      rowIssues.push(validationIssue('auto_renew_enabled_invalid', `${rowPath}.auto_renew_enabled`))
    }
    if (!Object.hasOwn(row, 'renewal_term_months') || (renewalTermMonths !== null && (!Number.isInteger(renewalTermMonths) || renewalTermMonths < 1))) {
      rowIssues.push(validationIssue('renewal_term_months_invalid', `${rowPath}.renewal_term_months`))
    }

    const isDefault: boolean | null = canonicalDefault
    if (canonicalDefault === null) rowIssues.push(validationIssue('price_option_default_missing', `${rowPath}.is_default`))
    if (deprecatedDefault === null) {
      rowIssues.push(validationIssue('deprecated_default_alias_missing', `${rowPath}.default`, 'compatibility'))
    } else if (canonicalDefault !== null && canonicalDefault !== deprecatedDefault) {
      rowIssues.push(validationIssue('price_option_default_conflict', `${rowPath}.default`))
    }
    if (selectionRequired === null) rowIssues.push(validationIssue('selection_required_invalid', `${rowPath}.selection_required`))
    if (!resolution) rowIssues.push(validationIssue('price_option_resolution_invalid', `${rowPath}.resolution`))
    if (text(row.currency) !== 'SEK') rowIssues.push(validationIssue('price_option_currency_invalid', `${rowPath}.currency`))
    if (text(row.unit) !== 'ore_per_kwh') rowIssues.push(validationIssue('price_option_unit_invalid', `${rowPath}.unit`))
    for (const property of ['fixed_price', 'markup', 'monthly_fee', 'area_prices']) {
      if (!Object.hasOwn(row, property)) rowIssues.push(validationIssue('price_option_required_field_missing', `${rowPath}.${property}`))
    }
    for (const property of ['fixed_price', 'markup', 'monthly_fee']) {
      if (row[property] !== null && number(row[property]) === null) {
        rowIssues.push(validationIssue('price_option_amount_invalid', `${rowPath}.${property}`))
      }
    }

    if (validFrom === undefined || validTo === undefined || (validFrom && validTo && validFrom > validTo)) {
      rowIssues.push(validationIssue('price_option_validity_invalid', `${rowPath}.valid_from`))
    }
    if (earliestStartDate === undefined || latestStartDate === undefined || (earliestStartDate && latestStartDate && earliestStartDate > latestStartDate)) {
      rowIssues.push(validationIssue('price_option_start_window_invalid', `${rowPath}.earliest_start_date`))
    }
    if (resolutionValue && resolution === null) {
      rowIssues.push(validationIssue('price_option_resolution_invalid', `${rowPath}.resolution`))
    }

    const areaPrices = areaResult.value
    if (
      contractType && priceType &&
      requiresPublishedAreaPrices({ contract_type: contractType, price_type: priceType }) &&
      areaPrices !== null && areaPrices.length === 0
    ) {
      rowIssues.push(validationIssue('area_prices_missing', `${rowPath}.area_prices`))
    }

    issues.push(...rowIssues)
    if (hasBlockingIssues(rowIssues) || areaPrices === null || !reference || !contractType || !priceType || !customerType || isDefault === null || selectionRequired === null) {
      return
    }

    references.add(reference)
    options.push({
      price_option_reference: reference,
      option_code: optionCode,
      customer_name: customerName,
      price_type: priceType,
      contract_type: contractType,
      customer_type: customerType,
      resolution,
      currency: 'SEK',
      unit: 'ore_per_kwh',
      fixed_price: number(row.fixed_price),
      markup: number(row.markup),
      monthly_fee: number(row.monthly_fee),
      binding_months: bindingMonths,
      notice_months: noticeMonths,
      auto_renew_enabled: autoRenew,
      renewal_term_months: renewalTermMonths,
      is_default: isDefault,
      default: deprecatedDefault ?? isDefault,
      selection_required: selectionRequired,
      valid_from: validFrom ?? null,
      valid_to: validTo ?? null,
      earliest_start_date: earliestStartDate ?? null,
      latest_start_date: latestStartDate ?? null,
      area_prices: areaPrices,
    })
  })

  for (const customerType of ['private', 'business'] as const) {
    const candidates = options.filter((option) => option.customer_type === 'both' || option.customer_type === customerType)
    if (candidates.length === 0 || candidates.some((option) => option.selection_required)) continue
    const defaults = candidates.filter((option) => option.is_default)
    if (defaults.length === 0) {
      issues.push(validationIssue('default_price_option_missing', path))
    } else if (defaults.length > 1) {
      issues.push(validationIssue('multiple_default_price_options', path))
    }
  }

  return { value: !hasBlockingIssues(issues) && options.length > 0 ? options : null, issues }
}

function priceOptions(value: unknown): PublicContractPriceOption[] | null {
  return parsePriceOptions(value).value
}

function legalValidationIssues(value: unknown, path: string): PublicContractValidationIssue[] {
  const legal = record(value)
  if (!legal) return [validationIssue('legal_missing', path)]

  const issues: PublicContractValidationIssue[] = []
  const bundleReference = text(legal.legal_bundle_reference)
  const bundleVersionId = text(legal.legal_bundle_version_id)
  if (!Object.hasOwn(legal, 'legal_bundle_reference')) {
    issues.push(validationIssue('legal_bundle_reference_missing', `${path}.legal_bundle_reference`))
  } else if (legal.legal_bundle_reference !== null && !bundleReference) {
    issues.push(validationIssue('legal_bundle_reference_invalid', `${path}.legal_bundle_reference`))
  } else if (legal.legal_bundle_reference === null) {
    issues.push(validationIssue('legal_bundle_reference_historical_null', `${path}.legal_bundle_reference`, 'warning'))
  }
  if (!Object.hasOwn(legal, 'legal_bundle_version_id')) {
    issues.push(validationIssue('legal_bundle_version_id_missing', `${path}.legal_bundle_version_id`))
  } else if (legal.legal_bundle_version_id !== null && !bundleVersionId) {
    issues.push(validationIssue('legal_bundle_version_id_invalid', `${path}.legal_bundle_version_id`))
  } else if (legal.legal_bundle_version_id === null) {
    issues.push(validationIssue('legal_bundle_version_id_historical_null', `${path}.legal_bundle_version_id`, 'warning'))
  }
  if (boolean(legal.immutable) !== true) issues.push(validationIssue('legal_bundle_not_immutable', `${path}.immutable`))

  const requiredModules = Array.isArray(legal.required_modules)
    ? legal.required_modules.flatMap((item) => text(item) ?? [])
    : []
  const modules = Array.isArray(legal.module_versions) ? legal.module_versions : []
  if (!Object.hasOwn(legal, 'required_modules') || !Array.isArray(legal.required_modules)) {
    issues.push(validationIssue('legal_required_modules_missing', `${path}.required_modules`))
  }
  if (!Object.hasOwn(legal, 'module_versions') || !Array.isArray(legal.module_versions)) {
    issues.push(validationIssue('legal_module_versions_missing', `${path}.module_versions`))
  }

  const publishedModuleKeys = new Set<string>()
  modules.forEach((item, index) => {
    const modulePath = `${path}.module_versions[${index}]`
    const legalModule = record(item)
    if (!legalModule) {
      issues.push(validationIssue('legal_module_invalid', modulePath))
      return
    }
    for (const key of ['id', 'document_reference', 'module_key', 'version', 'title'] as const) {
      if (!text(legalModule[key])) issues.push(validationIssue(`legal_module_${key}_missing`, `${modulePath}.${key}`))
    }
    const moduleKey = text(legalModule.module_key)
    if (moduleKey) publishedModuleKeys.add(moduleKey)
    if (!Object.hasOwn(legalModule, 'legal_bundle_version_id')) {
      issues.push(validationIssue('legal_module_bundle_version_id_missing', `${modulePath}.legal_bundle_version_id`))
    } else {
      const moduleBundleVersionId = text(legalModule.legal_bundle_version_id)
      if (legalModule.legal_bundle_version_id !== null && !moduleBundleVersionId) {
        issues.push(validationIssue('legal_module_bundle_version_id_invalid', `${modulePath}.legal_bundle_version_id`))
      } else if (bundleVersionId && moduleBundleVersionId && moduleBundleVersionId !== bundleVersionId) {
        issues.push(validationIssue('legal_module_bundle_version_mismatch', `${modulePath}.legal_bundle_version_id`))
      }
    }
  })
  for (const requiredModule of requiredModules) {
    if (!publishedModuleKeys.has(requiredModule)) {
      issues.push(validationIssue('legal_required_module_missing', `${path}.module_versions.${requiredModule}`))
    }
  }
  return issues
}

export function publicContractValidationIssues(value: unknown, path = ''): PublicContractValidationIssue[] {
  const row = record(value)
  const prefix = path ? `${path}.` : ''
  if (!row) return [validationIssue('invalid_contract_object', path || '$', 'fatal')]

  const issues: PublicContractValidationIssue[] = []
  const offerReference = text(row.offer_reference)
  if (!offerReference) issues.push(validationIssue('missing_offer_reference', `${prefix}offer_reference`, 'fatal'))
  else if (!publicReferencePattern.test(offerReference)) issues.push(validationIssue('offer_reference_invalid', `${prefix}offer_reference`, 'fatal'))

  if (!text(row.name)) issues.push(validationIssue('missing_name', `${prefix}name`))

  const contractType = text(row.contract_type)
  if (!contractType) issues.push(validationIssue('missing_contract_type', `${prefix}contract_type`))
  else if (!['fixed', 'variable_monthly', 'variable_hourly', 'variable_quarterly', 'portfolio', 'mixed'].includes(contractType)) {
    issues.push(validationIssue('unsupported_contract_type', `${prefix}contract_type`))
  }

  const energyDirection = text(row.energy_direction)
  if (energyDirection !== 'consumption' && energyDirection !== 'production') {
    issues.push(validationIssue('invalid_energy_direction', `${prefix}energy_direction`))
  }

  const customerType = text(row.customer_type)
  if (!customerType || !['private', 'business', 'both'].includes(customerType)) {
    issues.push(validationIssue('customer_type_invalid', `${prefix}customer_type`))
  }

  const channel = text(row.channel)
  if (channel !== 'website') issues.push(validationIssue('channel_not_website', `${prefix}channel`, 'fatal'))
  if (!record(row.pricing)) issues.push(validationIssue('pricing_missing', `${prefix}pricing`))
  issues.push(...legalValidationIssues(row.legal, `${prefix}legal`))

  const parsedOptions = parsePriceOptions(row.price_options, `${prefix}price_options`)
  issues.push(...parsedOptions.issues)

  const advertisedAreas = normalizedPriceAreas(row.price_areas ?? row.priceAreas)
  for (const [index, option] of (parsedOptions.value ?? []).entries()) {
    if (!requiresPublishedAreaPrices(option)) continue
    const optionPath = `${prefix}price_options[${index}].area_prices`
    const covered = new Set(option.area_prices.map((areaPrice) => areaPrice.price_area))
    const requiredAreas = advertisedAreas.length > 0 ? advertisedAreas : [...covered]
    for (const area of requiredAreas) {
      if (!covered.has(area)) {
        issues.push(validationIssue('fixed_area_price_missing', `${optionPath}.${area}`))
      }
    }
  }

  return issues
}

export type PublicPriceOptionSelection =
  | { status: 'selected'; option: PublicContractPriceOption; area_price: PublicContractAreaPrice | null; options: PublicContractPriceOption[] }
  | { status: 'selection_required'; option: null; area_price: null; options: PublicContractPriceOption[] }
  | { status: 'unavailable'; option: null; area_price: null; options: [] }

export function selectPublicContractPriceOption(input: {
  options: readonly PublicContractPriceOption[]
  customer_type: 'private' | 'business'
  price_area_code: 'SE1' | 'SE2' | 'SE3' | 'SE4'
  start_date: string
  selected_reference?: string | null
  current_date?: string
}): PublicPriceOptionSelection {
  const candidates = input.options.flatMap((option) => {
    const customerMatches = option.customer_type === 'both' || option.customer_type === input.customer_type
    const optionValidForStart = (!option.valid_from || option.valid_from <= input.start_date) &&
      (!option.valid_to || option.valid_to >= input.start_date)
    const startValid = (!option.earliest_start_date || option.earliest_start_date <= input.start_date) &&
      (!option.latest_start_date || option.latest_start_date >= input.start_date)
    const areaPrice = option.area_prices.find((price) => (
      price.price_area === input.price_area_code &&
      (!price.valid_from || price.valid_from <= input.start_date) &&
      (!price.valid_to || price.valid_to >= input.start_date)
    )) ?? null
    const areaReady = !requiresPublishedAreaPrices(option) || areaPrice !== null
    return customerMatches && optionValidForStart && startValid && areaReady
      ? [{ option, areaPrice }]
      : []
  })
  const options = candidates.map(({ option }) => option)

  if (input.selected_reference) {
    const selected = candidates.find(({ option }) => option.price_option_reference === input.selected_reference)
    return selected
      ? { status: 'selected', option: selected.option, area_price: selected.areaPrice, options }
      : { status: 'unavailable', option: null, area_price: null, options: [] }
  }
  if (candidates.length === 0) return { status: 'unavailable', option: null, area_price: null, options: [] }
  if (candidates.some(({ option }) => option.selection_required)) {
    return { status: 'selection_required', option: null, area_price: null, options }
  }
  if (candidates.length === 1) {
    const selected = candidates[0]
    return { status: 'selected', option: selected.option, area_price: selected.areaPrice, options }
  }
  const defaults = candidates.filter(({ option }) => option.is_default)
  if (defaults.length === 1) {
    const selected = defaults[0]
    return { status: 'selected', option: selected.option, area_price: selected.areaPrice, options }
  }
  return { status: 'selection_required', option: null, area_price: null, options }
}

function pricingComponentSource(
  row: Record<string, unknown>,
  pricing: Record<string, unknown>,
): unknown {
  return (
    pricing.components ??
    pricing.pricing_components ??
    pricing.pricingComponents ??
    pricing.price_components ??
    pricing.priceComponents ??
    pricing.fees ??
    pricing.charges ??
    row.pricing_components ??
    row.pricingComponents ??
    row.price_components ??
    row.priceComponents ??
    row.components
  )
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
      amount: price,
      unit,
    }]
  })
}

export function normalizeProductionPricing(value: unknown): PublicProductionPricing | null {
  const row = record(value)
  if (!row || row.enabled !== true) return null
  const compensationModel = text(row.compensation_model)
  const resolution = text(row.resolution)
  const settlementMode = text(row.settlement_mode)
  const billingDirection = text(row.billing_direction)
  const meteringPointRole = text(row.metering_point_role)
  if (
    compensationModel !== 'fixed_compensation' ||
    !resolution || !['monthly', 'hourly', 'quarterly'].includes(resolution) ||
    !settlementMode || !['credit_invoice', 'self_billing'].includes(settlementMode) ||
    !billingDirection || !['credit_invoice', 'self_billing'].includes(billingDirection) ||
    meteringPointRole !== 'production'
  ) return null
  return {
    enabled: true,
    compensation_model: 'fixed_compensation',
    resolution: resolution as PublicProductionPricing['resolution'],
    deduction_ore_per_kwh: number(row.deduction_ore_per_kwh),
    premium_ore_per_kwh: number(row.premium_ore_per_kwh),
    fixed_compensation_ore_per_kwh: number(row.fixed_compensation_ore_per_kwh),
    compensation_ore_per_kwh: number(row.compensation_ore_per_kwh),
    compensation_sek_per_kwh: number(row.compensation_sek_per_kwh),
    settlement_mode: settlementMode as PublicProductionPricing['settlement_mode'],
    billing_direction: billingDirection as PublicProductionPricing['billing_direction'],
    vat_rate: number(row.vat_rate),
    vat_rate_percent: number(row.vat_rate_percent),
    vat_treatment: text(row.vat_treatment),
    metering_point_role: 'production',
  }
}

function normalizedPriceAreas(value: unknown): Array<'SE1' | 'SE2' | 'SE3' | 'SE4'> {
  if (!Array.isArray(value)) return []
  const allowed = new Set(['SE1', 'SE2', 'SE3', 'SE4'])
  return [...new Set(value.map((item) => text(item)?.toUpperCase()).filter((item): item is 'SE1' | 'SE2' | 'SE3' | 'SE4' => Boolean(item && allowed.has(item))))]
}

function areaPricing(value: unknown): PublicAreaPricing[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const row = record(item)
    if (!row) return []
    const priceAreaCode = text(row.price_area_code ?? row.priceAreaCode ?? row.price_area)?.toUpperCase()
    if (!priceAreaCode || !['SE1', 'SE2', 'SE3', 'SE4'].includes(priceAreaCode)) return []
    const fixed = record(row.fixed_price ?? row.fixedPrice)
    const fixedAmount = amount(fixed ?? row.fixed_price_ore_per_kwh ?? row.fixedPriceOrePerKwh ?? row.price)
    if (fixedAmount === null) return []
    return [{
      price_area_code: priceAreaCode as PublicAreaPricing['price_area_code'],
      fixed_price_ore_per_kwh: fixedAmount,
      vat_included: boolean(fixed?.vat_included ?? fixed?.vatIncluded ?? row.vat_included ?? row.vatIncluded),
      vat_rate: number(fixed?.vat_rate ?? fixed?.vatRate ?? row.vat_rate ?? row.vatRate),
    }]
  })
}


function legalModuleVersions(legal: Record<string, unknown>): Record<string, unknown>[] {
  if (!Array.isArray(legal.module_versions)) return []
  return legal.module_versions.flatMap((item) => {
    const legalModule = record(item)
    return legalModule ? [legalModule] : []
  })
}

function normalizedLegalModuleVersions(legal: Record<string, unknown>): PublicContractLegalModuleVersion[] {
  return legalModuleVersions(legal).flatMap((module) => {
    const id = text(module.id)
    const documentReference = text(module.document_reference)
    const moduleKey = text(module.module_key)
    const version = text(module.version)
    const title = text(module.title)
    if (!id || !documentReference || !moduleKey || !version || !title) return []
    return [{
      id,
      legal_bundle_version_id: text(module.legal_bundle_version_id),
      document_reference: documentReference,
      module_key: moduleKey,
      version,
      title,
      published_at: text(module.published_at),
      content_sha256: text(module.content_sha256),
      origin: text(module.origin),
      url: text(module.url),
    }]
  })
}

function legalModule(
  legal: Record<string, unknown>,
  moduleKeys: readonly string[],
): Record<string, unknown> | null {
  return legalModuleVersions(legal).find((module) => {
    const key = text(module.module_key)?.toLowerCase()
    return Boolean(key && moduleKeys.includes(key))
  }) ?? null
}

function legalRequirements(row: Record<string, unknown>, legal: Record<string, unknown>): PublicLegalRequirement[] {
  const source = legal.requirements ?? legal.legal_requirements ?? row.legal_requirements
  if (Array.isArray(source)) {
    return source.flatMap((item) => {
      const requirement = record(item)
      if (!requirement) return []
      const code = text(requirement.requirement_code ?? requirement.requirementCode ?? requirement.code)
      const label = text(requirement.label ?? requirement.title ?? requirement.name)
      if (!code || !label) return []
      return [{
        requirement_code: code,
        acceptance_type: text(requirement.acceptance_type ?? requirement.acceptanceType) ?? 'checkbox',
        required: boolean(requirement.required) !== false,
        label,
        document_reference: text(
          requirement.document_reference ??
          requirement.documentReference ??
          requirement.document_id ??
          requirement.documentId ??
          requirement.legal_bundle_version_document_id ??
          requirement.legalBundleVersionDocumentId,
        ),
        document_version: text(requirement.document_version ?? requirement.documentVersion ?? requirement.version),
        document_hash: text(requirement.document_hash ?? requirement.documentHash ?? requirement.sha256),
        public_url: text(requirement.public_url ?? requirement.publicUrl ?? requirement.url),
      }]
    })
  }

  const requiredModules = new Set(
    Array.isArray(legal.required_modules)
      ? legal.required_modules.flatMap((value) => text(value)?.toLowerCase() ?? [])
      : [],
  )
  return legalModuleVersions(legal).flatMap((module) => {
    const code = text(module.module_key)?.toLowerCase()
    const label = text(module.title)
    const documentReference = text(module.document_reference)
    const version = text(module.version)
    if (!code || !label || !documentReference || !version) return []
    const explicitlyRequired = boolean(legal[`${code}_required`])
    return [{
      requirement_code: code,
      acceptance_type: 'checkbox',
      required: requiredModules.has(code) || explicitlyRequired === true,
      label,
      document_reference: documentReference,
      document_version: version,
      document_hash: text(module.content_sha256),
      public_url: text(module.url),
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
  const type = text(row.contract_type ?? row.contractType ?? row.type)
  const energyDirection = text(row.energy_direction ?? row.energyDirection ?? pricing.energy_direction ?? pricing.energyDirection)
  const channel = text(row.channel)
  const canonicalCustomerType = text(row.customer_type) as PublicContractPriceOptionCustomerType | null
  const canonicalTypes = new Set(['fixed', 'variable_monthly', 'variable_hourly', 'variable_quarterly', 'portfolio', 'mixed'])
  if (!offerReference || !name || !type || !canonicalTypes.has(type)) return null
  if (energyDirection !== 'consumption' && energyDirection !== 'production') return null
  if (channel && channel !== 'website') return null
  if (canonicalCustomerType && !['private', 'business', 'both'].includes(canonicalCustomerType)) return null
  const canonicalProductionPricing = normalizeProductionPricing(
    row.production_pricing ?? row.productionPricing ?? pricing.production_pricing ?? pricing.productionPricing,
  )
  if (energyDirection === 'production' && !canonicalProductionPricing) return null

  const canonicalPriceOptions = priceOptions(row.price_options)
  if (!canonicalPriceOptions) return null

  const canonicalAreaPrices = canonicalPriceOptions.flatMap((option) => option.area_prices)
  const canonicalPriceAreas = [...new Set(canonicalAreaPrices.map((areaPrice) => areaPrice.price_area))]
  const publishedPriceAreas = normalizedPriceAreas(row.price_areas ?? row.priceAreas)
  const publishedAreaPricing = areaPricing(
    row.area_pricing ?? row.areaPricing ?? pricing.area_pricing ?? pricing.areaPricing,
  )
  const canonicalAreaPricing: PublicAreaPricing[] = canonicalAreaPrices.map((areaPrice) => ({
    price_area_code: areaPrice.price_area,
    fixed_price_ore_per_kwh: areaPrice.energy_price_ore_per_kwh,
    vat_included: null,
    vat_rate: null,
  }))
  const termsDocument = legalModule(legal, ['terms'])
  const privacyDocument = legalModule(legal, ['privacy_policy', 'privacy'])
  const withdrawalDocument = legalModule(legal, ['withdrawal', 'cancellation_right'])
  const powerOfAttorneyDocument = legalModule(legal, ['power_of_attorney', 'poa'])
  const priceTermsDocument = legalModule(legal, ['price_terms'])
  const normalizedLegalModules = normalizedLegalModuleVersions(legal)

  const canonicalCalculation = pricingComponents(pricing.calculation_components ?? pricing.calculationComponents, 'hidden')
  const legacyComponents = pricingComponents(pricingComponentSource(row, pricing), 'hidden')
  const calculationComponents = canonicalCalculation.length ? canonicalCalculation : legacyComponents
  const displayComponents = pricingComponents(pricing.display_components ?? pricing.displayComponents, 'visible')
  const summaryComponents = pricingComponents(pricing.summary_components ?? pricing.summaryComponents, 'summary_only')
  const components = calculationComponents
  const componentAmount = (key: CanonicalPublishedPricingKey): number | null =>
    calculationPricingComponentAmount(components, key)

  return {
    offer_reference: offerReference,
    product_code: productCode,
    name,
    contract_type: type as PublicContractApiShape['contract_type'],
    type: type as PublicContractApiShape['type'],
    energy_direction: energyDirection,
    channel: 'website',
    customer_type: canonicalCustomerType ?? canonicalPriceOptions[0].customer_type,
    production_pricing: canonicalProductionPricing,
    customer_types: normalizedCustomerTypes(row) ?? (
      canonicalCustomerType === 'both'
        ? ['private', 'business']
        : [canonicalCustomerType ?? canonicalPriceOptions[0].customer_type]
    ),
    price_areas: publishedPriceAreas.length ? publishedPriceAreas : canonicalPriceAreas,
    area_pricing: publishedAreaPricing.length ? publishedAreaPricing : canonicalAreaPricing,
    pricing_visibility: pricingVisibility(pricing.visibility),
    pricing_components: components,
    calculation_components: calculationComponents,
    display_components: displayComponents,
    summary_components: summaryComponents,
    price_options: canonicalPriceOptions,
    legal_requirements: legalRequirements(row, legal),
    legal: {
      legal_bundle_reference: text(legal.legal_bundle_reference),
      legal_bundle_version_id: text(legal.legal_bundle_version_id),
      immutable: boolean(legal.immutable) === true,
      module_versions: normalizedLegalModules,
    },
    portfolio_monthly_prices: portfolioMonthlyPrices(
      pricing.portfolio_monthly_prices ?? pricing.portfolioMonthlyPrices,
    ),
    monthly_fee_sek: componentAmount('monthly_fee_sek') ?? amount(pricing.monthly_fee ?? pricing.monthlyFee ?? row.monthly_fee_sek),
    invoice_fee_sek: componentAmount('invoice_fee_sek') ?? amount(pricing.invoice_fee ?? pricing.invoiceFee ?? row.invoice_fee_sek),
    markup_ore_per_kwh: componentAmount('markup_ore_per_kwh') ?? amount(pricing.markup ?? pricing.markup_ore_per_kwh ?? row.markup_ore_per_kwh),
    variable_markup_ore_per_kwh: componentAmount('variable_markup_ore_per_kwh') ?? amount(
      pricing.variable_markup ?? pricing.variable_fee ?? pricing.variable_markup_ore_per_kwh ?? row.variable_markup_ore_per_kwh,
    ),
    fixed_price_ore_per_kwh: componentAmount('fixed_price_ore_per_kwh') ?? amount(pricing.fixed_price ?? pricing.fixed_price_ore_per_kwh ?? row.fixed_price_ore_per_kwh),
    monthly_fixed_price_sek: componentAmount('monthly_fixed_price_sek') ?? amount(
      pricing.monthly_fixed_price ??
        pricing.monthlyFixedPrice ??
        pricing.monthly_price ??
        pricing.monthlyPrice ??
        row.monthly_fixed_price_sek ??
        row.monthlyFixedPriceSek ??
        row.monthly_price_sek,
    ),
    elcert_ore_per_kwh: componentAmount('elcert_ore_per_kwh') ?? amount(pricing.elcert ?? pricing.elcert_ore_per_kwh ?? row.elcert_ore_per_kwh),
    portfolio_price_ore_per_kwh: componentAmount('portfolio_price_ore_per_kwh') ?? amount(
      pricing.portfolio_price ??
        pricing.portfolioPrice ??
        pricing.portfolio_price_ore_per_kwh ??
        row.portfolio_price_ore_per_kwh,
    ),
    vat_rate: componentAmount('vat_rate') ?? number(pricing.vat_rate ?? pricing.vatRate ?? row.vat_rate ?? row.vatRate),
    pricing_model: text(pricing.pricing_model ?? pricing.pricingModel ?? row.pricing_model ?? row.pricingModel),
    spot_share: normalizedShare(componentAmount('spot_share')) ?? normalizedShare(pricing.spot_share ?? pricing.spotShare ?? row.spot_share),
    portfolio_share: normalizedShare(componentAmount('portfolio_share')) ?? normalizedShare(pricing.portfolio_share ?? pricing.portfolioShare ?? row.portfolio_share),
    binding_months: number(row.binding_months ?? row.bindingMonths ?? row.binding_period_months ?? row.bindingPeriodMonths),
    notice_months: number(row.notice_months ?? row.noticeMonths ?? row.notice_period_months ?? row.noticePeriodMonths),
    automatic_renewal: boolean(row.automatic_renewal ?? row.automaticRenewal),
    valid_from: text(row.valid_from ?? row.validFrom),
    valid_to: text(row.valid_to ?? row.validTo),
    terms_version: text(legal.terms_version ?? legal.termsVersion ?? termsDocument?.version ?? row.terms_version),
    terms_version_id: text(legal.terms_version_id ?? legal.termsVersionId ?? termsDocument?.id ?? row.terms_version_id ?? row.termsVersionId),
    terms_url: text(legal.terms_url ?? legal.termsUrl ?? termsDocument?.url ?? row.terms_url ?? row.termsUrl),
    privacy_policy_version: text(legal.privacy_policy_version ?? legal.privacyPolicyVersion ?? privacyDocument?.version ?? row.privacy_policy_version),
    privacy_policy_version_id: text(
      legal.privacy_policy_version_id ??
        legal.privacyPolicyVersionId ??
        privacyDocument?.id ??
        row.privacy_policy_version_id ??
        row.privacyPolicyVersionId,
    ),
    privacy_policy_url: text(
      legal.privacy_policy_url ?? legal.privacyPolicyUrl ?? privacyDocument?.url ?? row.privacy_policy_url ?? row.privacyPolicyUrl,
    ),
    withdrawal_version: text(
      legal.withdrawal_version ?? legal.withdrawalVersion ?? legal.cancellation_right_version ?? withdrawalDocument?.version ?? row.withdrawal_version,
    ),
    withdrawal_version_id: text(
      legal.withdrawal_version_id ??
        legal.withdrawalVersionId ??
        legal.cancellation_right_version_id ??
        legal.cancellationRightVersionId ??
        withdrawalDocument?.id ??
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
        withdrawalDocument?.url ??
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
        powerOfAttorneyDocument?.version ??
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
        powerOfAttorneyDocument?.id ??
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
        powerOfAttorneyDocument?.url ??
        row.power_of_attorney_url ??
        row.powerOfAttorneyUrl ??
        row.power_of_attorney_text_url ??
        row.powerOfAttorneyTextUrl ??
        row.poa_url ??
        row.poaUrl,
    ),
    price_terms_version: text(legal.price_terms_version ?? legal.priceTermsVersion ?? priceTermsDocument?.version ?? row.price_terms_version),
    price_terms_version_id: text(
      legal.price_terms_version_id ?? legal.priceTermsVersionId ?? priceTermsDocument?.id ?? row.price_terms_version_id ?? row.priceTermsVersionId,
    ),
    price_terms_url: text(legal.price_terms_url ?? legal.priceTermsUrl ?? priceTermsDocument?.url ?? row.price_terms_url ?? row.priceTermsUrl),
  }
}
