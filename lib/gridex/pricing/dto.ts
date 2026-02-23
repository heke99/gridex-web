// lib/gridex/pricing/dto.ts
// Enterprise DTO layer: stable external contract for API + Admin Preview.
// Internal engine can evolve without breaking clients.

import type { CustomerSpecResult, MoneySpecLine, PriceArea } from './types'

export type PriceQuoteDTOv1 = {
  version: 'v1'
  generatedAt: string
  contract: {
    id: string
    slug: string
    name: string
    contractType: string
  }
  priceArea: PriceArea
  kwh: number

  // Backward compatibility (existing clients)
  pricePerKwhOre: number
  totalMonthlyCostSek: number

  pricingVersion: {
    id: string
    versionNumber: number | null
    validFrom: string
    // Optional, depending on schema
    status?: string | null
    isPublished?: boolean | null
    selectionMode: 'published_now' | 'published_any' | 'by_id' | 'by_version_number' | 'draft_latest'
  }

  // New stable spec breakdown
  specification: {
    totalOrePerKwh: number
    energySubtotalSek: number
    totalMonthlyCostSek: number
    totalMonthlyCostInclVatSek: number
    vatRate: number
    lines: MoneySpecLine[]
  }

  diagnostics: CustomerSpecResult['diagnostics']
}

export function toPriceQuoteDTOv1(
  spec: CustomerSpecResult,
  selectionMode: PriceQuoteDTOv1['pricingVersion']['selectionMode'],
  now = new Date()
): PriceQuoteDTOv1 {
  return {
    version: 'v1',
    generatedAt: now.toISOString(),
    contract: {
      id: spec.contract.id,
      slug: spec.contract.slug,
      name: spec.contract.name,
      contractType: spec.contract.contract_type,
    },
    priceArea: spec.priceArea,
    kwh: spec.kwh,

    // Backward compatible
    pricePerKwhOre: spec.totalOrePerKwh,
    totalMonthlyCostSek: spec.totalMonthlyCostSek,

    pricingVersion: {
      id: spec.pricingVersion.id,
      versionNumber: spec.pricingVersion.version_number,
      validFrom: spec.pricingVersion.valid_from,
      status: spec.pricingVersion.status ?? null,
      isPublished: spec.pricingVersion.is_published ?? null,
      selectionMode,
    },

    specification: {
      totalOrePerKwh: spec.totalOrePerKwh,
      energySubtotalSek: spec.energySubtotalSek,
      totalMonthlyCostSek: spec.totalMonthlyCostSek,
      totalMonthlyCostInclVatSek: spec.totalMonthlyCostInclVatSek,
      vatRate: spec.diagnostics.vatRate,
      lines: spec.lines,
    },

    diagnostics: spec.diagnostics,
  }
}