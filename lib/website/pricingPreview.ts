import {
  type OpsPublicContract,
  type OpsWebsitePricingPreview,
  type OpsWebsitePricingPreviewInput,
  fetchOpsWebsiteQuote,
} from '@/lib/ops/client'
import { buildPublicContractDisplay } from '@/lib/website/publicContractDisplay'

const PREVIEW_CACHE_TTL_MS = 60_000
const previewCache = new Map<string, { expiresAt: number; value: OpsWebsitePricingPreview }>()

export class WebsitePricingPreviewError extends Error {}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function previewFees(data: OpsWebsitePricingPreview): Record<string, unknown> {
  const specification = data.specification
  if (!specification || typeof specification !== 'object' || !('fees' in specification)) return {}
  const fees = (specification as { fees?: unknown }).fees
  return fees && typeof fees === 'object' && !Array.isArray(fees) ? (fees as Record<string, unknown>) : {}
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
  return {
    ...data,
    contract: {
      slug: contract.offer_reference,
      offer_reference: contract.offer_reference,
      name: contract.name,
      contractType: data.contract.contractType,
    },
    specification: {
      ...(data.specification ?? {}),
      fees,
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
  if (!matchesReturnedContract(data, contract)) throw new WebsitePricingPreviewError('Prisberäkningen returnerade ett annat avtal än det kunden valde.')
  if ((data.price_area_code ?? data.priceArea) !== input.price_area_code) {
    throw new WebsitePricingPreviewError('Prisberäkningen returnerade ett annat elområde än det som beräknades.')
  }
  if (!finite(data.kwh) || Math.abs(data.kwh - input.estimated_monthly_kwh) > 0.001) {
    throw new WebsitePricingPreviewError('Prisberäkningen avser en annan förbrukning.')
  }
  if (!finite(data.pricePerKwhOre) || !finite(data.totalMonthlyCostSek) || !finite(data.totalMonthlyCostInclVatSek)) {
    throw new WebsitePricingPreviewError('Prisberäkningen är inte komplett.')
  }
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

  const raw = await fetchOpsWebsiteQuote(input)
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
