import type { OpsPublicContract } from '@/lib/ops/client'
import {
  isPublicLegalAcceptanceCode,
} from '@/lib/website/publicContractContract'
import {
  isFixedContractType,
  sanitizePricingComponentsBeforeAreaResolution,
} from '@/lib/website/publicPricingVisibility'

export type PublicContractDisplayRow = {
  key: string
  label: string
  value: number | string
  formatted: string
  unit?: 'sek_month' | 'sek_invoice' | 'ore_kwh' | 'months' | 'days' | 'percent' | 'sek'
}

export type PublicContractDisplay = {
  ready: boolean
  blockedReasons: string[]
  offerReference: string
  ctaHref: string
  typeLabel: string
  headline: string
  description: string
  rows: PublicContractDisplayRow[]
  included: string[]
  excluded: string[]
  legalVersions: {
    terms: string | null
    termsVersionId: string | null
    termsUrl: string | null
    privacyPolicy: string | null
    privacyPolicyVersionId: string | null
    privacyPolicyUrl: string | null
    cancellationRight: string | null
    withdrawalVersionId: string | null
    withdrawalUrl: string | null
    powerOfAttorney: string | null
    powerOfAttorneyVersionId: string | null
    powerOfAttorneyUrl: string | null
    powerOfAttorneyRequired: boolean
    priceTerms: string | null
    priceTermsVersionId: string | null
    priceTermsUrl: string | null
  }
  snapshot: Record<string, unknown>
}

export function hasDisplayValue(value: unknown): value is number | string {
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value === 'string') return value.trim().length > 0
  return false
}

export function hasNumberValue(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function formatSekMonth(value: number): string {
  return `${value.toLocaleString('sv-SE', { maximumFractionDigits: 2 })} kr/mån`
}

export function formatSekInvoice(value: number): string {
  return `${value.toLocaleString('sv-SE', { maximumFractionDigits: 2 })} kr/faktura`
}

export function formatOreKwh(value: number): string {
  return `${value.toLocaleString('sv-SE', { maximumFractionDigits: 4 })} öre/kWh`
}

export function formatMonths(value: number): string {
  return `${value.toLocaleString('sv-SE')} mån`
}

export function formatDays(value: number): string {
  return `${value.toLocaleString('sv-SE')} dagar`
}

export function formatPercent(value: number): string {
  const percent = value >= 0 && value <= 1 ? value * 100 : value
  return `${percent.toLocaleString('sv-SE', { maximumFractionDigits: 2 })} %`
}

export function publicContractTypeLabel(type: string | null | undefined): string {
  switch (type) {
    case 'variable_spot':
    case 'variable_monthly':
    case 'spot_monthly':
      return 'Rörligt månadspris'
    case 'variable_hourly':
    case 'spot_hourly':
      return 'Timpris'
    case 'variable_quarterly':
    case 'spot_quarterly':
    case 'quarter_hourly':
      return 'Kvartspris'
    case 'portfolio':
    case 'portfolio_managed':
      return 'Förvaltat avtal'
    case 'fixed':
      return 'Fast pris'
    case 'mix':
    case 'mixed':
      return 'Mixavtal'
    case 'monthly_fixed':
    case 'fixed_monthly':
      return 'Fast månadspris'
    default:
      return 'Elavtal'
  }
}

function addNumberRow(
  rows: PublicContractDisplayRow[],
  key: string,
  label: string,
  value: number | null | undefined,
  unit: PublicContractDisplayRow['unit'],
): void {
  if (!hasNumberValue(value)) return
  const formatted =
    unit === 'sek_month'
      ? formatSekMonth(value)
      : unit === 'sek_invoice'
        ? formatSekInvoice(value)
        : unit === 'ore_kwh'
          ? formatOreKwh(value)
          : unit === 'months'
            ? formatMonths(value)
          : unit === 'days'
            ? formatDays(value)
            : unit === 'sek'
              ? `${value.toLocaleString('sv-SE', { maximumFractionDigits: 2 })} kr`
            : unit === 'percent'
                ? formatPercent(value)
                : String(value)

  rows.push({ key, label, value, formatted, unit })
}

function legalUrlReady(value: string | null | undefined): boolean {
  if (!value) return false
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

function componentUnit(unit: string): PublicContractDisplayRow['unit'] | null {
  switch (unit.toLowerCase()) {
    case 'ore_per_kwh':
    case 'öre_per_kwh':
      return 'ore_kwh'
    case 'sek_per_month':
    case 'sek_month':
      return 'sek_month'
    case 'sek_per_invoice':
    case 'sek_invoice':
      return 'sek_invoice'
    case 'percent':
    case 'percentage':
      return 'percent'
    case 'sek':
      return 'sek'
    default:
      return null
  }
}

function publiclyVisibleInvoiceFee(): number | null {
  // Business rule: invoice_fee is calculation-only and must never be exposed
  // as a customer-facing row, regardless of a legacy visibility alias.
  return null
}

function addPublishedComponents(rows: PublicContractDisplayRow[], contract: OpsPublicContract): boolean {
  const displaySource = contract.display_components?.length
    ? contract.display_components
    : contract.pricing_components
  const hidesHistoricalPortfolioPrice = contract.type === 'portfolio' || contract.type === 'portfolio_managed' || contract.type === 'mix' || contract.type === 'mixed'
  const components = sanitizePricingComponentsBeforeAreaResolution(
    displaySource,
    contract.type,
  ).filter((item) => {
    const code = item.component_code.toLowerCase()
    return item.website_visibility === 'visible' &&
      code !== 'invoice_fee' &&
      !(hidesHistoricalPortfolioPrice && /portfolio.*price|managed.*price|portfolj.*pris/.test(code))
  })
  for (const component of components) {
    const unit = componentUnit(component.unit)
    if (!unit) {
      rows.push({
        key: component.component_code,
        label: component.name,
        value: component.amount,
        formatted: `${component.amount.toLocaleString('sv-SE', { maximumFractionDigits: 4 })} ${component.unit}`,
      })
      continue
    }
    const before = rows.length
    addNumberRow(rows, component.component_code, component.name, component.amount, unit)
    if (rows.length > before && component.calculation_base) {
      const current = rows[rows.length - 1]
      current.formatted = `${current.formatted} · bas: ${component.calculation_base}`
    }
  }
  return components.length > 0
}

function addTextRow(
  rows: PublicContractDisplayRow[],
  key: string,
  label: string,
  value: string | null | undefined,
): void {
  if (!hasDisplayValue(value)) return
  rows.push({ key, label, value: value.trim(), formatted: value.trim() })
}

function defaultDescription(contract: OpsPublicContract): string {
  const own = contract.short_description?.trim() || contract.marketing_description?.trim()
  if (own) return own

  switch (contract.type) {
    case 'variable_spot':
    case 'variable_monthly':
    case 'spot_monthly':
      return contract.energy_direction === 'production'
        ? 'Ersättning för din elproduktion med månadsvis avräkning enligt avtalet.'
        : 'För dig som vill ha ett rörligt månadspris baserat på publicerad spotdata.'
    case 'variable_hourly':
    case 'spot_hourly':
      return contract.energy_direction === 'production'
        ? 'Ersättning för din elproduktion med timvis avräkning enligt avtalet.'
        : 'För dig som vill följa spotmarknaden timme för timme.'
    case 'variable_quarterly':
    case 'spot_quarterly':
    case 'quarter_hourly':
      return contract.energy_direction === 'production'
        ? 'Ersättning för din elproduktion med kvartsvis avräkning enligt avtalet.'
        : 'För dig som vill följa spotmarknaden kvart för kvart.'
    case 'portfolio':
    case 'portfolio_managed':
      return 'För dig som vill ha ett förvaltat upplägg med tydlig risk- och prisinformation.'
    case 'fixed':
      return 'För dig som vill ha ett fast elpris och mer förutsägbar kostnad.'
    case 'monthly_fixed':
    case 'fixed_monthly':
      return 'För dig som vill ha ett fast månadspris enligt valt avtal.'
    case 'mix':
    case 'mixed':
      return 'För dig som vill kombinera rörligt pris med förvaltad prissäkring.'
    default:
      return 'Ett publicerat elavtal med tydliga avgifter och villkor.'
  }
}

function addProductionPricingRows(
  rows: PublicContractDisplayRow[],
  contract: OpsPublicContract,
): void {
  const pricing = contract.production_pricing
  if (contract.energy_direction !== 'production' || !pricing) return

  const compensationOre = pricing.compensation_ore_per_kwh
    ?? pricing.fixed_compensation_ore_per_kwh
    ?? (pricing.compensation_sek_per_kwh == null ? null : pricing.compensation_sek_per_kwh * 100)
  addNumberRow(rows, 'production_compensation_ore_per_kwh', 'Ersättning', compensationOre, 'ore_kwh')
  addNumberRow(rows, 'production_premium_ore_per_kwh', 'Premie', pricing.premium_ore_per_kwh, 'ore_kwh')
  addNumberRow(rows, 'production_deduction_ore_per_kwh', 'Avdrag', pricing.deduction_ore_per_kwh, 'ore_kwh')

  const resolutionLabel = pricing.resolution === 'monthly'
    ? 'Månadsvis'
    : pricing.resolution === 'hourly'
      ? 'Timvis'
      : 'Kvartsvis'
  addTextRow(rows, 'production_resolution', 'Avräkning', resolutionLabel)
  addTextRow(
    rows,
    'production_settlement_mode',
    'Utbetalning',
    pricing.settlement_mode === 'self_billing' ? 'Självfakturering' : 'Kreditfaktura',
  )
}

function stringList(value: unknown, fallback: string[]): string[] {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean)
  if (typeof value === 'string' && value.trim()) return [value.trim()]
  return fallback
}

function validatePublishedNumber(
  blockedReasons: string[],
  contract: OpsPublicContract,
  key: keyof OpsPublicContract,
  label: string,
): void {
  const value = contract[key]
  if (value === null || value === undefined) return
  if (!hasNumberValue(value) || value < 0) blockedReasons.push(`${label} är ogiltigt`)
}

function normalizedShare(value: unknown): number | null {
  if (!hasNumberValue(value)) return null
  return value > 1 ? value / 100 : value
}

function validatePublicPricingForType(blockedReasons: string[], contract: OpsPublicContract): void {
  for (const [key, label] of [
    ['monthly_fee_sek', 'månadsavgift'],
    ['invoice_fee_sek', 'fakturaavgift'],
    ['markup_ore_per_kwh', 'påslag'],
    ['variable_markup_ore_per_kwh', 'rörlig avgift'],
    ['elcert_ore_per_kwh', 'elcertifikat'],
    ['fixed_price_ore_per_kwh', 'fast kWh-pris'],
    ['portfolio_price_ore_per_kwh', 'portföljpris'],
    ['monthly_fixed_price_sek', 'fast månadspris'],
  ] as const) {
    validatePublishedNumber(blockedReasons, contract, key, label)
  }

  if (contract.type === 'mix' || contract.type === 'mixed') {
    const spotShare = normalizedShare(contract.spot_share)
    const portfolioShare = normalizedShare(contract.portfolio_share)
    if (spotShare !== null && (spotShare < 0 || spotShare > 1)) {
      blockedReasons.push('rörlig andel är ogiltig')
    }
    if (portfolioShare !== null && (portfolioShare < 0 || portfolioShare > 1)) {
      blockedReasons.push('portföljandel är ogiltig')
    }
    if (spotShare !== null && portfolioShare !== null && spotShare + portfolioShare <= 0) {
      blockedReasons.push('mixandelar är ogiltiga')
    }
  }
}

function addNoticePeriodRow(
  rows: PublicContractDisplayRow[],
  contract: OpsPublicContract,
): void {
  if (hasNumberValue(contract.notice_period_months)) {
    addNumberRow(rows, 'notice_period_months', 'Uppsägningstid', contract.notice_period_months, 'months')
    return
  }
  addNumberRow(rows, 'notice_period_days', 'Uppsägningstid', contract.notice_period_days, 'days')
}

function addAutomaticRenewalRow(
  rows: PublicContractDisplayRow[],
  contract: OpsPublicContract,
): void {
  if (contract.automatic_renewal !== true) return
  rows.push({
    key: 'automatic_renewal',
    label: 'Automatisk förlängning',
    value: 'Ja',
    formatted: 'Ja',
  })
}

/**
 * OPS filters publication state, active price versions and published legal text
 * before a contract reaches this website. The website validates only the public
 * DTO it was promised, never OPS-internal IDs or duplicate publication flags.
 */
export function buildPublicContractDisplay(contract: OpsPublicContract): PublicContractDisplay {
  const rows: PublicContractDisplayRow[] = []
  const typeLabel = publicContractTypeLabel(contract.type)
  const blockedReasons: string[] = []

  if (!contract.offer_reference) blockedReasons.push('offer_reference saknas')
  if (!contract.name) blockedReasons.push('namn saknas')
  if (!contract.type) blockedReasons.push('avtalstyp saknas')
  if (contract.energy_direction !== 'consumption' && contract.energy_direction !== 'production') {
    blockedReasons.push('energiriktning saknas eller är ogiltig')
  }
  if (contract.energy_direction === 'production' && !contract.production_pricing) {
    blockedReasons.push('produktionsprissättning saknas')
  }
  // OPS public-contracts is the publication source of truth. An empty
  // legal.requirements array is a valid published contract: it means that this
  // exact legal bundle has no customer checkboxes. Only validate requirements
  // that OPS actually publishes; never invent a local minimum count.
  const legalRequirements = contract.legal_requirements ?? []
  for (const requirement of legalRequirements) {
    if (!requirement.required) continue
    if (!requirement.requirement_code) blockedReasons.push('juridikkrav saknar kod')
    else if (!isPublicLegalAcceptanceCode(requirement.requirement_code)) {
      blockedReasons.push(`${requirement.requirement_code}: stöds inte av kundansökans OpenAPI-schema`)
    }
    if (requirement.acceptance_type !== 'checkbox') blockedReasons.push(`${requirement.requirement_code}: acceptance_type stöds inte`)
    if (!requirement.document_version) blockedReasons.push(`${requirement.requirement_code}: dokumentversion saknas`)
    if (!requirement.document_id && !requirement.legal_bundle_version_document_id) {
      blockedReasons.push(`${requirement.requirement_code}: juridiskt dokument-ID saknas`)
    }
    if (!legalUrlReady(requirement.public_url)) blockedReasons.push(`${requirement.requirement_code}: publicerad dokumentlänk saknas`)
  }
  validatePublicPricingForType(blockedReasons, contract)

  const now = Date.now()
  if (contract.valid_from) {
    const from = Date.parse(contract.valid_from)
    if (Number.isFinite(from) && from > now) blockedReasons.push('gäller från framtida datum')
  }
  if (contract.valid_to) {
    const to = Date.parse(contract.valid_to)
    if (Number.isFinite(to) && to < now) blockedReasons.push('avtalet har passerat slutdatum')
  }

  const requiresPriceArea = isFixedContractType(contract.type)
  if (requiresPriceArea) {
    addTextRow(rows, 'area_price_notice', 'Fast elpris', 'Ange adress för att se priset i ditt elområde')
  }

  const usesPublishedComponents = addPublishedComponents(rows, contract)
  addProductionPricingRows(rows, contract)

  if (usesPublishedComponents) {
    addNumberRow(rows, 'binding_period_months', 'Bindningstid', contract.binding_period_months, 'months')
    addNoticePeriodRow(rows, contract)
  } else if (contract.energy_direction === 'production') {
    addNumberRow(rows, 'binding_period_months', 'Bindningstid', contract.binding_period_months, 'months')
    addNoticePeriodRow(rows, contract)
  } else if (contract.type === 'monthly_fixed' || contract.type === 'fixed_monthly' || contract.monthly_fixed_price_sek != null) {
    addNumberRow(rows, 'monthly_fixed_price_sek', 'Fast månadspris', contract.monthly_fixed_price_sek, 'sek_month')
    addNumberRow(rows, 'binding_period_months', 'Bindningstid', contract.binding_period_months, 'months')
    addNumberRow(rows, 'invoice_fee_sek', 'Fakturaavgift', publiclyVisibleInvoiceFee(), 'sek_invoice')
    addNoticePeriodRow(rows, contract)
  } else if (contract.type === 'fixed') {
    addNumberRow(rows, 'elcert_ore_per_kwh', 'Elcertifikat', contract.elcert_ore_per_kwh, 'ore_kwh')
    addNumberRow(rows, 'binding_period_months', 'Bindningstid', contract.binding_period_months, 'months')
    addNumberRow(rows, 'monthly_fee_sek', 'Månadsavgift', contract.monthly_fee_sek, 'sek_month')
    addNumberRow(rows, 'invoice_fee_sek', 'Fakturaavgift', publiclyVisibleInvoiceFee(), 'sek_invoice')
    addNoticePeriodRow(rows, contract)
  } else if (contract.type === 'portfolio' || contract.type === 'portfolio_managed') {
    if (!hasNumberValue(contract.portfolio_price_ore_per_kwh)) {
      addTextRow(rows, 'area_price_notice', 'Portföljpris', 'Visas efter adress och elområde')
    }
    addNumberRow(rows, 'markup_ore_per_kwh', 'Förvaltningsavgift/påslag', contract.markup_ore_per_kwh, 'ore_kwh')
    addNumberRow(rows, 'variable_markup_ore_per_kwh', 'Rörlig avgift', contract.variable_markup_ore_per_kwh, 'ore_kwh')
    addNumberRow(rows, 'monthly_fee_sek', 'Månadsavgift', contract.monthly_fee_sek, 'sek_month')
    addNumberRow(rows, 'invoice_fee_sek', 'Fakturaavgift', publiclyVisibleInvoiceFee(), 'sek_invoice')
    addNoticePeriodRow(rows, contract)
  } else if (contract.type === 'mix' || contract.type === 'mixed') {
    addTextRow(rows, 'start_info', 'Upplägg', contract.start_info)
    if (!hasNumberValue(contract.spot_share) && !hasNumberValue(contract.portfolio_share)) {
      addTextRow(rows, 'mix_share_notice', 'Fördelning', 'Visas i prisberäkningen')
    }
    if (!hasNumberValue(contract.portfolio_price_ore_per_kwh)) {
      addTextRow(rows, 'area_price_notice', 'Portföljdelens pris', 'Visas efter adress och elområde')
    }
    addNumberRow(rows, 'spot_share', 'Rörlig andel', contract.spot_share, 'percent')
    addNumberRow(rows, 'portfolio_share', 'Portföljandel', contract.portfolio_share, 'percent')
    addNumberRow(rows, 'markup_ore_per_kwh', 'Påslag', contract.markup_ore_per_kwh, 'ore_kwh')
    addNumberRow(rows, 'variable_markup_ore_per_kwh', 'Rörlig avgift', contract.variable_markup_ore_per_kwh, 'ore_kwh')
    addNumberRow(rows, 'elcert_ore_per_kwh', 'Elcertifikat', contract.elcert_ore_per_kwh, 'ore_kwh')
    addNumberRow(rows, 'monthly_fee_sek', 'Månadsavgift', contract.monthly_fee_sek, 'sek_month')
    addNumberRow(rows, 'invoice_fee_sek', 'Fakturaavgift', publiclyVisibleInvoiceFee(), 'sek_invoice')
  } else {
    addNumberRow(rows, 'markup_ore_per_kwh', 'Påslag', contract.markup_ore_per_kwh, 'ore_kwh')
    addNumberRow(rows, 'variable_markup_ore_per_kwh', 'Rörlig avgift', contract.variable_markup_ore_per_kwh, 'ore_kwh')
    addNumberRow(rows, 'monthly_fee_sek', 'Månadsavgift', contract.monthly_fee_sek, 'sek_month')
    addNumberRow(rows, 'invoice_fee_sek', 'Fakturaavgift', publiclyVisibleInvoiceFee(), 'sek_invoice')
    addNoticePeriodRow(rows, contract)
  }

  addAutomaticRenewalRow(rows, contract)

  if (!usesPublishedComponents && Object.keys(contract.pricing_visibility ?? {}).length > 0) {
    const aliases: Record<string, string[]> = {
      monthly_fee_sek: ['monthly_fee', 'monthlyFee', 'monthly_fee_sek'],
      invoice_fee_sek: ['invoice_fee', 'invoiceFee', 'invoice_fee_sek'],
      markup_ore_per_kwh: ['markup', 'supplier_markup', 'markup_ore_per_kwh'],
      variable_markup_ore_per_kwh: ['variable_markup', 'variable_fee', 'variable_markup_ore_per_kwh'],
      elcert_ore_per_kwh: ['elcert', 'electricity_certificate', 'elcert_ore_per_kwh'],
      fixed_price_ore_per_kwh: ['fixed_price', 'fixed_price_ore_per_kwh'],
      portfolio_price_ore_per_kwh: ['portfolio_price', 'portfolio_price_ore_per_kwh'],
      monthly_fixed_price_sek: ['monthly_fixed_price', 'monthly_fixed_price_sek'],
      spot_share: ['spot_share'],
      portfolio_share: ['portfolio_share'],
    }
    const visibility = contract.pricing_visibility ?? {}
    const visibleRows = rows.filter((row) => {
      const keys = aliases[row.key]
      if (!keys) return true
      const published = keys.find((key) => Object.prototype.hasOwnProperty.call(visibility, key))
      return published ? visibility[published] !== false : true
    })
    rows.splice(0, rows.length, ...visibleRows)
  }

  const includedFallback = contract.energy_direction === 'production'
    ? ['Ersättning för inmatad el', 'Avräkning enligt avtalet', 'Kundkommunikation']
    : ['Elhandelsavtal', 'Avtalsadministration', 'Kundkommunikation']
  const excludedFallback = contract.energy_direction === 'production'
    ? ['Elnätsavgifter och nätägarens avgifter ingår inte.']
    : ['Elnätsavgifter och nätägarens avgifter ingår inte.']
  const included = stringList(contract.included, includedFallback)
  const excluded = stringList(contract.excluded, excludedFallback)
  const legalVersions = {
    terms: contract.terms_version ?? null,
    terms_version_id: contract.terms_version_id ?? null,
    terms_url: contract.terms_url ?? null,
    privacy_policy: contract.privacy_policy_version ?? null,
    privacy_policy_version_id: contract.privacy_policy_version_id ?? null,
    privacy_policy_url: contract.privacy_policy_url ?? null,
    withdrawal: contract.withdrawal_version ?? contract.cancellation_right_version ?? null,
    withdrawal_version_id: contract.withdrawal_version_id ?? null,
    withdrawal_url: contract.withdrawal_url ?? null,
    cancellation_right: contract.cancellation_right_version ?? contract.withdrawal_version ?? null,
    power_of_attorney: contract.power_of_attorney_version ?? null,
    power_of_attorney_version_id: contract.power_of_attorney_version_id ?? null,
    power_of_attorney_url: contract.power_of_attorney_url ?? null,
    power_of_attorney_required: contract.power_of_attorney_required === true,
    price_terms: contract.price_terms_version ?? null,
    price_terms_version_id: contract.price_terms_version_id ?? null,
    price_terms_url: contract.price_terms_url ?? null,
  }

  const snapshot = {
    offer_reference: contract.offer_reference,
    code: contract.product_code ?? null,
    name: contract.name,
    type: contract.type,
    energy_direction: contract.energy_direction,
    production_pricing: contract.production_pricing,
    pricing_model: contract.pricing_model ?? null,
    type_label: typeLabel,
    displayed_rows: rows.map((row) => ({
      key: row.key,
      label: row.label,
      value: row.value,
      formatted: row.formatted,
      unit: row.unit ?? null,
    })),
    included,
    excluded,
    legal_versions: legalVersions,
    valid_from: contract.valid_from ?? null,
    valid_to: contract.valid_to ?? null,
    binding_period_months: contract.binding_period_months ?? null,
    notice_period_months: contract.notice_period_months ?? null,
    notice_period_days: contract.notice_period_days ?? null,
    automatic_renewal: contract.automatic_renewal ?? null,
  }

  return {
    ready: blockedReasons.length === 0,
    blockedReasons,
    offerReference: contract.offer_reference,
    ctaHref: `/teckna-avtal?offer=${encodeURIComponent(contract.offer_reference)}`,
    typeLabel,
    headline: contract.name,
    description: defaultDescription(contract),
    rows,
    included,
    excluded,
    legalVersions: {
      terms: legalVersions.terms,
      termsVersionId: legalVersions.terms_version_id,
      termsUrl: legalVersions.terms_url,
      privacyPolicy: legalVersions.privacy_policy,
      privacyPolicyVersionId: legalVersions.privacy_policy_version_id,
      privacyPolicyUrl: legalVersions.privacy_policy_url,
      cancellationRight: legalVersions.cancellation_right,
      withdrawalVersionId: legalVersions.withdrawal_version_id,
      withdrawalUrl: legalVersions.withdrawal_url,
      powerOfAttorney: legalVersions.power_of_attorney,
      powerOfAttorneyVersionId: legalVersions.power_of_attorney_version_id,
      powerOfAttorneyUrl: legalVersions.power_of_attorney_url,
      powerOfAttorneyRequired: legalVersions.power_of_attorney_required,
      priceTerms: legalVersions.price_terms,
      priceTermsVersionId: legalVersions.price_terms_version_id,
      priceTermsUrl: legalVersions.price_terms_url,
    },
    snapshot,
  }
}

export function isPublicContractReady(contract: OpsPublicContract): boolean {
  return buildPublicContractDisplay(contract).ready
}
