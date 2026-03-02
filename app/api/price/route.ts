import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  computeCustomerSpec,
  type PriceArea,
  type PricingVersionSelection,
} from '@/lib/gridex/previewEngine'
import type { CustomerSpecResult, MoneySpecLine } from '@/lib/gridex/pricing/types'

type ContractType = 'spot_hourly' | 'portfolio_managed' | 'fixed'

/* ============================================================
   Error Type
============================================================ */

type ApiError = Error & {
  status?: number
}

/* ============================================================
   Helpers
============================================================ */

function normalizePostalCode(input: string): string {
  return input.replace(/\s/g, '').trim()
}

function assertValidInput(kwh: number, contractSlug: string): void {
  if (!Number.isFinite(kwh) || kwh <= 0 || !contractSlug) {
    const e: ApiError = new Error('Missing/invalid fields: kwh, contractSlug')
    e.status = 400
    throw e
  }
}

function assertSpecificationIntegrity(
  spec: CustomerSpecResult
): void {
  if (!spec)
    throw new Error('Pricing engine returned empty spec')

  if (!Number.isFinite(spec.totalOrePerKwh))
    throw new Error('Missing totalOrePerKwh')

  if (!Number.isFinite(spec.totalMonthlyCostSek))
    throw new Error('Missing totalMonthlyCostSek')

  if (!Array.isArray(spec.lines))
    throw new Error('Missing specification lines')
}

/* ============================================================
   Area Resolution
============================================================ */

async function resolvePriceArea(
  supabase: SupabaseClient,
  postalCodeRaw: string,
  manualArea?: PriceArea
): Promise<PriceArea> {
  if (manualArea && ['SE1', 'SE2', 'SE3', 'SE4'].includes(manualArea)) {
    return manualArea
  }

  const postal = normalizePostalCode(postalCodeRaw)

  const { data, error } = await supabase
    .from('gridex_postal_code_price_area')
    .select('price_area')
    .eq('postal_code', postal)
    .maybeSingle()

  if (error) {
    const e: ApiError = new Error(error.message)
    e.status = 500
    throw e
  }

  if (!data?.price_area) {
    const e: ApiError = new Error(
      'Postnummer saknar elområdes-mapping.'
    )
    e.status = 422
    throw e
  }

  return data.price_area as PriceArea
}

/* ============================================================
   Contract Resolution
============================================================ */

type ContractRow = {
  id: string
  slug: string
  name: string
  contract_type: ContractType
  is_active: boolean | null
}

async function resolveActiveContract(
  supabase: SupabaseClient,
  slug: string
): Promise<ContractRow> {
  const { data, error } = await supabase
    .from('contract_products')
    .select('id,slug,name,contract_type,is_active')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (error) {
    const e: ApiError = new Error(error.message)
    e.status = 500
    throw e
  }

  if (!data) {
    const e: ApiError = new Error('Contract not found')
    e.status = 404
    throw e
  }

  return data as ContractRow
}

/* ============================================================
   MAIN
============================================================ */

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const postalCodeRaw = String(body.postalCode ?? '')
    const manualArea = body.manualPriceArea as PriceArea | undefined
    const kwh = Number(body.kwh ?? 0)
    const contractSlug = String(body.contractSlug ?? '').trim()

    const selection =
      (body.pricingSelection as PricingVersionSelection | undefined) ?? undefined

    assertValidInput(kwh, contractSlug)

    const supabase = await createSupabaseServerClient()

    const priceArea = await resolvePriceArea(
      supabase,
      postalCodeRaw,
      manualArea
    )

    const contract = await resolveActiveContract(
      supabase,
      contractSlug
    )

    const spec: CustomerSpecResult = await computeCustomerSpec({
      supabase,
      contract,
      priceArea,
      kwh,
      selection,
    })

    // 🔥 HARD GUARANTEE
    assertSpecificationIntegrity(spec)

    /* ============================================================
       Build FRONTEND-SAFE specification
    ============================================================ */

    const energyLine = spec.lines.find(
      (l: MoneySpecLine) =>
        l.key === 'spot' || l.key === 'fixed'
    )

    const markupLine = spec.lines.find(
      (l: MoneySpecLine) => l.key === 'markup'
    )

    const variableLine = spec.lines.find(
      (l: MoneySpecLine) => l.key === 'variable'
    )

    const monthlyLine = spec.lines.find(
      (l: MoneySpecLine) => l.key === 'monthly'
    )

    const isSpot = contract.contract_type === 'spot_hourly'

    const basis = isSpot
      ? {
          type: 'previous_month_avg_spot' as const,
          year: spec.diagnostics?.spotBasis?.year ?? new Date().getFullYear(),
          month: spec.diagnostics?.spotBasis?.month ?? new Date().getMonth() + 1,
          spotAvgOre: energyLine?.orePerKwh ?? 0,
        }
      : {
          type: 'admin_fixed_price' as const,
          fixedPriceOre: energyLine?.orePerKwh ?? 0,
        }

    const fees = {
      markupOre: markupLine?.orePerKwh,
      variableFeeOre: variableLine?.orePerKwh ?? 0,
      monthlyFeeSek: monthlyLine?.sekPerMonth ?? 0,
    }

    return NextResponse.json({
      contract: {
        slug: contract.slug,
        name: contract.name,
        contractType: contract.contract_type,
      },
      priceArea,
      kwh,
      pricePerKwhOre: spec.totalOrePerKwh,
      totalMonthlyCostSek: spec.totalMonthlyCostSek,
      specification: {
        basis,
        fees,
      },
    })
  } catch (err: unknown) {
    const error = err as ApiError

    return NextResponse.json(
      {
        error: error.message ?? 'Internal server error',
      },
      { status: error.status ?? 500 }
    )
  }
}