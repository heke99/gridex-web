import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  computeCustomerSpec,
  type PriceArea,
  type PricingVersionSelection,
} from '@/lib/gridex/previewEngine'

type ContractType = 'spot_hourly' | 'portfolio_managed' | 'fixed'

/* ============================================================
   Helpers
============================================================ */

function normalizePostalCode(input: string): string {
  return input.replace(/\s/g, '').trim()
}

function assertValidInput(kwh: number, contractSlug: string): void {
  if (!Number.isFinite(kwh) || kwh <= 0 || !contractSlug) {
    const e = new Error('Missing/invalid fields: kwh, contractSlug') as Error & {
      status?: number
    }
    e.status = 400
    throw e
  }
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
    const e = new Error(error.message) as Error & { status?: number }
    e.status = 500
    throw e
  }

  if (!data?.price_area) {
    const e = new Error(
      'Postnummer saknar elområdes-mapping. Lägg till i Admin → Postnummer.'
    ) as Error & { status?: number; meta?: unknown }

    e.status = 422
    e.meta = { missingPostalCode: postal }
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
    const e = new Error(error.message) as Error & { status?: number }
    e.status = 500
    throw e
  }

  if (!data) {
    const e = new Error('Contract not found') as Error & { status?: number }
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

    // Optional preview override (admin use)
    const selection =
      (body.pricingSelection as PricingVersionSelection | undefined) ?? undefined

    assertValidInput(kwh, contractSlug)

    const supabase = await createSupabaseServerClient()

    // 1️⃣ Resolve area
    const priceArea = await resolvePriceArea(
      supabase,
      postalCodeRaw,
      manualArea
    )

    // 2️⃣ Resolve contract
    const contract = await resolveActiveContract(
      supabase,
      contractSlug
    )

    // 3️⃣ SINGLE SOURCE OF TRUTH
    const spec = await computeCustomerSpec({
      supabase,
      contract,
      priceArea,
      kwh,
      selection,
    })

    // 4️⃣ Return same structure as before (no breaking change)
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
      pricingVersion: {
        id: spec.pricingVersion.id,
        versionNumber: spec.pricingVersion.version_number,
        validFrom: spec.pricingVersion.valid_from,
        status: spec.pricingVersion.status ?? null,
        isPublished: spec.pricingVersion.is_published ?? null,
      },
      specification: {
        totalOrePerKwh: spec.totalOrePerKwh,
        totalMonthlyCostSek: spec.totalMonthlyCostSek,
        totalMonthlyCostInclVatSek: spec.totalMonthlyCostInclVatSek,
        energySubtotalSek: spec.energySubtotalSek,
        lines: spec.lines,
        diagnostics: spec.diagnostics,
      },
    })
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number; meta?: unknown }

    return NextResponse.json(
      {
        error: e?.message ?? 'Internal server error',
        ...(e?.meta ?? {}),
      },
      { status: e?.status ?? 500 }
    )
  }
}