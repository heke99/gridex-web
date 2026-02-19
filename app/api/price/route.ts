import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

type PriceArea = 'SE1' | 'SE2' | 'SE3' | 'SE4'
type ContractType = 'spot_hourly' | 'portfolio_managed' | 'fixed'

function normalizePostalCode(input: string): string {
  return input.replace(/\s/g, '').trim()
}

function prevYearMonth(now: Date): { year: number; month: number } {
  const m = now.getMonth() + 1
  if (m === 1) return { year: now.getFullYear() - 1, month: 12 }
  return { year: now.getFullYear(), month: m - 1 }
}

function toIsoNoMs(d: Date) {
  // Supabase/Postgres jämför bra mot timestamptz i ISO
  return d.toISOString()
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const postalCodeRaw = String(body.postalCode ?? '')
    const manualArea = body.manualPriceArea as PriceArea | undefined
    const kwh = Number(body.kwh ?? 0)
    const contractSlug = String(body.contractSlug ?? '').trim()

    if (!Number.isFinite(kwh) || kwh <= 0 || !contractSlug) {
      return NextResponse.json(
        { error: 'Missing/invalid fields: kwh, contractSlug' },
        { status: 400 }
      )
    }

    const supabase = await createSupabaseServerClient()

    let priceArea: PriceArea

    // 1) Manuellt elområde
    if (manualArea && ['SE1', 'SE2', 'SE3', 'SE4'].includes(manualArea)) {
      priceArea = manualArea
    } else {
      // 2) Postnummer → elområde
      const postal = normalizePostalCode(postalCodeRaw)

      const { data: areaRow, error: areaErr } = await supabase
        .from('gridex_postal_code_price_area')
        .select('price_area')
        .eq('postal_code', postal)
        .maybeSingle()

      if (areaErr) {
        return NextResponse.json({ error: areaErr.message }, { status: 500 })
      }

      if (!areaRow?.price_area) {
        return NextResponse.json(
          {
            error:
              'Postnummer saknar elområdes-mapping. Lägg till i Admin → Postnummer.',
            missingPostalCode: postal,
          },
          { status: 422 }
        )
      }

      priceArea = areaRow.price_area as PriceArea
    }

    // Avtal
    const { data: contract, error: cErr } = await supabase
      .from('contract_products')
      .select('id,slug,name,contract_type,is_active')
      .eq('slug', contractSlug)
      .eq('is_active', true)
      .single()

    if (cErr) {
      return NextResponse.json({ error: cErr.message }, { status: 500 })
    }

    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }

    const contractType = contract.contract_type as ContractType
    const now = new Date()
    const nowIso = toIsoNoMs(now)

    // ✅ Enterprise: välj publicerad prisversion baserat på valid_from <= nu
    // Notera: för scheduling kan ni ha flera published-versioner. Vi tar den senaste som är giltig nu.
    const { data: version, error: vErr } = await supabase
      .from('contract_pricing_versions')
      .select('id,contract_id,version_number,valid_from,status')
      .eq('contract_id', contract.id)
      .eq('status', 'published')
      .lte('valid_from', nowIso)
      .order('valid_from', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (vErr) {
      return NextResponse.json({ error: vErr.message }, { status: 500 })
    }

    if (!version?.id) {
      return NextResponse.json(
        {
          error:
            'Ingen publicerad prisversion är giltig just nu. Skapa en version och publicera (med valid_from ≤ idag).',
        },
        { status: 422 }
      )
    }

    const pricingVersionId = version.id

    const { year, month } = prevYearMonth(now)

    // =============================
    // SPOT (tim/rörligt) — baserat på föregående månads snittspot + settings (version)
    // =============================
    if (contractType === 'spot_hourly') {
      const { data: spot, error: spotErr } = await supabase
        .from('gridex_monthly_spot_prices')
        .select('avg_spot_ore')
        .eq('price_area', priceArea)
        .eq('year', year)
        .eq('month', month)
        .maybeSingle()

      if (spotErr) {
        return NextResponse.json({ error: spotErr.message }, { status: 500 })
      }

      const { data: settings, error: sErr } = await supabase
        .from('gridex_spot_area_settings')
        .select('markup_ore,variable_fee_ore,monthly_fee_sek')
        .eq('pricing_version_id', pricingVersionId)
        .eq('price_area', priceArea)
        .maybeSingle()

      if (sErr) {
        return NextResponse.json({ error: sErr.message }, { status: 500 })
      }

      if (!spot || !settings) {
        return NextResponse.json(
          { error: 'Spot-pris eller inställningar saknas för området (publicerad version).' },
          { status: 422 }
        )
      }

      const spotAvg = Number(spot.avg_spot_ore)
      const markup = Number(settings.markup_ore)
      const variableFee = Number(settings.variable_fee_ore)
      const monthlyFee = Number(settings.monthly_fee_sek)

      const pricePerKwhOre = spotAvg + markup + variableFee
      const totalMonthlyCostSek =
        Math.round((kwh * pricePerKwhOre) / 100 + monthlyFee)

      return NextResponse.json({
        contract: {
          slug: contract.slug,
          name: contract.name,
          contractType,
        },
        priceArea,
        kwh,
        pricePerKwhOre,
        totalMonthlyCostSek,
        pricingVersion: {
          id: pricingVersionId,
          versionNumber: version.version_number,
          validFrom: version.valid_from,
          status: version.status,
        },
        specification: {
          basis: {
            type: 'previous_month_avg_spot',
            year,
            month,
            spotAvgOre: spotAvg,
          },
          fees: {
            markupOre: markup,
            variableFeeOre: variableFee,
            monthlyFeeSek: monthlyFee,
          },
        },
      })
    }

    // =============================
    // PORTFÖLJ / FAST — baseras på versionens fasta pris + avgifter
    // =============================
    if (contractType === 'portfolio_managed' || contractType === 'fixed') {
      const { data: p, error: pErr } = await supabase
        .from('gridex_portfolio_area_pricing')
        .select('fixed_price_ore,variable_fee_ore,monthly_fee_sek')
        .eq('pricing_version_id', pricingVersionId)
        .eq('price_area', priceArea)
        .maybeSingle()

      if (pErr) {
        return NextResponse.json({ error: pErr.message }, { status: 500 })
      }

      if (!p) {
        return NextResponse.json(
          { error: 'Portföljpris saknas för området (publicerad version).' },
          { status: 422 }
        )
      }

      const fixed = Number(p.fixed_price_ore)
      const variableFee = Number(p.variable_fee_ore)
      const monthlyFee = Number(p.monthly_fee_sek)

      const pricePerKwhOre = fixed + variableFee
      const totalMonthlyCostSek =
        Math.round((kwh * pricePerKwhOre) / 100 + monthlyFee)

      return NextResponse.json({
        contract: {
          slug: contract.slug,
          name: contract.name,
          contractType,
        },
        priceArea,
        kwh,
        pricePerKwhOre,
        totalMonthlyCostSek,
        pricingVersion: {
          id: pricingVersionId,
          versionNumber: version.version_number,
          validFrom: version.valid_from,
          status: version.status,
        },
        specification: {
          basis: {
            type: 'admin_fixed_price',
            fixedPriceOre: fixed,
          },
          fees: {
            variableFeeOre: variableFee,
            monthlyFeeSek: monthlyFee,
          },
        },
      })
    }

    return NextResponse.json({ error: 'Unsupported contract type' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}