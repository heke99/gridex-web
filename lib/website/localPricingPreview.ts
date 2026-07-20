import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { OpsPublicContract, OpsWebsitePricingPreview } from '@/lib/ops/client'
import type { PriceArea } from '@/lib/gridex/pricing/types'
import { tryQuery } from '@/lib/gridex/pricing/db'
import { prevYearMonth, formatYearMonth } from '@/lib/gridex/pricing/validators'
import { fetchMonthlySpotAverageFromElprisetJustNu } from '@/lib/gridex/pricing/elprisetjustnu'
import { buildPublicContractDisplay } from '@/lib/website/publicContractDisplay'
import {
  resolveWebsiteAreaPricing,
  type ResolvedWebsiteAreaPricing,
} from '@/lib/website/areaPricingResolver'
import type { EmbeddedPricingModel } from '@/lib/website/embeddedAreaPricing'

export class LocalWebsitePricingPreviewError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'LocalWebsitePricingPreviewError'
    this.status = status
  }
}

type WebsitePricingModel =
  | 'monthly_fixed'
  | 'variable_spot_previous_month'
  | 'fixed_kwh_price'
  | 'portfolio'
  | 'mix'

type SpotBasis = {
  type: 'previous_month_avg_spot'
  year: number
  month: number
  spotAvgOre: number
  source: 'gridex_monthly_spot_prices' | 'gridex_spot_monthly_avg' | 'elprisetjustnu_api'
}

type LocalPricingInput = {
  contract: OpsPublicContract
  priceAreaCode: PriceArea
  estimatedMonthlyKwh: number
  now?: Date
}

type MonthlySpotRow = { avg_spot_ore: number | string | null }
type LegacySpotRow = { avg_ore: number | string | null }

const DEFAULT_VAT_RATE = 0.25

let cachedSupabase: SupabaseClient | null | undefined

function optionalSupabase(): SupabaseClient | null {
  if (cachedSupabase !== undefined) return cachedSupabase
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !serviceKey) {
    cachedSupabase = null
    return cachedSupabase
  }
  cachedSupabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cachedSupabase
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function number(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(typeof value === 'string' ? value.trim().replace(',', '.') : value)
  return Number.isFinite(parsed) ? parsed : null
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function pickNestedNumber(source: unknown, keys: string[]): number | null {
  const row = record(source)
  if (!row) return null
  for (const key of keys) {
    const value = number(row[key])
    if (value !== null) return value
  }
  return null
}

function pricingRecord(contract: OpsPublicContract): Record<string, unknown> | null {
  return record(contract.raw?.pricing) ?? record(contract.raw?.price) ?? record(contract.raw?.specification)
}

function contractNumber(contract: OpsPublicContract, direct: keyof OpsPublicContract, aliases: string[]): number | null {
  const directValue = number(contract[direct])
  if (directValue !== null) return directValue
  return pickNestedNumber(pricingRecord(contract), aliases) ?? pickNestedNumber(contract.raw, aliases)
}

function monthlyFixedPriceSek(contract: OpsPublicContract): number | null {
  return contractNumber(contract, 'monthly_fixed_price_sek', [
    'monthly_fixed_price_sek',
    'monthlyFixedPriceSek',
    'monthly_price_sek',
    'monthlyPriceSek',
    'fixed_monthly_price_sek',
    'fixedMonthlyPriceSek',
    'subscription_price_sek',
    'subscriptionPriceSek',
  ])
}

function portfolioPriceOre(contract: OpsPublicContract): number | null {
  return contractNumber(contract, 'portfolio_price_ore_per_kwh', [
    'portfolio_price_ore_per_kwh',
    'portfolioPriceOrePerKwh',
    'portfolio_price_ore',
    'portfolioPriceOre',
    'managed_price_ore_per_kwh',
    'managedPriceOrePerKwh',
  ])
}

function publishedPortfolioMonthlyPrice(
  contract: OpsPublicContract,
  priceAreaCode: PriceArea,
  now = new Date(),
): {
  year: number
  month: number
  amount: number
  pricePlanVersionId: string | null
} | null {
  const target = prevYearMonth(now)
  const targetValue = target.year * 100 + target.month
  const rows = (contract.portfolio_monthly_prices ?? [])
    .filter((item) => item.price_area_code === priceAreaCode)
    .map((item) => ({
      year: Number(item.year),
      month: Number(item.month),
      amount: Number(item.amount),
      pricePlanVersionId: item.price_plan_version_id ?? null,
    }))
    .filter((item) =>
      Number.isInteger(item.year) &&
      Number.isInteger(item.month) &&
      item.month >= 1 &&
      item.month <= 12 &&
      Number.isFinite(item.amount) &&
      item.amount > 0 &&
      item.year * 100 + item.month <= targetValue,
    )
    .sort((a, b) => (b.year * 100 + b.month) - (a.year * 100 + a.month))

  return rows[0] ?? null
}

function vatRate(contract: OpsPublicContract): number {
  const raw = contractNumber(contract, 'vat_rate', ['vat_rate', 'vatRate', 'vat'])
  if (raw === null) return DEFAULT_VAT_RATE
  if (raw > 1 && raw <= 100) return raw / 100
  if (raw >= 0 && raw <= 1) return raw
  return DEFAULT_VAT_RATE
}

function percentShare(value: number | null | undefined): number | null {
  if (!finite(value)) return null
  if (value > 1) return value / 100
  if (value >= 0) return value
  return null
}

function normalizedContractType(contract: OpsPublicContract): string {
  return String(contract.pricing_model ?? contract.type ?? '').trim().toLowerCase()
}

export function resolveWebsitePricingModel(contract: OpsPublicContract): WebsitePricingModel {
  const type = normalizedContractType(contract)
  if (monthlyFixedPriceSek(contract) !== null || /monthly_fixed|fixed_monthly|monthly_price|manadspris|månadspris/.test(type)) {
    return 'monthly_fixed'
  }
  if (type === 'fixed' || type === 'fixed_kwh' || contract.fixed_price_ore_per_kwh != null) {
    return 'fixed_kwh_price'
  }
  if (type === 'mix' || type === 'mixed') return 'mix'
  if (type === 'portfolio' || type === 'portfolio_managed') return 'portfolio'
  return 'variable_spot_previous_month'
}

function embeddedPricingModel(model: WebsitePricingModel): EmbeddedPricingModel {
  if (model === 'fixed_kwh_price') return 'fixed'
  if (model === 'portfolio') return 'portfolio'
  if (model === 'mix') return 'mix'
  if (model === 'monthly_fixed') return 'monthly_fixed'
  return 'variable'
}

async function fetchStoredSpotBasis(
  supabase: SupabaseClient,
  priceArea: PriceArea,
  year: number,
  month: number,
): Promise<SpotBasis | null> {
  const monthly = await tryQuery<MonthlySpotRow | null>(
    supabase
      .from('gridex_monthly_spot_prices')
      .select('avg_spot_ore')
      .eq('price_area', priceArea)
      .eq('year', year)
      .eq('month', month)
      .maybeSingle(),
  )
  const monthlyValue = number(monthly.data?.avg_spot_ore)
  if (monthlyValue !== null && monthlyValue > 0) {
    return { type: 'previous_month_avg_spot', year, month, spotAvgOre: monthlyValue, source: 'gridex_monthly_spot_prices' }
  }

  const legacy = await tryQuery<LegacySpotRow | null>(
    supabase
      .from('gridex_spot_monthly_avg')
      .select('avg_ore')
      .eq('price_area', priceArea)
      .eq('year', year)
      .eq('month', month)
      .maybeSingle(),
  )
  const legacyValue = number(legacy.data?.avg_ore)
  if (legacyValue !== null && legacyValue > 0) {
    return { type: 'previous_month_avg_spot', year, month, spotAvgOre: legacyValue, source: 'gridex_spot_monthly_avg' }
  }

  return null
}

export async function getPreviousMonthSpotBasis(params: {
  priceAreaCode: PriceArea
  now?: Date
}): Promise<SpotBasis> {
  const now = params.now ?? new Date()
  const supabase = optionalSupabase()
  // Public website pricing must always use the previous calendar month
  // in Europe/Stockholm. It must not read gridex_spot_basis_config here:
  // that admin setting can be used for internal publish/rollback workflows,
  // but it must never move the public calculator back to an old month such
  // as February when today is in June.
  const period = prevYearMonth(now)

  const stored = supabase ? await fetchStoredSpotBasis(supabase, params.priceAreaCode, period.year, period.month) : null
  if (stored) return stored

  const apiAverage = await fetchMonthlySpotAverageFromElprisetJustNu({
    year: period.year,
    month: period.month,
    priceArea: params.priceAreaCode,
  }).catch(() => null)

  if (apiAverage?.avgSpotOre && apiAverage.avgSpotOre > 0) {
    return {
      type: 'previous_month_avg_spot',
      year: period.year,
      month: period.month,
      spotAvgOre: apiAverage.avgSpotOre,
      source: 'elprisetjustnu_api',
    }
  }

  throw new LocalWebsitePricingPreviewError(
    `Prisberäkningen är inte publicerad för ${params.priceAreaCode} ${formatYearMonth(period.year, period.month)}.`,
    503,
  )
}

function previewContractType(model: WebsitePricingModel): OpsWebsitePricingPreview['contract']['contractType'] {
  if (model === 'monthly_fixed') return 'monthly_fixed'
  if (model === 'fixed_kwh_price') return 'fixed'
  if (model === 'portfolio') return 'portfolio_managed'
  if (model === 'mix') return 'mix'
  return 'spot_hourly'
}

function roundMoney(value: number): number {
  return Number(value.toFixed(2))
}

function roundOre(value: number): number {
  return Number(value.toFixed(6))
}

type PublishedFeeKey =
  | 'markup_ore_per_kwh'
  | 'variable_markup_ore_per_kwh'
  | 'elcert_ore_per_kwh'
  | 'monthly_fee_sek'
  | 'invoice_fee_sek'
  | 'fixed_price_ore_per_kwh'
  | 'portfolio_price_ore_per_kwh'

type PublishedFees = {
  markupOre: number
  variableFeeOre: number
  elcertOre: number
  monthlyFeeSek: number
  invoiceFeeSek: number
  invoiceFeeIncludedInMonthlyEstimate: false
}

function publishedAmount(contract: OpsPublicContract, key: PublishedFeeKey): number | null {
  return number(contract[key])
}

function resolvedAmount(
  contract: OpsPublicContract,
  areaPricing: ResolvedWebsiteAreaPricing,
  key: PublishedFeeKey,
): number | null {
  const fromArea =
    key === 'markup_ore_per_kwh'
      ? areaPricing.markupOrePerKwh
      : key === 'variable_markup_ore_per_kwh'
        ? areaPricing.variableFeeOrePerKwh
        : key === 'elcert_ore_per_kwh'
          ? areaPricing.elcertOrePerKwh
          : key === 'monthly_fee_sek'
            ? areaPricing.monthlyFeeSek
            : key === 'invoice_fee_sek'
              ? areaPricing.invoiceFeeSek
              : key === 'fixed_price_ore_per_kwh'
                ? areaPricing.fixedPriceOrePerKwh
                : areaPricing.portfolioPriceOrePerKwh

  return fromArea ?? publishedAmount(contract, key)
}

function requireResolvedAmount(
  contract: OpsPublicContract,
  areaPricing: ResolvedWebsiteAreaPricing,
  key: PublishedFeeKey,
  label: string,
): number {
  const value = resolvedAmount(contract, areaPricing, key)
  if (value === null) {
    throw new LocalWebsitePricingPreviewError(`Avtalet saknar publicerat ${label} för valt elområde.`, 409)
  }
  if (value < 0) {
    throw new LocalWebsitePricingPreviewError(`Avtalet har ogiltigt ${label} för valt elområde.`, 409)
  }
  return value
}

function optionalResolvedAmount(
  contract: OpsPublicContract,
  areaPricing: ResolvedWebsiteAreaPricing,
  key: PublishedFeeKey,
  label: string,
): number {
  const value = resolvedAmount(contract, areaPricing, key)
  if (value === null) return 0
  if (value < 0) {
    throw new LocalWebsitePricingPreviewError(`Avtalet har ogiltigt ${label} för valt elområde.`, 409)
  }
  return value
}

function baseFees(
  contract: OpsPublicContract,
  model: WebsitePricingModel,
  areaPricing: ResolvedWebsiteAreaPricing,
): PublishedFees {
  const requiresEnergyMarkup = model === 'variable_spot_previous_month' || model === 'portfolio' || model === 'mix'
  const requiresMonthlyFee = model !== 'monthly_fixed'

  return {
    markupOre: requiresEnergyMarkup
      ? requireResolvedAmount(contract, areaPricing, 'markup_ore_per_kwh', 'påslag')
      : optionalResolvedAmount(contract, areaPricing, 'markup_ore_per_kwh', 'påslag'),
    variableFeeOre: optionalResolvedAmount(contract, areaPricing, 'variable_markup_ore_per_kwh', 'rörlig avgift'),
    elcertOre: optionalResolvedAmount(contract, areaPricing, 'elcert_ore_per_kwh', 'elcertifikat'),
    monthlyFeeSek: requiresMonthlyFee
      ? requireResolvedAmount(contract, areaPricing, 'monthly_fee_sek', 'månadsavgift')
      : optionalResolvedAmount(contract, areaPricing, 'monthly_fee_sek', 'månadsavgift'),
    invoiceFeeSek: requireResolvedAmount(contract, areaPricing, 'invoice_fee_sek', 'fakturaavgift'),
    invoiceFeeIncludedInMonthlyEstimate: false,
  }
}

function resolveMixShares(input: {
  spotShare: number | null | undefined
  portfolioShare: number | null | undefined
}): { spotShare: number; portfolioShare: number } {
  let spotShare = percentShare(input.spotShare)
  let portfolioShare = percentShare(input.portfolioShare)

  if (spotShare === null && portfolioShare !== null && portfolioShare >= 0 && portfolioShare <= 1) {
    spotShare = 1 - portfolioShare
  }
  if (portfolioShare === null && spotShare !== null && spotShare >= 0 && spotShare <= 1) {
    portfolioShare = 1 - spotShare
  }
  if (spotShare === null || portfolioShare === null) {
    throw new LocalWebsitePricingPreviewError('Mixavtalet saknar publicerade mixandelar.', 409)
  }
  if (spotShare < 0 || spotShare > 1 || portfolioShare < 0 || portfolioShare > 1) {
    throw new LocalWebsitePricingPreviewError('Mixavtalet har ogiltiga mixandelar.', 409)
  }

  const totalShare = spotShare + portfolioShare
  if (!Number.isFinite(totalShare) || totalShare <= 0) {
    throw new LocalWebsitePricingPreviewError('Mixavtalet har ogiltiga mixandelar.', 409)
  }

  return {
    spotShare: spotShare / totalShare,
    portfolioShare: portfolioShare / totalShare,
  }
}

export async function buildLocalWebsitePricingPreview(input: LocalPricingInput): Promise<OpsWebsitePricingPreview> {
  if (!Number.isFinite(input.estimatedMonthlyKwh) || input.estimatedMonthlyKwh <= 0) {
    throw new LocalWebsitePricingPreviewError('Ange en giltig månadsförbrukning innan du räknar pris.', 400)
  }

  const model = resolveWebsitePricingModel(input.contract)
  const areaPricing = await resolveWebsiteAreaPricing({
    contract: input.contract,
    priceAreaCode: input.priceAreaCode,
    model: embeddedPricingModel(model),
    now: input.now,
  })
  const fees = baseFees(input.contract, model, areaPricing)
  const vat = vatRate(input.contract)
  const display = buildPublicContractDisplay(input.contract)
  let basis: NonNullable<OpsWebsitePricingPreview['specification']>['basis']
  let customerNotice = ''
  let pricePerKwhOre = 0
  let energySubtotalSek = 0
  let monthlyExVat = 0

  if (model === 'monthly_fixed') {
    const fixedMonthly = monthlyFixedPriceSek(input.contract)
    if (fixedMonthly === null || fixedMonthly < 0) {
      throw new LocalWebsitePricingPreviewError('Avtalet saknar publicerat månadspris.', 409)
    }
    monthlyExVat = fixedMonthly
    pricePerKwhOre = input.estimatedMonthlyKwh > 0 ? (fixedMonthly / input.estimatedMonthlyKwh) * 100 : 0
    basis = { type: 'monthly_fixed_price', monthlyFixedPriceSek: fixedMonthly }
    customerNotice = 'Detta avtal har ett fast månadspris. Priset visas enligt valt avtal.'
  } else if (model === 'fixed_kwh_price') {
    const fixedOre = requireResolvedAmount(input.contract, areaPricing, 'fixed_price_ore_per_kwh', 'fast kWh-pris')
    if (fixedOre <= 0) throw new LocalWebsitePricingPreviewError('Avtalet saknar publicerat fast kWh-pris.', 409)
    pricePerKwhOre = fixedOre + fees.variableFeeOre + fees.elcertOre
    energySubtotalSek = (input.estimatedMonthlyKwh * pricePerKwhOre) / 100
    monthlyExVat = energySubtotalSek + fees.monthlyFeeSek
    basis = { type: 'fixed_price', fixedPriceOre: fixedOre }
    customerNotice = 'Prisberäkningen baseras på avtalets fasta kWh-pris och din uppskattade förbrukning.'
  } else if (model === 'portfolio') {
    const monthlyPortfolio = publishedPortfolioMonthlyPrice(
      input.contract,
      input.priceAreaCode,
      input.now,
    )
    const portfolioOre =
      monthlyPortfolio?.amount ??
      areaPricing.portfolioPriceOrePerKwh ??
      portfolioPriceOre(input.contract) ??
      areaPricing.fixedPriceOrePerKwh ??
      publishedAmount(input.contract, 'fixed_price_ore_per_kwh')
    if (portfolioOre === null || portfolioOre <= 0) throw new LocalWebsitePricingPreviewError('Avtalet saknar publicerat portföljpris.', 409)
    pricePerKwhOre = portfolioOre + fees.markupOre + fees.variableFeeOre + fees.elcertOre
    energySubtotalSek = (input.estimatedMonthlyKwh * pricePerKwhOre) / 100
    monthlyExVat = energySubtotalSek + fees.monthlyFeeSek
    basis = monthlyPortfolio
      ? {
          type: 'published_portfolio_month',
          year: monthlyPortfolio.year,
          month: monthlyPortfolio.month,
          portfolioPriceOre: portfolioOre,
          price_plan_version_id: monthlyPortfolio.pricePlanVersionId,
          source: 'ops_public_contract',
        }
      : { type: 'admin_fixed_price', fixedPriceOre: portfolioOre }
    customerNotice = 'Prisberäkningen baseras på avtalets publicerade portföljpris och din uppskattade förbrukning.'
  } else if (model === 'mix') {
    const spotBasis = await getPreviousMonthSpotBasis({ priceAreaCode: input.priceAreaCode, now: input.now })
    const monthlyPortfolio = publishedPortfolioMonthlyPrice(
      input.contract,
      input.priceAreaCode,
      input.now,
    )
    const portfolioOre =
      monthlyPortfolio?.amount ??
      areaPricing.portfolioPriceOrePerKwh ??
      portfolioPriceOre(input.contract) ??
      areaPricing.fixedPriceOrePerKwh ??
      publishedAmount(input.contract, 'fixed_price_ore_per_kwh')
    if (portfolioOre === null || portfolioOre <= 0) throw new LocalWebsitePricingPreviewError('Mixavtalet saknar publicerat portföljpris.', 409)
    const mixShares = resolveMixShares({
      spotShare: areaPricing.spotShare,
      portfolioShare: areaPricing.portfolioShare,
    })
    const normalizedSpotShare = mixShares.spotShare
    const normalizedPortfolioShare = mixShares.portfolioShare
    const blendedOre = spotBasis.spotAvgOre * normalizedSpotShare + portfolioOre * normalizedPortfolioShare
    pricePerKwhOre = blendedOre + fees.markupOre + fees.variableFeeOre + fees.elcertOre
    energySubtotalSek = (input.estimatedMonthlyKwh * pricePerKwhOre) / 100
    monthlyExVat = energySubtotalSek + fees.monthlyFeeSek
    basis = {
      type: 'mix',
      spotShare: normalizedSpotShare,
      portfolioShare: normalizedPortfolioShare,
      spotPriceOre: spotBasis.spotAvgOre,
      portfolioPriceOre: portfolioOre,
      year: spotBasis.year,
      month: spotBasis.month,
      source: spotBasis.source,
      portfolio_year: monthlyPortfolio?.year ?? null,
      portfolio_month: monthlyPortfolio?.month ?? null,
      price_plan_version_id: monthlyPortfolio?.pricePlanVersionId ?? null,
    }
    customerNotice = 'Prisberäkningen baseras på mixavtalets andelar och föregående månads genomsnittliga elpris i valt elområde.'
  } else {
    const spotBasis = await getPreviousMonthSpotBasis({ priceAreaCode: input.priceAreaCode, now: input.now })
    pricePerKwhOre = spotBasis.spotAvgOre + fees.markupOre + fees.variableFeeOre + fees.elcertOre
    energySubtotalSek = (input.estimatedMonthlyKwh * pricePerKwhOre) / 100
    monthlyExVat = energySubtotalSek + fees.monthlyFeeSek
    basis = spotBasis
    customerNotice = 'Prisberäkningen baseras på föregående månads genomsnittliga elpris i ditt elområde, valt avtal och uppskattad förbrukning. Rörligt pris följer marknaden och kan ändras över tid.'
  }

  const monthlyInclVat = monthlyExVat * (1 + vat)

  return {
    contract: {
      slug: input.contract.offer_reference,
      offer_reference: input.contract.offer_reference,
      name: input.contract.name,
      contractType: previewContractType(model),
    },
    priceArea: input.priceAreaCode,
    price_area_code: input.priceAreaCode,
    kwh: input.estimatedMonthlyKwh,
    pricePerKwhOre: roundOre(pricePerKwhOre),
    totalMonthlyCostSek: roundMoney(monthlyExVat),
    totalMonthlyCostInclVatSek: roundMoney(monthlyInclVat),
    totalYearlyCostSek: roundMoney(monthlyInclVat * 12),
    customerNotice,
    legalText:
      model === 'variable_spot_previous_month' || model === 'mix'
        ? 'Rörligt pris kan ändras över tid. Beräkningen är ett kundvänligt estimat baserat på publicerad prisgrund.'
        : 'Prisberäkningen baseras på det publicerade avtalet och din uppskattade förbrukning.',
    specification: {
      basis,
      fees,
      vatRate: vat,
      pricing_model: model,
      area_pricing_source: areaPricing.source,
      pricing_version_id: areaPricing.pricingVersionId,
      energySubtotalSek: roundMoney(energySubtotalSek),
      contract_display_snapshot: display.snapshot,
    },
    raw: {
      source: 'gridex_web_local_pricing',
      pricing_model: model,
      area_pricing_source: areaPricing.source,
      pricing_version_id: areaPricing.pricingVersionId,
      offer_reference: input.contract.offer_reference,
    },
  }
}
