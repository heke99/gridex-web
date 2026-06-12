import { NextResponse } from 'next/server'
import {
  fetchOpsPublicContracts,
  fetchOpsWebsitePricingPreview,
  getOpsClientStatus,
  isOpsError,
  type OpsPublicContract,
  type OpsWebsitePriceArea,
  type OpsWebsitePricingPreview,
  type OpsWebsitePricingPreviewInput,
} from '@/lib/ops/client'
import { fetchMonthlySpotAverageFromElprisetJustNu } from '@/lib/gridex/pricing/elprisetjustnu'
import { prevYearMonth } from '@/lib/gridex/pricing/validators'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const AREAS = new Set<OpsWebsitePriceArea>(['SE1', 'SE2', 'SE3', 'SE4'])

type PreviewPayload = {
  contract_id?: unknown
  contractId?: unknown
  price_plan_id?: unknown
  pricePlanId?: unknown
  price_plan_version_id?: unknown
  pricePlanVersionId?: unknown
  product_code?: unknown
  productCode?: unknown
  price_area_code?: unknown
  priceAreaCode?: unknown
  priceArea?: unknown
  postal_code?: unknown
  postalCode?: unknown
  city?: unknown
  address?: unknown
  estimated_monthly_kwh?: unknown
  estimatedMonthlyKwh?: unknown
  kwh?: unknown
}

function text(value: unknown, max = 180): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().slice(0, max)
  return trimmed ? trimmed : null
}

function number(value: unknown, fallback = 2000): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(200000, Math.max(1, parsed))
}

function priceArea(value: unknown): OpsWebsitePriceArea | null {
  const area = typeof value === 'string' ? value.toUpperCase() : ''
  return AREAS.has(area as OpsWebsitePriceArea) ? (area as OpsWebsitePriceArea) : null
}

function money(value: unknown, fallback = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeContractType(type: string): 'spot_hourly' | 'portfolio_managed' | 'fixed' {
  if (type === 'fixed') return 'fixed'
  if (type === 'portfolio' || type === 'portfolio_managed') return 'portfolio_managed'
  return 'spot_hourly'
}

function matchesContract(contract: OpsPublicContract, input: OpsWebsitePricingPreviewInput) {
  const wanted = [
    input.contract_id,
    input.price_plan_id,
    input.price_plan_version_id,
    input.product_code,
  ]
    .map((value) => value?.trim())
    .filter(Boolean)

  return wanted.some(
    (value) =>
      value === contract.contract_id ||
      value === contract.price_plan_id ||
      value === contract.price_plan_version_id ||
      value === contract.product_code
  )
}

async function fallbackPreview(
  input: OpsWebsitePricingPreviewInput
): Promise<OpsWebsitePricingPreview> {
  const contracts = await fetchOpsPublicContracts()
  const contract = contracts.find((item) => matchesContract(item, input))

  if (!contract) {
    throw Object.assign(new Error('Valt elavtal kunde inte verifieras.'), {
      status: 404,
    })
  }

  const monthlyKwh = number(input.estimated_monthly_kwh)
  const contractType = normalizeContractType(contract.type)
  const monthlyFeeSek = money(contract.monthly_fee_sek)
  const invoiceFeeSek = money(contract.invoice_fee_sek)
  const markupOre = money(contract.markup_ore_per_kwh)
  const variableFeeOre = money(contract.variable_markup_ore_per_kwh)
  const fixedPriceOre = money(contract.fixed_price_ore_per_kwh)
  const monthlyFeeTotalSek = monthlyFeeSek + invoiceFeeSek

  let basis:
    | {
        type: 'previous_month_avg_spot'
        year: number
        month: number
        spotAvgOre: number
        source: 'elprisetjustnu_api'
      }
    | { type: 'admin_fixed_price'; fixedPriceOre: number }

  let baseOre = fixedPriceOre

  if (contractType === 'fixed' && fixedPriceOre > 0) {
    basis = { type: 'admin_fixed_price', fixedPriceOre }
  } else if (contractType === 'portfolio_managed' && fixedPriceOre > 0) {
    basis = { type: 'admin_fixed_price', fixedPriceOre }
  } else {
    const period = prevYearMonth(new Date())
    const spot = await fetchMonthlySpotAverageFromElprisetJustNu({
      year: period.year,
      month: period.month,
      priceArea: input.price_area_code,
    })

    if (!spot) {
      throw Object.assign(new Error('Spotpris kunde inte hämtas för valt elområde.'), {
        status: 502,
      })
    }

    baseOre = spot.avgSpotOre
    basis = {
      type: 'previous_month_avg_spot',
      year: spot.year,
      month: spot.month,
      spotAvgOre: spot.avgSpotOre,
      source: 'elprisetjustnu_api',
    }
  }

  const totalOre = baseOre + markupOre + variableFeeOre
  const totalMonthlyCostSek = (totalOre * monthlyKwh) / 100 + monthlyFeeTotalSek

  return {
    contract: {
      slug: contract.product_code,
      name: contract.name,
      contractType,
    },
    priceArea: input.price_area_code,
    price_area_code: input.price_area_code,
    kwh: monthlyKwh,
    pricePerKwhOre: Number(totalOre.toFixed(4)),
    totalMonthlyCostSek: Number(totalMonthlyCostSek.toFixed(2)),
    totalMonthlyCostInclVatSek: Number((totalMonthlyCostSek * 1.25).toFixed(2)),
    totalYearlyCostSek: Number((totalMonthlyCostSek * 12).toFixed(2)),
    customerNotice:
      'Priset är en uppskattning baserad på valt elområde och aktuell prisinformation. Slutlig bekräftelse skickas när ansökan har behandlats.',
    specification: {
      basis,
      fees: {
        markupOre,
        variableFeeOre,
        elcertOre: 0,
        monthlyFeeSek: monthlyFeeTotalSek,
      },
    },
  }
}

export async function POST(req: Request) {
  const status = getOpsClientStatus()

  if (!status.configured) {
    return NextResponse.json(
      { error: 'Priset kan inte räknas just nu.' },
      { status: 503 }
    )
  }

  const body = (await req.json().catch(() => null)) as PreviewPayload | null
  const resolvedArea = priceArea(
    body?.price_area_code ?? body?.priceAreaCode ?? body?.priceArea
  )

  if (!resolvedArea) {
    return NextResponse.json(
      { error: 'Elområde saknas. Ange postnummer och kontrollera prisområdet först.' },
      { status: 400 }
    )
  }

  const input: OpsWebsitePricingPreviewInput = {
    contract_id: text(body?.contract_id ?? body?.contractId),
    price_plan_id: text(body?.price_plan_id ?? body?.pricePlanId),
    price_plan_version_id: text(body?.price_plan_version_id ?? body?.pricePlanVersionId),
    product_code: text(body?.product_code ?? body?.productCode),
    price_area_code: resolvedArea,
    postal_code: text(body?.postal_code ?? body?.postalCode, 20),
    city: text(body?.city),
    address: text(body?.address),
    estimated_monthly_kwh: number(
      body?.estimated_monthly_kwh ?? body?.estimatedMonthlyKwh ?? body?.kwh
    ),
  }

  try {
    const data = await fetchOpsWebsitePricingPreview(input)
    return NextResponse.json({ data })
  } catch (error) {
    if (isOpsError(error) && error.status !== 404) {
      return NextResponse.json(
        { error: error.message || 'Priset kan inte räknas just nu.' },
        { status: error.status }
      )
    }

    try {
      const data = await fallbackPreview(input)
      return NextResponse.json({ data, fallback: true })
    } catch (fallbackError) {
      const message =
        fallbackError instanceof Error
          ? fallbackError.message
          : 'Priset kan inte räknas just nu.'
      const fallbackStatus =
        typeof fallbackError === 'object' &&
        fallbackError !== null &&
        'status' in fallbackError &&
        typeof (fallbackError as { status?: unknown }).status === 'number'
          ? (fallbackError as { status: number }).status
          : 502

      return NextResponse.json({ error: message }, { status: fallbackStatus })
    }
  }
}
