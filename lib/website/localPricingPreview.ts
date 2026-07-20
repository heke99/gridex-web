import type { OpsPublicContract, OpsWebsitePricingPreview } from '@/lib/ops/client'
import type { PriceArea } from '@/lib/gridex/pricing/types'
import { prevYearMonth } from '@/lib/gridex/pricing/validators'
import {
  fetchDailySpotAverageFromElprisetJustNu,
  fetchMonthlySpotAverageFromElprisetJustNu,
  stockholmDateParts,
} from '@/lib/gridex/pricing/elprisetjustnu'
import { buildPublicContractDisplay } from '@/lib/website/publicContractDisplay'
import {
  resolveWebsiteAreaPricing,
  type ResolvedWebsiteAreaPricing,
} from '@/lib/website/areaPricingResolver'
import type { EmbeddedPricingModel } from '@/lib/website/embeddedAreaPricing'
import {
  resolveWebsitePricingModel,
  usesElprisetJustNu,
  type WebsitePricingModel,
} from '@/lib/website/contractPricingModel'

export class LocalWebsitePricingPreviewError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'LocalWebsitePricingPreviewError'
    this.status = status
  }
}

export type ElprisetSpotBasis = {
  type: 'elprisetjustnu_spot'
  pricingModel: 'monthly' | 'hourly' | 'quarterly'
  period: 'current_month_to_date' | 'today'
  year: number
  month: number
  day?: number
  spotAvgOre: number
  samples: number
  intervalMinutes: number | null
  periodStart: string
  periodEnd: string
  source: 'elprisetjustnu_api'
}

type LocalPricingInput = {
  contract: OpsPublicContract
  priceAreaCode: PriceArea
  estimatedMonthlyKwh: number
  now?: Date
}

const DEFAULT_VAT_RATE = 0.25

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

function embeddedPricingModel(model: WebsitePricingModel): EmbeddedPricingModel {
  if (model === 'fixed_kwh_price') return 'fixed'
  if (model === 'portfolio') return 'portfolio'
  if (model === 'mix') return 'mix'
  if (model === 'monthly_fixed') return 'monthly_fixed'
  return 'variable'
}

export async function getElprisetSpotBasis(params: {
  priceAreaCode: PriceArea
  pricingModel: 'monthly' | 'hourly' | 'quarterly'
  now?: Date
}): Promise<ElprisetSpotBasis> {
  const now = params.now ?? new Date()

  const current = stockholmDateParts(now)

  if (params.pricingModel === 'monthly') {
    const apiAverage = await fetchMonthlySpotAverageFromElprisetJustNu({
      year: current.year,
      month: current.month,
      throughDay: current.day,
      priceArea: params.priceAreaCode,
    }).catch((error) => {
      throw new LocalWebsitePricingPreviewError(
        error instanceof Error ? error.message : 'Elprisetjustnu kunde inte hämtas.',
        503,
      )
    })
    if (!apiAverage) {
      throw new LocalWebsitePricingPreviewError(
        `Elprisetjustnu saknar månadspris hittills för ${params.priceAreaCode}.`,
        503,
      )
    }
    return {
      type: 'elprisetjustnu_spot',
      pricingModel: 'monthly',
      period: 'current_month_to_date',
      year: apiAverage.year,
      month: apiAverage.month,
      day: current.day,
      spotAvgOre: apiAverage.avgSpotOre,
      samples: apiAverage.samples,
      intervalMinutes: apiAverage.intervalMinutes,
      periodStart: apiAverage.periodStart,
      periodEnd: apiAverage.periodEnd,
      source: apiAverage.source,
    }
  }
  const apiAverage = await fetchDailySpotAverageFromElprisetJustNu({
    year: current.year,
    month: current.month,
    day: current.day,
    priceArea: params.priceAreaCode,
    reportingIntervalMinutes: params.pricingModel === 'hourly' ? 60 : undefined,
  }).catch((error) => {
    throw new LocalWebsitePricingPreviewError(
      error instanceof Error ? error.message : 'Elprisetjustnu kunde inte hämtas.',
      503,
    )
  })
  if (!apiAverage) {
    throw new LocalWebsitePricingPreviewError(
      `Elprisetjustnu saknar dagens pris för ${params.priceAreaCode}.`,
      503,
    )
  }
  if (params.pricingModel === 'quarterly' && (apiAverage.intervalMinutes === null || apiAverage.intervalMinutes > 15)) {
    throw new LocalWebsitePricingPreviewError(
      'Elprisetjustnu saknar kvartspriser för dagens beräkning.',
      503,
    )
  }

  return {
    type: 'elprisetjustnu_spot',
    pricingModel: params.pricingModel,
    period: 'today',
    year: apiAverage.year,
    month: apiAverage.month,
    day: apiAverage.day,
    spotAvgOre: apiAverage.avgSpotOre,
    samples: apiAverage.samples,
    intervalMinutes: apiAverage.intervalMinutes,
    periodStart: apiAverage.periodStart,
    periodEnd: apiAverage.periodEnd,
    source: apiAverage.source,
  }
}

function previewContractType(model: WebsitePricingModel): OpsWebsitePricingPreview['contract']['contractType'] {
  if (model === 'monthly_fixed') return 'monthly_fixed'
  if (model === 'fixed_kwh_price') return 'fixed'
  if (model === 'portfolio') return 'portfolio_managed'
  if (model === 'mix') return 'mix'
  if (model === 'spot_quarterly') return 'spot_quarterly'
  if (model === 'spot_hourly') return 'spot_hourly'
  return 'spot_monthly'
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
  const requiresEnergyMarkup = usesElprisetJustNu(model) || model === 'portfolio' || model === 'mix'
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
    // Public fixed and market-price agreements must use exactly the price
    // components OPS published. Local database rows are only a compatibility
    // path for portfolio products that still rely on internal monthly data.
    allowDatabase: model === 'portfolio' || model === 'mix',
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
    const spotBasis = await getElprisetSpotBasis({ priceAreaCode: input.priceAreaCode, pricingModel: 'monthly', now: input.now })
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
    customerNotice = 'Prisberäkningen baseras på mixavtalets andelar, portföljpriset från OPS och aktuell månads spotgenomsnitt hittills direkt från Elprisetjustnu.'
  } else {
    const spotPricingModel = model === 'spot_hourly'
      ? 'hourly'
      : model === 'spot_quarterly'
        ? 'quarterly'
        : 'monthly'
    const spotBasis = await getElprisetSpotBasis({
      priceAreaCode: input.priceAreaCode,
      pricingModel: spotPricingModel,
      now: input.now,
    })
    pricePerKwhOre = spotBasis.spotAvgOre + fees.markupOre + fees.variableFeeOre + fees.elcertOre
    energySubtotalSek = (input.estimatedMonthlyKwh * pricePerKwhOre) / 100
    monthlyExVat = energySubtotalSek + fees.monthlyFeeSek
    basis = spotBasis
    customerNotice = model === 'spot_monthly'
      ? 'Månadspriset beräknas med den aktuella kalendermånadens publicerade spotpriser hittills, direkt från Elprisetjustnu för ditt elområde.'
      : model === 'spot_quarterly'
        ? 'Kvartsprisets månadskostnad är en uppskattning baserad på dagens publicerade kvartspriser från Elprisetjustnu och din uppskattade förbrukning.'
        : 'Timprisets månadskostnad är en uppskattning baserad på dagens publicerade spotpriser från Elprisetjustnu och din uppskattade förbrukning.'
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
      usesElprisetJustNu(model) || model === 'mix'
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
      source: usesElprisetJustNu(model) ? 'elprisetjustnu_api' : 'ops_public_contract',
      pricing_model: model,
      area_pricing_source: areaPricing.source,
      pricing_version_id: areaPricing.pricingVersionId,
      offer_reference: input.contract.offer_reference,
    },
  }
}
