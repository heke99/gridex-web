// lib/gridex/pricing/engine.ts

import type {
  ContractProduct,
  CustomerSpecResult,
  EngineContext,
  MoneySpecLine,
  PriceArea,
} from './types'
import { assertPositiveKwh, clampVatRate, safeNumber } from './validators'
import {
  fetchAreaPricing,
  fetchPortfolioPricing,
  fetchPrevMonthlySpotAvg,
  fetchSpotSettings,
} from './db'
import { resolvePricingVersionForContract, type PricingVersionSelection } from './versioning'

/**
 * ✅ Enterprise type: resolve selectionMode type without "any" or nested infer chains.
 * This keeps the function signature stable but avoids TS recursion/edge cases.
 */
type ResolverResult = Awaited<ReturnType<typeof resolvePricingVersionForContract>>
type SelectionMode = ResolverResult extends { selectionMode: infer M } ? M : never

export async function computeCustomerSpecDomain(params: {
  ctx: EngineContext
  contract: ContractProduct
  priceArea: PriceArea
  kwh: number
  selection?: PricingVersionSelection
}): Promise<{ spec: CustomerSpecResult; selectionMode: SelectionMode }> {
  const now = params.ctx.now ?? new Date()
  const vatRate = clampVatRate(safeNumber(params.ctx.vatRate, 0.25))
  assertPositiveKwh(params.kwh)

  const resolved = await resolvePricingVersionForContract({
    supabase: params.ctx.supabase,
    contractId: params.contract.id,
    selection: params.selection,
  })

  const version = resolved.version
  const selectionMode = resolved.selectionMode

  if (!version) {
    throw new Error(
      'Ingen prisversion hittades för vald selection. Kontrollera publish/draft/version-id.'
    )
  }

  const pricingVersionId = version.id

  const areaPricing = await fetchAreaPricing(
    params.ctx.supabase,
    pricingVersionId,
    params.priceArea
  )

  const lines: MoneySpecLine[] = []

  let baseEnergyOre = 0
  let markupOre = 0
  let variableFeeOre = 0
  let elcertOre = 0
  let monthlyFeeSek = 0

  let spotBasis:
    | {
        year: number
        month: number
        avgSpotOre: number
        source?:
          | 'gridex_monthly_spot_prices'
          | 'gridex_spot_monthly_avg'
          | 'elprisetjustnu_api'
      }
    | undefined

  // These are kept to preserve existing diagnostics shape (enterprise)
  let spotKey: 'pricing_version_id' | 'contract_id' = 'pricing_version_id'
  let portKey: 'pricing_version_id' | 'contract_id' = 'pricing_version_id'

  let spotHasElcertOre = true
  let portfolioHasElcertOre = true

  if (params.contract.contract_type === 'spot_hourly') {
    // ✅ Enterprise: spot basis uses ACTIVE admin-selected year/month (with fallback logic in db.ts)
    const spot = await fetchPrevMonthlySpotAvg(params.ctx.supabase, params.priceArea, now)
    if (!spot) {
      throw new Error(
        'Spot-pris (aktiv vald period eller fallback föregående månad) saknas för området.'
      )
    }

    spotBasis = spot
    baseEnergyOre = spot.avgSpotOre

    const { settings, keyMode, probes } = await fetchSpotSettings(params.ctx.supabase, {
      pricingVersionId,
      contractId: params.contract.id,
      priceArea: params.priceArea,
    })

    spotKey = keyMode
    spotHasElcertOre = probes.spotHasElcertOre

    if (!settings) {
      // Backward-compat fallback (should not happen often once data is complete)
      markupOre = safeNumber(areaPricing?.markup_ore, 0)
      monthlyFeeSek = safeNumber(areaPricing?.monthly_fee_sek, 0)
      variableFeeOre = safeNumber(areaPricing?.variable_fee_ore, 0)
      elcertOre = safeNumber(areaPricing?.elcert_ore, 0)
    } else {
      markupOre = safeNumber(settings.markup_ore, 0)
      variableFeeOre = safeNumber(settings.variable_fee_ore, 0)
      monthlyFeeSek = safeNumber(settings.monthly_fee_sek, 0)
      elcertOre = safeNumber(settings.elcert_ore, 0)
    }

    lines.push({
      key: 'spot',
      label: 'Elpris (föregående månads spotpris)',
      orePerKwh: baseEnergyOre,
      note: `${spot.year}-${String(spot.month).padStart(2, '0')}`,
    })
    lines.push({ key: 'markup', label: 'Påslag', orePerKwh: markupOre })
    lines.push({ key: 'variable', label: 'Rörliga avgifter', orePerKwh: variableFeeOre })
    lines.push({
      key: 'elcert',
      label: 'Elcertifikat',
      orePerKwh: elcertOre,
      note: !spotHasElcertOre ? 'Kolumn saknas i schema (framtida)' : undefined,
    })
    lines.push({ key: 'monthly', label: 'Fast månadsavgift', sekPerMonth: monthlyFeeSek })
  } else {
    const { row: portfolio, keyMode, probes } = await fetchPortfolioPricing(params.ctx.supabase, {
      pricingVersionId,
      contractId: params.contract.id,
      priceArea: params.priceArea,
    })

    portKey = keyMode
    portfolioHasElcertOre = probes.portfolioHasElcertOre

    if (portfolio) {
      baseEnergyOre = safeNumber(portfolio.fixed_price_ore, 0)
      variableFeeOre = safeNumber(portfolio.variable_fee_ore, 0)
      monthlyFeeSek = safeNumber(portfolio.monthly_fee_sek, 0)
      elcertOre = safeNumber(portfolio.elcert_ore, 0)
    } else {
      // Backward-compat fallback (should not happen often once data is complete)
      baseEnergyOre = safeNumber(areaPricing?.price_per_kwh_ore, 0)
      monthlyFeeSek = safeNumber(areaPricing?.monthly_fee_sek, 0)
      variableFeeOre = safeNumber(areaPricing?.variable_fee_ore, 0)
      elcertOre = safeNumber(areaPricing?.elcert_ore, 0)
    }

    lines.push({
      key: 'fixed',
      label: params.contract.contract_type === 'fixed' ? 'Fast elpris' : 'Portföljpris',
      orePerKwh: baseEnergyOre,
    })
    lines.push({ key: 'variable', label: 'Rörliga avgifter', orePerKwh: variableFeeOre })
    lines.push({
      key: 'elcert',
      label: 'Elcertifikat',
      orePerKwh: elcertOre,
      note: !portfolioHasElcertOre ? 'Kolumn saknas i schema (framtida)' : undefined,
    })
    lines.push({ key: 'monthly', label: 'Fast månadsavgift', sekPerMonth: monthlyFeeSek })
  }

  const totalOrePerKwh = baseEnergyOre + markupOre + variableFeeOre + elcertOre
  const energySubtotalSek = Math.round((params.kwh * totalOrePerKwh) / 100)
  const totalMonthlyCostSek = energySubtotalSek + monthlyFeeSek
  const totalMonthlyCostInclVatSek = Math.round(totalMonthlyCostSek * (1 + vatRate))

  lines.push({
    key: 'total',
    label: 'Totalt (prisrad) exkl. moms',
    orePerKwh: totalOrePerKwh,
    sekPerMonth: totalMonthlyCostSek,
  })

  lines.push({
    key: 'total_incl_vat',
    label: `Totalt inkl. moms (${Math.round(vatRate * 100)}%)`,
    sekPerMonth: totalMonthlyCostInclVatSek,
  })

  const spec: CustomerSpecResult = {
    contract: params.contract,
    priceArea: params.priceArea,
    kwh: params.kwh,
    pricingVersion: version,
    totalOrePerKwh,
    totalMonthlyCostSek,
    totalMonthlyCostInclVatSek,
    energySubtotalSek,
    lines,
    diagnostics: {
      vatRate,
      spotBasis,
      sources: {
        versionSelection: resolved.probes.versionsHasStatus ? 'status' : 'is_published',
        spotSettingsKey: spotKey,
        portfolioKey: portKey,
      },
      schemaProbes: {
        spotHasElcertOre,
        portfolioHasElcertOre,
        versionsHasStatus: resolved.probes.versionsHasStatus,
        versionsHasIsPublished: resolved.probes.versionsHasIsPublished,
      },
    },
  }

  return { spec, selectionMode }
}