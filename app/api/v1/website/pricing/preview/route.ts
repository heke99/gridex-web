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
import { buildPublicContractDisplay } from '@/lib/website/publicContractDisplay'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const AREAS = new Set<OpsWebsitePriceArea>(['SE1', 'SE2', 'SE3', 'SE4'])

type PreviewPayload = {
  offer_reference?: unknown
  offerReference?: unknown
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

function normalizeOptionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined
  const parsed = Number(typeof value === 'string' ? value.replace(',', '.') : value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function preferContractComponent(
  previewValue: number | null | undefined,
  contractValue: number | null | undefined,
): number | undefined {
  if (previewValue !== null && previewValue !== undefined && Number.isFinite(previewValue)) {
    return previewValue
  }
  return typeof contractValue === 'number' && Number.isFinite(contractValue) ? contractValue : undefined
}

function matchesContract(contract: OpsPublicContract, input: OpsWebsitePricingPreviewInput) {
  const wanted = [input.offer_reference, input.contract_id, input.price_plan_id, input.price_plan_version_id, input.product_code]
    .map((value) => value?.trim())
    .filter(Boolean)

  return wanted.some(
    (value) =>
      value === contract.offer_reference ||
      value === contract.contract_id ||
      value === contract.price_plan_id ||
      value === contract.price_plan_version_id ||
      value === contract.product_code,
  )
}

function previewFees(data: OpsWebsitePricingPreview): Record<string, unknown> {
  const spec = data.specification
  if (!spec || typeof spec !== 'object' || !('fees' in spec)) return {}
  const fees = (spec as { fees?: unknown }).fees
  return fees && typeof fees === 'object' && !Array.isArray(fees) ? (fees as Record<string, unknown>) : {}
}

function enrichPreviewWithContract(
  data: OpsWebsitePricingPreview,
  contract: OpsPublicContract | undefined,
): OpsWebsitePricingPreview {
  if (!contract) return data

  const fees = previewFees(data)
  const enrichedFees = {
    ...fees,
    markupOre: preferContractComponent(
      normalizeOptionalNumber(fees.markupOre ?? fees.markup_ore ?? fees.markup_ore_per_kwh),
      contract.markup_ore_per_kwh,
    ),
    variableFeeOre: preferContractComponent(
      normalizeOptionalNumber(fees.variableFeeOre ?? fees.variable_fee_ore ?? fees.variable_fee_ore_per_kwh),
      contract.variable_markup_ore_per_kwh,
    ),
    monthlyFeeSek: preferContractComponent(
      normalizeOptionalNumber(fees.monthlyFeeSek ?? fees.monthly_fee_sek),
      contract.monthly_fee_sek,
    ),
    invoiceFeeSek: preferContractComponent(
      normalizeOptionalNumber(fees.invoiceFeeSek ?? fees.invoice_fee_sek),
      contract.invoice_fee_sek,
    ),
  }

  return {
    ...data,
    contract: {
      ...data.contract,
      slug: contract.offer_reference,
      offer_reference: contract.offer_reference,
      name: contract.name,
      price_plan_id: contract.price_plan_id,
      price_plan_version_id: contract.price_plan_version_id,
      product_code: contract.product_code,
      contract_id: contract.contract_id ?? null,
    },
    specification: {
      ...(data.specification ?? {}),
      fees: enrichedFees,
      contract_display_snapshot: buildPublicContractDisplay(contract).snapshot,
    },
  }
}

export async function POST(req: Request) {
  const status = getOpsClientStatus()

  if (!status.configured) {
    return NextResponse.json({ error: 'Priset kan inte räknas just nu.' }, { status: 503 })
  }

  const body = (await req.json().catch(() => null)) as PreviewPayload | null
  const resolvedArea = priceArea(body?.price_area_code ?? body?.priceAreaCode ?? body?.priceArea)

  if (!resolvedArea) {
    return NextResponse.json(
      { error: 'Elområde saknas. Ange postnummer eller välj elområde innan du räknar pris.' },
      { status: 400 },
    )
  }

  const input: OpsWebsitePricingPreviewInput = {
    offer_reference: text(body?.offer_reference ?? body?.offerReference),
    contract_id: text(body?.contract_id ?? body?.contractId),
    price_plan_id: text(body?.price_plan_id ?? body?.pricePlanId),
    price_plan_version_id: text(body?.price_plan_version_id ?? body?.pricePlanVersionId),
    product_code: text(body?.product_code ?? body?.productCode),
    price_area_code: resolvedArea,
    postal_code: text(body?.postal_code ?? body?.postalCode, 20),
    city: text(body?.city),
    address: text(body?.address),
    estimated_monthly_kwh: number(body?.estimated_monthly_kwh ?? body?.estimatedMonthlyKwh ?? body?.kwh),
  }

  try {
    const contracts = await fetchOpsPublicContracts()
    const contract = contracts.find((item) => matchesContract(item, input))

    if (!contract) {
      return NextResponse.json({ error: 'Valt elavtal kunde inte verifieras.' }, { status: 404 })
    }

    const data = await fetchOpsWebsitePricingPreview(input)
    if (!Number.isFinite(data.totalMonthlyCostSek) && !Number.isFinite(data.totalMonthlyCostInclVatSek)) {
      return NextResponse.json({ error: 'Vi kunde inte beräkna priset just nu.' }, { status: 502 })
    }
    return NextResponse.json({ data: enrichPreviewWithContract(data, contract) })
  } catch (error) {
    const allowLocalFallback =
      process.env.NODE_ENV !== 'production' && process.env.GRIDEX_ENABLE_LOCAL_PRICE_FALLBACK === 'true'

    if (allowLocalFallback) {
      return NextResponse.json(
        { error: 'OPS-pris kunde inte hämtas. Lokal prisfallback är inte längre bindande och är därför stoppad i detta flöde.' },
        { status: 502 },
      )
    }

    if (isOpsError(error)) {
      return NextResponse.json(
        { error: error.message || 'Vi kunde inte beräkna priset just nu.' },
        { status: error.status || 502 },
      )
    }

    return NextResponse.json({ error: 'Vi kunde inte beräkna priset just nu.' }, { status: 502 })
  }
}
