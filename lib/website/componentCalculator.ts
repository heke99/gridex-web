import type { PublicPricingComponent } from '@/lib/website/publicContractContract'

export type ComponentCalculationInput = {
  monthlyKwh: number
  annualKwh: number
  baseEnergyPriceOrePerKwh: number
  /** Optional named bases for percentage components, expressed ex VAT in SEK/month. */
  percentageBasesSek?: Record<string, number>
  defaultVatRate?: number
}

export type CalculatedPricingComponent = {
  component_code: string
  unit: string
  amount_ex_vat_sek: number
  vat_amount_sek: number
  amount_inc_vat_sek: number
}

export type ComponentCalculationResult = {
  components: CalculatedPricingComponent[]
  total_ex_vat_sek: number
  vat_amount_sek: number
  total_inc_vat_sek: number
}

export class UnsupportedPricingComponentError extends Error {
  readonly componentCode: string

  constructor(componentCode: string, message = 'Priskomponenten stöds inte.') {
    super(message)
    this.name = 'UnsupportedPricingComponentError'
    this.componentCode = componentCode
  }
}

function finiteNonNegative(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${field} måste vara ett icke-negativt tal.`)
  return value
}

function normalizedUnit(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9%]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function monthlyInvoiceFrequency(component: PublicPricingComponent): number {
  if (component.invoices_per_year != null) {
    return finiteNonNegative(component.invoices_per_year, `${component.component_code}.invoices_per_year`) / 12
  }
  if (component.billing_interval_months != null) {
    const months = finiteNonNegative(component.billing_interval_months, `${component.component_code}.billing_interval_months`)
    if (months <= 0) throw new UnsupportedPricingComponentError(component.component_code, 'Faktureringsintervallet måste vara större än noll.')
    return 1 / months
  }
  throw new UnsupportedPricingComponentError(component.component_code, 'Fakturaavgiften saknar faktureringsfrekvens.')
}

function percentageBase(component: PublicPricingComponent, input: ComponentCalculationInput): number {
  const base = component.calculation_base?.trim()
  if (!base) throw new UnsupportedPricingComponentError(component.component_code, 'Procentkomponenten saknar calculation_base.')
  const normalized = base.toLowerCase()
  if (normalized === 'energy_cost' || normalized === 'base_energy_cost') {
    return input.baseEnergyPriceOrePerKwh * input.monthlyKwh / 100
  }
  const value = input.percentageBasesSek?.[base] ?? input.percentageBasesSek?.[normalized]
  if (value === undefined) throw new UnsupportedPricingComponentError(component.component_code, `Okänd procentbas: ${base}.`)
  return finiteNonNegative(value, `percentageBasesSek.${base}`)
}

function monthlyAmountExVat(component: PublicPricingComponent, input: ComponentCalculationInput): number {
  const unit = normalizedUnit(component.unit)
  const amount = finiteNonNegative(component.amount, `${component.component_code}.amount`)
  switch (unit) {
    case 'ore_per_kwh':
    case 'ore_kwh':
      return amount * input.monthlyKwh / 100
    case 'sek_month':
    case 'sek_per_month':
    case 'sek_manad':
      return amount
    case 'sek_invoice':
    case 'sek_per_invoice':
    case 'sek_faktura':
      return amount * monthlyInvoiceFrequency(component)
    case 'sek_year':
    case 'sek_per_year':
    case 'sek_ar':
      return amount / 12
    case 'percent':
    case 'percentage':
    case 'procent':
    case '%':
      return percentageBase(component, input) * (amount > 1 ? amount / 100 : amount)
    case 'fixed_amount':
    case 'sek':
      return amount
    default:
      throw new UnsupportedPricingComponentError(component.component_code, `Okänd enhet: ${component.unit || '(saknas)'}.`)
  }
}

function vatParts(component: PublicPricingComponent, monthlyAmount: number, defaultVatRate: number) {
  const rate = component.vat_rate ?? defaultVatRate
  if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
    throw new UnsupportedPricingComponentError(component.component_code, 'Momssatsen är ogiltig.')
  }
  if (component.vat_included === true) {
    const exVat = monthlyAmount / (1 + rate)
    return { exVat, vat: monthlyAmount - exVat, incVat: monthlyAmount }
  }
  return { exVat: monthlyAmount, vat: monthlyAmount * rate, incVat: monthlyAmount * (1 + rate) }
}

/**
 * Validates and evaluates every calculation-included component. Unknown required
 * units or percentage bases fail closed so the website can never understate a price.
 */
export function calculatePricingComponents(
  components: readonly PublicPricingComponent[],
  input: ComponentCalculationInput,
): ComponentCalculationResult {
  finiteNonNegative(input.monthlyKwh, 'monthlyKwh')
  finiteNonNegative(input.annualKwh, 'annualKwh')
  finiteNonNegative(input.baseEnergyPriceOrePerKwh, 'baseEnergyPriceOrePerKwh')
  const defaultVatRate = input.defaultVatRate ?? 0.25
  const calculated = components
    .filter((component) => component.calculation_inclusion === 'included')
    .map((component): CalculatedPricingComponent => {
      const monthly = monthlyAmountExVat(component, input)
      const parts = vatParts(component, monthly, defaultVatRate)
      return {
        component_code: component.component_code,
        unit: component.unit,
        amount_ex_vat_sek: parts.exVat,
        vat_amount_sek: parts.vat,
        amount_inc_vat_sek: parts.incVat,
      }
    })

  return calculated.reduce<ComponentCalculationResult>((result, component) => {
    result.components.push(component)
    result.total_ex_vat_sek += component.amount_ex_vat_sek
    result.vat_amount_sek += component.vat_amount_sek
    result.total_inc_vat_sek += component.amount_inc_vat_sek
    return result
  }, { components: [], total_ex_vat_sek: 0, vat_amount_sek: 0, total_inc_vat_sek: 0 })
}


/**
 * Validates the complete canonical calculation component set before an OPS quote
 * is requested. The values are deliberately neutral; this is a schema/support
 * check, while OPS remains the source of truth for the binding total.
 */
export function validatePricingComponentsForQuote(
  components: readonly PublicPricingComponent[],
): void {
  if (!components.length) {
    throw new UnsupportedPricingComponentError('__contract__', 'Avtalet saknar canonical calculation_components.')
  }
  calculatePricingComponents(components, {
    monthlyKwh: 1,
    annualKwh: 12,
    baseEnergyPriceOrePerKwh: 1,
    defaultVatRate: 0.25,
  })
}
