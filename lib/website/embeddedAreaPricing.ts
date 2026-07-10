export type WebsiteAreaCode = 'SE1' | 'SE2' | 'SE3' | 'SE4'

export type EmbeddedAreaPricing = {
  basePriceOrePerKwh: number | null
  fixedPriceOrePerKwh: number | null
  portfolioPriceOrePerKwh: number | null
  markupOrePerKwh: number | null
  variableFeeOrePerKwh: number | null
  elcertOrePerKwh: number | null
  monthlyFeeSek: number | null
  invoiceFeeSek: number | null
  spotShare: number | null
  portfolioShare: number | null
  matchedRows: number
}

export type EmbeddedPricingModel = 'variable' | 'fixed' | 'portfolio' | 'mix' | 'monthly_fixed'
type Row = Record<string, unknown>

const AREA_KEYS = [
  'price_area_code',
  'priceAreaCode',
  'price_area',
  'priceArea',
  'electricity_area',
  'electricityArea',
  'market_area',
  'marketArea',
  'area_code',
  'areaCode',
  'area',
  'zone',
]

const BASE_PRICE_KEYS = [
  'price_per_kwh_ore',
  'pricePerKwhOre',
  'base_price_ore_per_kwh',
  'basePriceOrePerKwh',
  'energy_price_ore_per_kwh',
  'energyPriceOrePerKwh',
  'fixed_price_ore',
  'fixedPriceOre',
]

const FIXED_PRICE_KEYS = [
  'fixed_price_ore_per_kwh',
  'fixedPriceOrePerKwh',
  'fixed_price_ore',
  'fixedPriceOre',
  ...BASE_PRICE_KEYS,
]

const PORTFOLIO_PRICE_KEYS = [
  'portfolio_price_ore_per_kwh',
  'portfolioPriceOrePerKwh',
  'portfolio_price_ore',
  'portfolioPriceOre',
  'managed_price_ore_per_kwh',
  'managedPriceOrePerKwh',
  'managed_price_ore',
  'managedPriceOre',
  ...BASE_PRICE_KEYS,
]

const MARKUP_KEYS = [
  'markup_ore_per_kwh',
  'markupOrePerKwh',
  'markup_ore',
  'markupOre',
  'supplier_markup_ore_per_kwh',
  'supplierMarkupOrePerKwh',
  'supplier_margin_ore_per_kwh',
  'supplierMarginOrePerKwh',
]

const VARIABLE_FEE_KEYS = [
  'variable_markup_ore_per_kwh',
  'variableMarkupOrePerKwh',
  'variable_fee_ore_per_kwh',
  'variableFeeOrePerKwh',
  'variable_fee_ore',
  'variableFeeOre',
]

const ELCERT_KEYS = [
  'elcert_ore_per_kwh',
  'elcertOrePerKwh',
  'elcert_ore',
  'elcertOre',
  'certificate_ore_per_kwh',
  'certificateOrePerKwh',
]

const MONTHLY_FEE_KEYS = [
  'monthly_fee_sek',
  'monthlyFeeSek',
  'monthly_fee',
  'monthlyFee',
  'subscription_fee_sek',
  'subscriptionFeeSek',
]

const INVOICE_FEE_KEYS = [
  'invoice_fee_sek',
  'invoiceFeeSek',
  'invoice_fee',
  'invoiceFee',
  'billing_fee_sek',
  'billingFeeSek',
]

const SPOT_SHARE_KEYS = ['spot_share', 'spotShare', 'variable_share', 'variableShare']
const PORTFOLIO_SHARE_KEYS = ['portfolio_share', 'portfolioShare', 'managed_share', 'managedShare']

function record(value: unknown): Row | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : null
}

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'object' && !Array.isArray(value)) {
    const row = value as Row
    return finiteNumber(
      row.amount ?? row.value ?? row.price ?? row.rate ?? row.ore_per_kwh ?? row.orePerKwh ?? row.sek,
    )
  }
  const parsed = Number(typeof value === 'string' ? value.trim().replace(',', '.') : value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizedArea(value: unknown): WebsiteAreaCode | null {
  const area = typeof value === 'string' ? value.trim().toUpperCase() : ''
  return area === 'SE1' || area === 'SE2' || area === 'SE3' || area === 'SE4' ? area : null
}

function rowArea(row: Row): WebsiteAreaCode | null {
  for (const key of AREA_KEYS) {
    const area = normalizedArea(row[key])
    if (area) return area
  }
  return null
}

function firstNumber(row: Row, keys: string[]): number | null {
  for (const key of keys) {
    const value = finiteNumber(row[key])
    if (value !== null) return value
  }
  return null
}

function searchText(row: Row): string {
  return [
    row.type,
    row.kind,
    row.key,
    row.code,
    row.component_type,
    row.componentType,
    row.name,
    row.label,
    row.title,
    row.description,
    row.unit,
    row.unit_type,
    row.unitType,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function componentValue(row: Row): number | null {
  return firstNumber(row, [
    'value',
    'amount',
    'price',
    'rate',
    'amount_ore',
    'amountOre',
    'ore_per_kwh',
    'orePerKwh',
    'price_ore_per_kwh',
    'priceOrePerKwh',
    'amount_sek',
    'amountSek',
    'sek',
  ])
}

function emptyResult(): EmbeddedAreaPricing {
  return {
    basePriceOrePerKwh: null,
    fixedPriceOrePerKwh: null,
    portfolioPriceOrePerKwh: null,
    markupOrePerKwh: null,
    variableFeeOrePerKwh: null,
    elcertOrePerKwh: null,
    monthlyFeeSek: null,
    invoiceFeeSek: null,
    spotShare: null,
    portfolioShare: null,
    matchedRows: 0,
  }
}

function setFirst(target: EmbeddedAreaPricing, key: keyof Omit<EmbeddedAreaPricing, 'matchedRows'>, value: number | null) {
  if (value !== null && target[key] === null) target[key] = value
}

function applyRow(target: EmbeddedAreaPricing, row: Row, model: EmbeddedPricingModel): void {
  const genericBase = firstNumber(row, BASE_PRICE_KEYS)
  setFirst(target, 'basePriceOrePerKwh', genericBase)
  setFirst(target, 'fixedPriceOrePerKwh', firstNumber(row, FIXED_PRICE_KEYS))
  setFirst(target, 'portfolioPriceOrePerKwh', firstNumber(row, PORTFOLIO_PRICE_KEYS))
  setFirst(target, 'markupOrePerKwh', firstNumber(row, MARKUP_KEYS))
  setFirst(target, 'variableFeeOrePerKwh', firstNumber(row, VARIABLE_FEE_KEYS))
  setFirst(target, 'elcertOrePerKwh', firstNumber(row, ELCERT_KEYS))
  setFirst(target, 'monthlyFeeSek', firstNumber(row, MONTHLY_FEE_KEYS))
  setFirst(target, 'invoiceFeeSek', firstNumber(row, INVOICE_FEE_KEYS))
  setFirst(target, 'spotShare', firstNumber(row, SPOT_SHARE_KEYS))
  setFirst(target, 'portfolioShare', firstNumber(row, PORTFOLIO_SHARE_KEYS))

  const text = searchText(row)
  const value = componentValue(row)
  if (value === null || !text) return

  if (/elcert|certificate|certifikat/.test(text)) setFirst(target, 'elcertOrePerKwh', value)
  else if (/invoice|faktura|billing/.test(text)) setFirst(target, 'invoiceFeeSek', value)
  else if (/monthly|manads|manad|month|subscription|abon/.test(text)) setFirst(target, 'monthlyFeeSek', value)
  else if (/variable_fee|rorlig_avgift|rorlig avgift|variable charge|energy_fee|kwh_fee/.test(text)) {
    setFirst(target, 'variableFeeOrePerKwh', value)
  } else if (/markup|paslag|supplier_margin|margin|energy_markup/.test(text)) {
    setFirst(target, 'markupOrePerKwh', value)
  } else if (/spot_share|rorlig andel|variable share/.test(text)) {
    setFirst(target, 'spotShare', value)
  } else if (/portfolio_share|portfoljandel|managed share/.test(text)) {
    setFirst(target, 'portfolioShare', value)
  } else if (/portfolio|portfolj|managed price/.test(text)) {
    setFirst(target, 'portfolioPriceOrePerKwh', value)
  } else if (/fixed|fastpris|fast pris|price_per_kwh|kwh_price/.test(text)) {
    if (model === 'portfolio' || model === 'mix') setFirst(target, 'portfolioPriceOrePerKwh', value)
    else setFirst(target, 'fixedPriceOrePerKwh', value)
  }
}

function walkAreaRows(
  value: unknown,
  area: WebsiteAreaCode,
  model: EmbeddedPricingModel,
  target: EmbeddedAreaPricing,
  seen: Set<unknown>,
  depth: number,
  inheritedArea: WebsiteAreaCode | null,
): void {
  if (depth > 7 || value === null || value === undefined) return

  if (Array.isArray(value)) {
    for (const item of value) walkAreaRows(item, area, model, target, seen, depth + 1, inheritedArea)
    return
  }

  const row = record(value)
  if (!row || seen.has(value)) return
  seen.add(value)

  const explicitArea = rowArea(row)
  const effectiveArea = explicitArea ?? inheritedArea
  if (effectiveArea === area) {
    target.matchedRows += 1
    applyRow(target, row, model)
  }

  for (const [key, nested] of Object.entries(row)) {
    const keyArea = normalizedArea(key)
    if (keyArea) {
      if (keyArea === area) {
        const scalar = finiteNumber(nested)
        if (scalar !== null) {
          target.matchedRows += 1
          setFirst(target, 'basePriceOrePerKwh', scalar)
          if (model === 'portfolio' || model === 'mix') setFirst(target, 'portfolioPriceOrePerKwh', scalar)
          if (model === 'fixed') setFirst(target, 'fixedPriceOrePerKwh', scalar)
        } else {
          walkAreaRows(nested, area, model, target, seen, depth + 1, keyArea)
        }
      }
      continue
    }

    if (nested && typeof nested === 'object') {
      walkAreaRows(nested, area, model, target, seen, depth + 1, effectiveArea)
    }
  }
}

export function extractEmbeddedAreaPricing(
  raw: unknown,
  area: WebsiteAreaCode,
  model: EmbeddedPricingModel,
): EmbeddedAreaPricing {
  const result = emptyResult()
  walkAreaRows(raw, area, model, result, new Set(), 0, null)

  if (result.fixedPriceOrePerKwh === null && model === 'fixed') {
    result.fixedPriceOrePerKwh = result.basePriceOrePerKwh
  }
  if (result.portfolioPriceOrePerKwh === null && (model === 'portfolio' || model === 'mix')) {
    result.portfolioPriceOrePerKwh = result.basePriceOrePerKwh
  }

  return result
}
