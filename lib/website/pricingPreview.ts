import {
  type OpsPublicContract,
  type OpsWebsitePricingPreview,
  type OpsWebsitePricingPreviewInput,
  fetchOpsWebsiteQuote,
  isOpsError,
} from '@/lib/ops/client'
import { buildPublicContractDisplay } from '@/lib/website/publicContractDisplay'
import { canUsePublishedPricingFallback } from '@/lib/website/pricingFallbackPolicy'
import {
  buildLocalWebsitePricingPreview,
  LocalWebsitePricingPreviewError,
} from '@/lib/website/localPricingPreview'
import {
  resolveWebsitePricingModel,
  usesDirectPublishedPricing,
} from '@/lib/website/contractPricingModel'

const PREVIEW_CACHE_TTL_MS = 60_000
const previewCache = new Map<string, { expiresAt: number; value: OpsWebsitePricingPreview }>()

export class WebsitePricingPreviewError extends Error {}

export type WebsitePricingPreviewSource = 'ops' | 'website'

export function websitePricingPreviewSource(
  data: OpsWebsitePricingPreview,
): WebsitePricingPreviewSource {
  const raw = record(data.raw)
  return raw?.source === 'gridex_web_local_pricing' ||
    raw?.source === 'elprisetjustnu_api' ||
    raw?.source === 'ops_public_contract' ||
    raw?.ops_quote_fallback === true
    ? 'website'
    : 'ops'
}

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

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function nestedText(value: unknown, keys: Set<string>, depth = 0): string | null {
  if (depth > 4 || !value || typeof value !== 'object') return null
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = nestedText(item, keys, depth + 1)
      if (found) return found
    }
    return null
  }
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (keys.has(key) && typeof item === 'string' && item.trim()) return item.trim()
    const found = nestedText(item, keys, depth + 1)
    if (found) return found
  }
  return null
}

function assertPortfolioQuoteBasis(
  data: OpsWebsitePricingPreview,
  contract: OpsPublicContract,
  input: OpsWebsitePricingPreviewInput,
): void {
  if (!['portfolio', 'portfolio_managed', 'mix', 'mixed'].includes(contract.type)) return
  const monthlyPrices = contract.portfolio_monthly_prices ?? []
  if (monthlyPrices.length === 0) return
  const basis = record(record(data.specification)?.basis)
  const year = Number(basis?.portfolio_year ?? basis?.year)
  const month = Number(basis?.portfolio_month ?? basis?.month)
  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    throw new WebsitePricingPreviewError('Portföljpriset saknar exakt publicerad prismånad.')
  }
  const published = monthlyPrices.find((item) =>
    item.year === year &&
    item.month === month &&
    item.price_area_code === input.price_area_code,
  )
  if (!published) {
    throw new WebsitePricingPreviewError('Portföljpriset är inte publicerat för vald månad och elområde.')
  }
  const quoteAmount = Number(basis?.portfolioPriceOre ?? basis?.portfolio_price_ore)
  if (Number.isFinite(quoteAmount) && Math.abs(quoteAmount - published.amount) > 0.0001) {
    throw new WebsitePricingPreviewError('Portföljpriset stämmer inte med publicerad månadsversion.')
  }
  if (published.price_plan_version_id) {
    const quoteVersion = nestedText(data.raw ?? data.specification, new Set([
      'price_plan_version_id',
      'pricePlanVersionId',
      'pricing_version_id',
      'pricingVersionId',
    ]))
    if (quoteVersion !== published.price_plan_version_id) {
      throw new WebsitePricingPreviewError('Portföljpriset avser inte den publicerade prisplansversionen.')
    }
  }
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
  assertPortfolioQuoteBasis(data, contract, input)
}

async function publishedPricingPreview(
  input: OpsWebsitePricingPreviewInput,
  contract: OpsPublicContract,
): Promise<OpsWebsitePricingPreview> {
  return buildLocalWebsitePricingPreview({
    contract,
    priceAreaCode: input.price_area_code,
    estimatedMonthlyKwh: input.estimated_monthly_kwh,
  })
}

async function loadRawPricingPreview(
  input: OpsWebsitePricingPreviewInput,
  contract: OpsPublicContract,
): Promise<OpsWebsitePricingPreview> {
  const model = resolveWebsitePricingModel(contract)

  // Public market-price agreements must use Elprisetjustnu directly. Fixed
  // agreements are calculated from the price and fees published by OPS in the
  // public contract DTO. Neither path may be replaced by a generic OPS quote.
  if (usesDirectPublishedPricing(model)) {
    return publishedPricingPreview(input, contract)
  }

  try {
    return await fetchOpsWebsiteQuote(input)
  } catch (error) {
    if (!canUsePublishedPricingFallback(error)) throw error

    console.warn('[website pricing] OPS quote route unavailable; using verified published pricing', {
      offer_reference: input.offer_reference,
      price_area_code: input.price_area_code,
      status: isOpsError(error) ? error.status : null,
      message: error instanceof Error ? error.message : String(error),
    })

    try {
      const local = await publishedPricingPreview(input, contract)
      return {
        ...local,
        raw: {
          ...(record(local.raw) ?? {}),
          ops_quote_fallback: true,
          ops_quote_status: isOpsError(error) ? error.status : null,
        },
      }
    } catch (fallbackError) {
      if (fallbackError instanceof LocalWebsitePricingPreviewError) throw fallbackError
      throw fallbackError
    }
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

  const raw = await loadRawPricingPreview(input, contract)
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
