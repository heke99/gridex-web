import {
  fetchOpsWebsitePricingPreview,
  type OpsPublicContract,
  type OpsWebsitePricingPreview,
  type OpsWebsitePricingPreviewInput,
} from '@/lib/ops/client'
import { buildPublicContractDisplay } from '@/lib/website/publicContractDisplay'

const PREVIEW_CACHE_TTL_MS = 60_000
const previewCache = new Map<string, { expiresAt: number; value: OpsWebsitePricingPreview }>()

export class WebsitePricingPreviewError extends Error {}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function normalizeFeeNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined
  const parsed = Number(typeof value === 'string' ? value.replace(',', '.') : value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function previewFees(data: OpsWebsitePricingPreview): Record<string, unknown> {
  const specification = data.specification
  if (!specification || typeof specification !== 'object' || !('fees' in specification)) return {}
  const fees = (specification as { fees?: unknown }).fees
  return fees && typeof fees === 'object' && !Array.isArray(fees) ? (fees as Record<string, unknown>) : {}
}

function preferPreviewValue(previewValue: unknown, contractValue: number | null | undefined): number | undefined {
  const normalized = normalizeFeeNumber(previewValue)
  return normalized ?? (finite(contractValue) ? contractValue : undefined)
}

function previewContractType(type: string): OpsWebsitePricingPreview['contract']['contractType'] {
  if (type === 'fixed') return 'fixed'
  if (type === 'portfolio' || type === 'portfolio_managed') return 'portfolio_managed'
  if (type === 'mix' || type === 'mixed') return 'mix'
  return 'spot_hourly'
}

function matchesReturnedContract(data: OpsWebsitePricingPreview, contract: OpsPublicContract): boolean {
  const returnedOfferReference = data.contract.offer_reference
  return !returnedOfferReference || returnedOfferReference === contract.offer_reference
}

export function enrichWebsitePricingPreview(
  data: OpsWebsitePricingPreview,
  contract: OpsPublicContract,
): OpsWebsitePricingPreview {
  const fees = previewFees(data)
  const enrichedFees = {
    ...fees,
    markupOre: preferPreviewValue(fees.markupOre ?? fees.markup_ore ?? fees.markup_ore_per_kwh, contract.markup_ore_per_kwh),
    variableFeeOre: preferPreviewValue(
      fees.variableFeeOre ?? fees.variable_fee_ore ?? fees.variable_fee_ore_per_kwh,
      contract.variable_markup_ore_per_kwh,
    ),
    monthlyFeeSek: preferPreviewValue(fees.monthlyFeeSek ?? fees.monthly_fee_sek, contract.monthly_fee_sek),
    invoiceFeeSek: preferPreviewValue(fees.invoiceFeeSek ?? fees.invoice_fee_sek, contract.invoice_fee_sek),
    invoiceFeeIncludedInMonthlyEstimate:
      typeof fees.invoiceFeeIncludedInMonthlyEstimate === 'boolean'
        ? fees.invoiceFeeIncludedInMonthlyEstimate
        : typeof fees.invoice_fee_included_in_monthly_estimate === 'boolean'
          ? fees.invoice_fee_included_in_monthly_estimate
          : typeof fees.invoiceFeeIncluded === 'boolean'
            ? fees.invoiceFeeIncluded
            : typeof fees.invoice_fee_included === 'boolean'
              ? fees.invoice_fee_included
              : undefined,
    billingIntervalMonths: normalizeFeeNumber(fees.billingIntervalMonths ?? fees.billing_interval_months),
  }

  return {
    ...data,
    contract: {
      slug: contract.offer_reference,
      offer_reference: contract.offer_reference,
      name: contract.name,
      contractType: previewContractType(contract.type),
    },
    specification: {
      ...(data.specification ?? {}),
      fees: enrichedFees,
      contract_display_snapshot: buildPublicContractDisplay(contract).snapshot,
    },
  }
}

function cacheKey(input: OpsWebsitePricingPreviewInput): string {
  return [
    input.offer_reference,
    input.price_area_code,
    input.postal_code?.replace(/\s/g, ''),
    input.city?.trim().toLowerCase(),
    input.address?.trim().toLowerCase(),
    input.estimated_monthly_kwh,
  ].join('|')
}

function assertCompletePreview(data: OpsWebsitePricingPreview, contract: OpsPublicContract, input: OpsWebsitePricingPreviewInput): void {
  if (!matchesReturnedContract(data, contract)) throw new WebsitePricingPreviewError('OPS returnerade ett annat avtal än det kunden valde.')
  if ((data.price_area_code ?? data.priceArea) !== input.price_area_code) {
    throw new WebsitePricingPreviewError('OPS returnerade ett annat elområde än det som beräknades.')
  }
  if (!finite(data.kwh) || Math.abs(data.kwh - input.estimated_monthly_kwh) > 0.001) {
    throw new WebsitePricingPreviewError('OPS returnerade en beräkning för en annan förbrukning.')
  }
  if (!finite(data.pricePerKwhOre) || !finite(data.totalMonthlyCostSek) || !finite(data.totalMonthlyCostInclVatSek)) {
    throw new WebsitePricingPreviewError('OPS returnerade inte en komplett prisberäkning.')
  }
  // Fakturaavgiftens inkluderingsflagga är kundinformation, inte ett hårt
  // krav för att kunna visa pris. Om OPS returnerar komplett totalsumma inkl.
  // moms ska kalkylatorn visa priset och UI:t får beskriva fakturaavgiften
  // neutralt när flaggan saknas.
  if (data.raw && typeof data.raw === 'object' && (data.raw as Record<string, unknown>).fallback_preview === true) {
    throw new WebsitePricingPreviewError('Ofullständig reservberäkning får inte användas för elavtal.')
  }
}

export async function loadVerifiedWebsitePricingPreview(
  input: OpsWebsitePricingPreviewInput,
  contract: OpsPublicContract,
): Promise<OpsWebsitePricingPreview> {
  const key = cacheKey(input)
  const now = Date.now()
  const cached = previewCache.get(key)
  if (cached && cached.expiresAt > now) return cached.value

  const raw = await fetchOpsWebsitePricingPreview(input)
  assertCompletePreview(raw, contract, input)
  const value = enrichWebsitePricingPreview(raw, contract)
  assertCompletePreview(value, contract, input)
  previewCache.set(key, { expiresAt: now + PREVIEW_CACHE_TTL_MS, value })

  if (previewCache.size > 250) {
    for (const [cacheKey, entry] of previewCache) {
      if (entry.expiresAt <= now) previewCache.delete(cacheKey)
    }
  }

  return value
}
