import {
  type OpsPublicContract,
  type OpsWebsitePricingPreview,
  type OpsWebsitePricingPreviewInput,
  fetchOpsWebsiteQuote
} from '@/lib/ops/client'
import { buildPublicContractDisplay } from '@/lib/website/publicContractDisplay'

export class WebsitePricingPreviewError extends Error {}

export type WebsitePricingPreviewSource = 'ops'

export function websitePricingPreviewSource(
  _data: OpsWebsitePricingPreview,
): WebsitePricingPreviewSource {
  return 'ops'
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
  return data.contract.offer_reference === contract.offer_reference
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

async function loadRawPricingPreview(
  input: OpsWebsitePricingPreviewInput,
  _contract: OpsPublicContract,
): Promise<OpsWebsitePricingPreview> {
  return fetchOpsWebsiteQuote(input)
}

export async function loadVerifiedWebsitePricingPreview(
  input: OpsWebsitePricingPreviewInput,
  contract: OpsPublicContract,
): Promise<OpsWebsitePricingPreview> {
  const raw = await loadRawPricingPreview(input, contract)
  assertCompletePreview(raw, contract, input)
  const value = enrichWebsitePricingPreview({ ...raw, annual_consumption_kwh: input.annual_consumption_kwh ?? input.estimated_monthly_kwh * 12 }, contract)
  assertCompletePreview(value, contract, input)
  return value
}
