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
  pricePlanVersionId: string
  ctaHref: string
  typeLabel: string
  headline: string
  description: string
  rows: PublicContractDisplayRow[]
  included: string[]
  excluded: string[]
  legalVersions: {
    terms: string | null
    privacyPolicy: string | null
    cancellationRight: string | null
    powerOfAttorney: string | null
    priceTerms: string | null
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

export function buildPublicContractDisplay(contract: OpsPublicContract): PublicContractDisplay {
  const rows: PublicContractDisplayRow[] = []
  const typeLabel = publicContractTypeLabel(contract.type)
  const blockedReasons: string[] = []

  if (!contract.price_plan_id) blockedReasons.push('price_plan_id saknas')
  if (!contract.price_plan_version_id) blockedReasons.push('price_plan_version_id saknas')
  if (!contract.product_code) blockedReasons.push('product_code saknas')
  if (!contract.name) blockedReasons.push('namn saknas')
  if (!contract.type) blockedReasons.push('avtalstyp saknas')
  if (!contract.terms_version) blockedReasons.push('allmänna villkor saknas')
  if (!contract.privacy_policy_version) blockedReasons.push('integritetspolicy saknas')
  if (!contract.cancellation_right_version) blockedReasons.push('ångerrätt saknas')
  if (!contract.power_of_attorney_version) blockedReasons.push('fullmakt saknas')
  if (contract.is_public === false) blockedReasons.push('avtalet är inte publicerat')
  if (contract.is_active === false) blockedReasons.push('avtalet är inte aktivt')

  const now = Date.now()
  if (contract.valid_from) {
    const from = Date.parse(contract.valid_from)
    if (Number.isFinite(from) && from > now) blockedReasons.push('gäller från framtida datum')
  }
  if (contract.valid_to) {
    const to = Date.parse(contract.valid_to)
    if (Number.isFinite(to) && to < now) blockedReasons.push('avtalet har passerat slutdatum')
  }

  if (contract.type === 'fixed') {
    addNumberRow(rows, 'fixed_price_ore_per_kwh', 'Fast elpris', contract.fixed_price_ore_per_kwh, 'ore_kwh')
    addNumberRow(rows, 'binding_period_months', 'Bindningstid', contract.binding_period_months, 'months')
    addNumberRow(rows, 'monthly_fee_sek', 'Månadsavgift', contract.monthly_fee_sek, 'sek_month')
    addNumberRow(rows, 'invoice_fee_sek', 'Fakturaavgift', contract.invoice_fee_sek, 'sek_invoice')
    addNumberRow(rows, 'notice_period_days', 'Uppsägningstid', contract.notice_period_days, 'days')
  } else if (contract.type === 'portfolio' || contract.type === 'portfolio_managed') {
    addNumberRow(rows, 'markup_ore_per_kwh', 'Förvaltningsavgift/påslag', contract.markup_ore_per_kwh, 'ore_kwh')
    addNumberRow(rows, 'variable_markup_ore_per_kwh', 'Rörlig avgift', contract.variable_markup_ore_per_kwh, 'ore_kwh')
    addNumberRow(rows, 'monthly_fee_sek', 'Månadsavgift', contract.monthly_fee_sek, 'sek_month')
    addNumberRow(rows, 'invoice_fee_sek', 'Fakturaavgift', contract.invoice_fee_sek, 'sek_invoice')
    addNumberRow(rows, 'notice_period_days', 'Uppsägningstid', contract.notice_period_days, 'days')
  } else if (contract.type === 'mix' || contract.type === 'mixed') {
    addTextRow(rows, 'start_info', 'Upplägg', contract.start_info)
    addNumberRow(rows, 'markup_ore_per_kwh', 'Påslag', contract.markup_ore_per_kwh, 'ore_kwh')
    addNumberRow(rows, 'variable_markup_ore_per_kwh', 'Rörlig avgift', contract.variable_markup_ore_per_kwh, 'ore_kwh')
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

  const snapshot = {
    contract_id: contract.contract_id ?? null,
    price_plan_id: contract.price_plan_id,
    price_plan_version_id: contract.price_plan_version_id,
    product_code: contract.product_code,
    name: contract.name,
    type: contract.type,
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
    legal_versions: {
      terms: contract.terms_version ?? null,
      privacy_policy: contract.privacy_policy_version ?? null,
      cancellation_right: contract.cancellation_right_version ?? null,
      power_of_attorney: contract.power_of_attorney_version ?? null,
      price_terms: contract.price_terms_version ?? null,
    },
    valid_from: contract.valid_from ?? null,
    valid_to: contract.valid_to ?? null,
  }

  return {
    ready: blockedReasons.length === 0,
    blockedReasons,
    pricePlanVersionId: contract.price_plan_version_id,
    ctaHref: `/teckna-avtal?planVersion=${encodeURIComponent(contract.price_plan_version_id)}`,
    typeLabel,
    headline: contract.name,
    description: defaultDescription(contract),
    rows,
    included,
    excluded,
    legalVersions: {
      terms: contract.terms_version ?? null,
      privacyPolicy: contract.privacy_policy_version ?? null,
      cancellationRight: contract.cancellation_right_version ?? null,
      powerOfAttorney: contract.power_of_attorney_version ?? null,
      priceTerms: contract.price_terms_version ?? null,
    },
    snapshot,
  }
}

export function isPublicContractReady(contract: OpsPublicContract): boolean {
  return buildPublicContractDisplay(contract).ready
}
