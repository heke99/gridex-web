import type { OpsPublicContract } from '@/lib/ops/client'

export type PublicContractDisplayRow = {
  key: string
  label: string
  value: number | string
  formatted: string
  unit?: 'sek_month' | 'sek_invoice' | 'ore_kwh' | 'months' | 'days' | 'percent'
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
    case 'spot_hourly':
      return 'Rörligt elpris'
    case 'portfolio':
    case 'portfolio_managed':
      return 'Förvaltat avtal'
    case 'fixed':
      return 'Fastpris'
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
              : unit === 'percent'
                ? formatPercent(value)
                : String(value)

  rows.push({ key, label, value, formatted, unit })
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
    case 'spot_hourly':
      return 'För dig som vill följa marknadspriset och se tydliga avgifter separat.'
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

function stringList(value: unknown, fallback: string[]): string[] {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean)
  if (typeof value === 'string' && value.trim()) return [value.trim()]
  return fallback
}

function requirePublishedPricing(
  blockedReasons: string[],
  contract: OpsPublicContract,
  key: keyof OpsPublicContract,
  label: string,
): void {
  const value = contract[key]
  if (!hasNumberValue(value)) {
    blockedReasons.push(`${label} saknas`)
    return
  }
  if (value < 0) blockedReasons.push(`${label} är ogiltigt`)
}

function requirePublicPricingForType(blockedReasons: string[], contract: OpsPublicContract): void {
  const type = contract.type
  const isMonthlyFixed = type === 'monthly_fixed' || type === 'fixed_monthly' || contract.monthly_fixed_price_sek != null

  if (isMonthlyFixed) {
    requirePublishedPricing(blockedReasons, contract, 'monthly_fixed_price_sek', 'fast månadspris')
    requirePublishedPricing(blockedReasons, contract, 'invoice_fee_sek', 'fakturaavgift')
    return
  }

  requirePublishedPricing(blockedReasons, contract, 'monthly_fee_sek', 'månadsavgift')
  requirePublishedPricing(blockedReasons, contract, 'invoice_fee_sek', 'fakturaavgift')

  if (type === 'fixed') {
    requirePublishedPricing(blockedReasons, contract, 'fixed_price_ore_per_kwh', 'fast kWh-pris')
    return
  }

  if (type === 'portfolio' || type === 'portfolio_managed') {
    requirePublishedPricing(blockedReasons, contract, 'portfolio_price_ore_per_kwh', 'portföljpris')
    requirePublishedPricing(blockedReasons, contract, 'markup_ore_per_kwh', 'påslag')
    return
  }

  if (type === 'mix' || type === 'mixed') {
    requirePublishedPricing(blockedReasons, contract, 'portfolio_price_ore_per_kwh', 'portföljpris')
    requirePublishedPricing(blockedReasons, contract, 'markup_ore_per_kwh', 'påslag')
    requirePublishedPricing(blockedReasons, contract, 'spot_share', 'rörlig andel')
    requirePublishedPricing(blockedReasons, contract, 'portfolio_share', 'portföljandel')
    return
  }

  requirePublishedPricing(blockedReasons, contract, 'markup_ore_per_kwh', 'påslag')
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
  if (!contract.terms_version) blockedReasons.push('allmänna villkor saknas')
  if (!contract.terms_version_id) blockedReasons.push('allmänna villkors juridiska ID saknas')
  if (!contract.privacy_policy_version) blockedReasons.push('integritetspolicy saknas')
  if (!contract.privacy_policy_version_id) blockedReasons.push('integritetspolicyns juridiska ID saknas')
  if (!contract.cancellation_right_version && !contract.withdrawal_version) blockedReasons.push('ångerrätt saknas')
  if (!contract.withdrawal_version_id) blockedReasons.push('ångerrättens juridiska ID saknas')
  if (!contract.price_terms_version) blockedReasons.push('prisvillkor saknas')
  if (!contract.price_terms_version_id) blockedReasons.push('prisvillkorens juridiska ID saknas')
  if (contract.power_of_attorney_required === true && !contract.power_of_attorney_version) {
    blockedReasons.push('fullmaktsversion saknas')
  }
  if (contract.power_of_attorney_required === true && !contract.power_of_attorney_version_id) {
    blockedReasons.push('fullmaktens juridiska ID saknas')
  }
  requirePublicPricingForType(blockedReasons, contract)

  const now = Date.now()
  if (contract.valid_from) {
    const from = Date.parse(contract.valid_from)
    if (Number.isFinite(from) && from > now) blockedReasons.push('gäller från framtida datum')
  }
  if (contract.valid_to) {
    const to = Date.parse(contract.valid_to)
    if (Number.isFinite(to) && to < now) blockedReasons.push('avtalet har passerat slutdatum')
  }

  if (contract.type === 'monthly_fixed' || contract.type === 'fixed_monthly' || contract.monthly_fixed_price_sek != null) {
    addNumberRow(rows, 'monthly_fixed_price_sek', 'Fast månadspris', contract.monthly_fixed_price_sek, 'sek_month')
    addNumberRow(rows, 'binding_period_months', 'Bindningstid', contract.binding_period_months, 'months')
    addNumberRow(rows, 'invoice_fee_sek', 'Fakturaavgift', contract.invoice_fee_sek, 'sek_invoice')
    addNumberRow(rows, 'notice_period_days', 'Uppsägningstid', contract.notice_period_days, 'days')
  } else if (contract.type === 'fixed') {
    addNumberRow(rows, 'fixed_price_ore_per_kwh', 'Fast elpris', contract.fixed_price_ore_per_kwh, 'ore_kwh')
    addNumberRow(rows, 'elcert_ore_per_kwh', 'Elcertifikat', contract.elcert_ore_per_kwh, 'ore_kwh')
    addNumberRow(rows, 'binding_period_months', 'Bindningstid', contract.binding_period_months, 'months')
    addNumberRow(rows, 'monthly_fee_sek', 'Månadsavgift', contract.monthly_fee_sek, 'sek_month')
    addNumberRow(rows, 'invoice_fee_sek', 'Fakturaavgift', contract.invoice_fee_sek, 'sek_invoice')
    addNumberRow(rows, 'notice_period_days', 'Uppsägningstid', contract.notice_period_days, 'days')
  } else if (contract.type === 'portfolio' || contract.type === 'portfolio_managed') {
    addNumberRow(rows, 'portfolio_price_ore_per_kwh', 'Portföljpris', contract.portfolio_price_ore_per_kwh, 'ore_kwh')
    addNumberRow(rows, 'markup_ore_per_kwh', 'Förvaltningsavgift/påslag', contract.markup_ore_per_kwh, 'ore_kwh')
    addNumberRow(rows, 'variable_markup_ore_per_kwh', 'Rörlig avgift', contract.variable_markup_ore_per_kwh, 'ore_kwh')
    addNumberRow(rows, 'monthly_fee_sek', 'Månadsavgift', contract.monthly_fee_sek, 'sek_month')
    addNumberRow(rows, 'invoice_fee_sek', 'Fakturaavgift', contract.invoice_fee_sek, 'sek_invoice')
    addNumberRow(rows, 'notice_period_days', 'Uppsägningstid', contract.notice_period_days, 'days')
  } else if (contract.type === 'mix' || contract.type === 'mixed') {
    addTextRow(rows, 'start_info', 'Upplägg', contract.start_info)
    addNumberRow(rows, 'spot_share', 'Rörlig andel', contract.spot_share, 'percent')
    addNumberRow(rows, 'portfolio_share', 'Portföljandel', contract.portfolio_share, 'percent')
    addNumberRow(rows, 'portfolio_price_ore_per_kwh', 'Portföljpris', contract.portfolio_price_ore_per_kwh, 'ore_kwh')
    addNumberRow(rows, 'markup_ore_per_kwh', 'Påslag', contract.markup_ore_per_kwh, 'ore_kwh')
    addNumberRow(rows, 'variable_markup_ore_per_kwh', 'Rörlig avgift', contract.variable_markup_ore_per_kwh, 'ore_kwh')
    addNumberRow(rows, 'elcert_ore_per_kwh', 'Elcertifikat', contract.elcert_ore_per_kwh, 'ore_kwh')
    addNumberRow(rows, 'monthly_fee_sek', 'Månadsavgift', contract.monthly_fee_sek, 'sek_month')
    addNumberRow(rows, 'invoice_fee_sek', 'Fakturaavgift', contract.invoice_fee_sek, 'sek_invoice')
  } else {
    addNumberRow(rows, 'markup_ore_per_kwh', 'Påslag', contract.markup_ore_per_kwh, 'ore_kwh')
    addNumberRow(rows, 'variable_markup_ore_per_kwh', 'Rörlig avgift', contract.variable_markup_ore_per_kwh, 'ore_kwh')
    addNumberRow(rows, 'monthly_fee_sek', 'Månadsavgift', contract.monthly_fee_sek, 'sek_month')
    addNumberRow(rows, 'invoice_fee_sek', 'Fakturaavgift', contract.invoice_fee_sek, 'sek_invoice')
    addNumberRow(rows, 'notice_period_days', 'Uppsägningstid', contract.notice_period_days, 'days')
  }

  const included = stringList(contract.included, ['Elhandelsavtal', 'Avtalsadministration', 'Kundkommunikation'])
  const excluded = stringList(contract.excluded, ['Elnätsavgift', 'Eventuell effektavgift', 'Avgifter från nätägaren'])
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
