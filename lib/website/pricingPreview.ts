import type { OpsPublicContract, OpsWebsitePricingPreview, OpsWebsitePricingPreviewInput } from '@/lib/ops/client'
import { fetchMonthlySpotAverageFromElprisetJustNu, stockholmDateParts } from '@/lib/gridex/pricing/elprisetjustnu'
import { buildPublicContractDisplay } from '@/lib/website/publicContractDisplay'

export class WebsitePricingPreviewError extends Error {}
export type WebsitePricingPreviewSource = 'website'
export function websitePricingPreviewSource(): WebsitePricingPreviewSource { return 'website' }

function finite(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) }
function n(value: unknown, fallback = 0): number { return finite(value) ? value : fallback }
function typeOf(contract: OpsPublicContract): OpsWebsitePricingPreview['contract']['contractType'] {
  const value = String(contract.type).toLowerCase()
  if (value === 'fixed') return 'fixed'
  if (value === 'monthly_fixed' || value === 'fixed_monthly') return 'monthly_fixed'
  if (value === 'portfolio' || value === 'portfolio_managed') return 'portfolio_managed'
  if (value === 'mix' || value === 'mixed') return 'mix'
  if (value.includes('quarter')) return 'spot_quarterly'
  if (value.includes('hour')) return 'spot_hourly'
  return 'spot_monthly'
}
function previousCompleteMonth(now = new Date()) {
  const current = stockholmDateParts(now)
  const date = new Date(Date.UTC(current.year, current.month - 2, 1))
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 }
}
function vatRate(contract: OpsPublicContract): number {
  const value = contract.vat_rate
  if (!finite(value)) return 0.25
  return value > 1 ? value / 100 : Math.max(0, value)
}
function fixedAreaPrice(contract: OpsPublicContract, area: string): number | null {
  const raw = contract as OpsPublicContract & { fixed_prices_by_area?: Record<string, unknown>; pricing?: Record<string, unknown> }
  const direct = raw.fixed_prices_by_area?.[area]
  if (finite(direct)) return direct
  if (direct && typeof direct === 'object' && finite((direct as { amount?: unknown }).amount)) return (direct as { amount: number }).amount
  const pricing = raw.pricing
  const byArea = pricing && typeof pricing === 'object' ? (pricing.fixed_prices_by_area as Record<string, unknown> | undefined) : undefined
  const nested = byArea?.[area]
  if (finite(nested)) return nested
  if (nested && typeof nested === 'object' && finite((nested as { amount?: unknown }).amount)) return (nested as { amount: number }).amount
  return finite(contract.fixed_price_ore_per_kwh) ? contract.fixed_price_ore_per_kwh : null
}

export async function loadVerifiedWebsitePricingPreview(input: OpsWebsitePricingPreviewInput, contract: OpsPublicContract): Promise<OpsWebsitePricingPreview> {
  if (contract.offer_reference !== input.offer_reference) throw new WebsitePricingPreviewError('Valt avtal kunde inte verifieras.')
  const monthlyKwh = input.estimated_monthly_kwh
  const annualKwh = input.annual_consumption_kwh ?? monthlyKwh * 12
  if (!finite(monthlyKwh) || monthlyKwh <= 0 || !finite(annualKwh) || annualKwh <= 0) throw new WebsitePricingPreviewError('Förbrukningen är ogiltig.')
  const contractType = typeOf(contract)
  let marketOre = 0
  let sourcePeriod: string | null = null
  let marketSource: OpsWebsitePricingPreview['market_sources'] = []

  if (contractType === 'fixed') {
    const fixed = fixedAreaPrice(contract, input.price_area_code)
    if (!finite(fixed)) throw new WebsitePricingPreviewError(`Fastpris saknas för ${input.price_area_code}.`)
    marketOre = fixed
  } else if (contractType === 'monthly_fixed') {
    marketOre = 0
  } else if (contractType === 'portfolio_managed') {
    if (!finite(contract.portfolio_price_ore_per_kwh)) throw new WebsitePricingPreviewError('Publicerat portföljpris saknas.')
    marketOre = contract.portfolio_price_ore_per_kwh
  } else {
    const period = previousCompleteMonth()
    const spot = await fetchMonthlySpotAverageFromElprisetJustNu({ year: period.year, month: period.month, priceArea: input.price_area_code })
    if (!spot) throw new WebsitePricingPreviewError('Marknadspris saknas för valt elområde.')
    sourcePeriod = `${spot.periodStart}/${spot.periodEnd}`
    marketSource = [{ name: 'elprisetjustnu.se', period: sourcePeriod, resolution: `${spot.sourceIntervalMinutes ?? spot.intervalMinutes ?? 60} minuter`, timestamp: new Date().toISOString() }]
    if (contractType === 'mix') {
      const spotShare = n(contract.spot_share, 50) / 100
      const portfolioShare = n(contract.portfolio_share, 100 - spotShare * 100) / 100
      if (!finite(contract.portfolio_price_ore_per_kwh)) throw new WebsitePricingPreviewError('Portföljpris saknas för mixavtalet.')
      marketOre = spot.avgSpotOre * spotShare + contract.portfolio_price_ore_per_kwh * portfolioShare
    } else marketOre = spot.avgSpotOre
  }

  const perKwhFees = n(contract.markup_ore_per_kwh) + n(contract.variable_markup_ore_per_kwh) + n(contract.elcert_ore_per_kwh)
  const pricePerKwhOre = Number((marketOre + perKwhFees).toFixed(6))
  const monthlyFixed = n(contract.monthly_fixed_price_sek) + n(contract.monthly_fee_sek) + n(contract.invoice_fee_sek)
  const subtotal = monthlyKwh * pricePerKwhOre / 100 + monthlyFixed
  const total = subtotal * (1 + vatRate(contract))
  const now = new Date()
  const validUntil = new Date(now.getTime() + 20 * 60_000).toISOString()
  const result: OpsWebsitePricingPreview = {
    contract: { slug: contract.offer_reference, offer_reference: contract.offer_reference, name: contract.name, contractType },
    priceArea: input.price_area_code,
    price_area_code: input.price_area_code,
    kwh: monthlyKwh,
    annual_consumption_kwh: annualKwh,
    pricePerKwhOre,
    totalMonthlyCostSek: Number(subtotal.toFixed(2)),
    totalMonthlyCostInclVatSek: Number(total.toFixed(2)),
    totalYearlyCostSek: Number((total * 12).toFixed(2)),
    pricing_interval: contractType === 'spot_quarterly' ? 'quarter_hour' : contractType === 'spot_hourly' ? 'hour' : 'month',
    estimate_method: contractType === 'fixed' ? 'ops_fixed_price_by_resolved_area' : contractType === 'monthly_fixed' ? 'ops_fixed_monthly' : 'previous_complete_calendar_month_spot_average',
    source_period: sourcePeriod ?? undefined,
    source_window: sourcePeriod ? { start: sourcePeriod.split('/')[0]!, end: sourcePeriod.split('/')[1]! } : null,
    market_data_timestamp: marketSource[0]?.timestamp ?? now.toISOString(),
    is_binding: false,
    assumptions: [{ code: 'annual_consumption', label: 'Årsförbrukning', value: annualKwh, unit: 'kWh' }],
    market_sources: marketSource,
    pricing_snapshot_schema_version: 'website-pricing-v3',
    valid_until: validUntil,
    specification: {
      basis: { market_ore_per_kwh: marketOre, source_period: sourcePeriod, price_area_code: input.price_area_code },
      fees: { markupOre: n(contract.markup_ore_per_kwh), variableFeeOre: n(contract.variable_markup_ore_per_kwh), elcertOre: n(contract.elcert_ore_per_kwh), monthlyFeeSek: n(contract.monthly_fee_sek), invoiceFeeSek: n(contract.invoice_fee_sek), invoiceFeeIncludedInMonthlyEstimate: true, billingIntervalMonths: 1 },
      contract_display_snapshot: buildPublicContractDisplay(contract).snapshot,
    },
  }
  return result
}
