import type { SupabaseClient } from '@supabase/supabase-js'
import { formatYearMonth } from '@/lib/gridex/pricing/validators'
import { computeCustomerSpec } from '@/lib/gridex/previewEngine'
import type {
  ContractProduct,
  ContractType,
  CustomerSpecResult,
  PriceArea,
} from '@/lib/gridex/pricing/types'
import { resolvePriceAreaForPostalCode } from '@/lib/gridex/postalAreas'

type ContractRow = {
  id: string
  slug: string
  name: string
  contract_type: ContractType
  is_active: boolean | null
}

export type OfferCalculation = {
  contract: {
    id: string
    slug: string
    name: string
    contractType: ContractType
  }
  pricingVersionId: string
  priceArea: PriceArea
  postalCode: string | null
  kwh: number
  pricePerKwhOre: number
  totalMonthlyCostSek: number
  totalMonthlyCostInclVatSek: number
  totalYearlyCostSek: number
  specification: {
    basis:
      | {
          type: 'previous_month_avg_spot'
          year: number
          month: number
          spotAvgOre: number
          source?:
            | 'gridex_monthly_spot_prices'
            | 'gridex_spot_monthly_avg'
            | 'elprisetjustnu_api'
        }
      | {
          type: 'fixed_price'
          fixedPriceOre: number
        }
    fees: {
      markupOre?: number
      variableFeeOre: number
      elcertOre: number
      monthlyFeeSek: number
    }
    lines: CustomerSpecResult['lines']
  }
  legalText: string
  customerNotice: string
  snapshot: Record<string, unknown>
}

function safeNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function clampKwh(value: unknown): number {
  const n = safeNumber(value, 2000)
  return Math.min(200000, Math.max(1, n))
}

function legalTextFor(spec: CustomerSpecResult): string {
  if (spec.contract.contract_type === 'spot_hourly') {
    const basis = spec.diagnostics.spotBasis
    const basisLabel = basis ? formatYearMonth(basis.year, basis.month) : 'föregående månad'
    const sourceLabel =
      basis?.source === 'elprisetjustnu_api'
        ? 'elprisetjustnu.se'
        : 'Gridex prisbas för samma period'

    return `Detta är ett rörligt månadspris. Priset du ser är ett exempel baserat på föregående kalendermånads genomsnittliga spotpris (${basisLabel}) i ditt elområde. Spotpriset hämtas från ${sourceLabel}. Din angivna förbrukning påverkar månadskostnaden, men inte själva spotpriset. Ditt faktiska pris kan ändras varje månad beroende på marknadspriset. Endast fasta elprisavtal har ett fast kWh-pris. Avtalade påslag och månadsavgifter framgår i specifikationen.`
  }

  return 'Detta är ett fastprisavtal. Kunden accepterar ett fast kWh-pris enligt den publicerade prisversionen, plus de månadsavgifter och villkor som framgår i specifikationen.'
}

function extractFee(spec: CustomerSpecResult, key: string) {
  return spec.lines.find((line) => line.key === key)
}

async function resolveActiveContract(
  supabase: SupabaseClient,
  contractSlug: string
): Promise<ContractProduct> {
  const { data, error } = await supabase
    .from('contract_products')
    .select('id,slug,name,contract_type,is_active')
    .eq('slug', contractSlug)
    .eq('is_active', true)
    .single<ContractRow>()

  if (error) throw Object.assign(new Error(error.message), { status: 500 })
  if (!data) throw Object.assign(new Error('Avtal hittades inte.'), { status: 404 })

  return data
}

export async function calculateCustomerOffer(params: {
  supabase: SupabaseClient
  contractSlug: string
  postalCode?: string | null
  manualPriceArea?: PriceArea | null
  kwh: number
}): Promise<OfferCalculation> {
  const contractSlug = params.contractSlug.trim()
  if (!contractSlug) {
    throw Object.assign(new Error('Välj ett avtal.'), { status: 400 })
  }

  const area = await resolvePriceAreaForPostalCode(
    params.supabase,
    params.postalCode ?? '',
    params.manualPriceArea ?? null
  )
  const contract = await resolveActiveContract(params.supabase, contractSlug)
  const kwh = clampKwh(params.kwh)
  const spec = await computeCustomerSpec({
    supabase: params.supabase,
    contract,
    priceArea: area.priceArea,
    kwh,
  })

  const energyLine =
    extractFee(spec, 'spot') ??
    extractFee(spec, 'fixed') ??
    extractFee(spec, 'portfolio')
  const markupLine = extractFee(spec, 'markup')
  const variableLine = extractFee(spec, 'variable')
  const elcertLine = extractFee(spec, 'elcert')
  const monthlyLine = extractFee(spec, 'monthly')
  const legalText = legalTextFor(spec)
  const isVariable = spec.contract.contract_type === 'spot_hourly'
  const spotBasis = spec.diagnostics.spotBasis

  const basis = isVariable
    ? {
        type: 'previous_month_avg_spot' as const,
        year: spotBasis?.year ?? new Date().getFullYear(),
        month: spotBasis?.month ?? new Date().getMonth() + 1,
        spotAvgOre: spotBasis?.avgSpotOre ?? safeNumber(energyLine?.orePerKwh),
        source: spotBasis?.source,
      }
    : {
        type: 'fixed_price' as const,
        fixedPriceOre: safeNumber(energyLine?.orePerKwh),
      }

  const offer: OfferCalculation = {
    contract: {
      id: contract.id,
      slug: contract.slug,
      name: contract.name,
      contractType: contract.contract_type,
    },
    pricingVersionId: spec.pricingVersion.id,
    priceArea: area.priceArea,
    postalCode: area.postalCode || null,
    kwh,
    pricePerKwhOre: spec.totalOrePerKwh,
    totalMonthlyCostSek: spec.totalMonthlyCostSek,
    totalMonthlyCostInclVatSek: spec.totalMonthlyCostInclVatSek,
    totalYearlyCostSek: spec.totalMonthlyCostSek * 12,
    specification: {
      basis,
      fees: {
        markupOre: markupLine?.orePerKwh,
        variableFeeOre: safeNumber(variableLine?.orePerKwh),
        elcertOre: safeNumber(elcertLine?.orePerKwh),
        monthlyFeeSek: safeNumber(monthlyLine?.sekPerMonth),
      },
      lines: spec.lines,
    },
    legalText,
    customerNotice: isVariable
      ? 'Rörligt månadspris – spotpriset hämtas för föregående kalendermånad från elprisetjustnu.se. Din kWh-förbrukning påverkar bara totalen.'
      : 'Fast elpris - kWh-priset ändras inte under avtalad fastprisperiod.',
    snapshot: {},
  }

  offer.snapshot = {
    schema: 'gridex_price_snapshot_v1',
    createdAt: new Date().toISOString(),
    contract: offer.contract,
    pricingVersionId: offer.pricingVersionId,
    priceArea: offer.priceArea,
    postalCode: offer.postalCode,
    monthlyConsumptionKwh: offer.kwh,
    pricePerKwhOre: offer.pricePerKwhOre,
    totalMonthlyCostSek: offer.totalMonthlyCostSek,
    totalMonthlyCostInclVatSek: offer.totalMonthlyCostInclVatSek,
    totalYearlyCostSek: offer.totalYearlyCostSek,
    specification: offer.specification,
    customerNotice: offer.customerNotice,
    legalText: offer.legalText,
    variablePriceAcceptedAsModel: isVariable,
  }

  return offer
}
