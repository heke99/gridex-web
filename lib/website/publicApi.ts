export const WEBSITE_PRICE_AREAS = ['SE1', 'SE2', 'SE3', 'SE4'] as const

export type WebsitePriceArea = (typeof WEBSITE_PRICE_AREAS)[number]

export type WebsiteEnergyResolution = {
  status: string
  price_area_code: WebsitePriceArea | null
  grid_area_code?: string | null
  grid_owner_id?: string | null
  grid_owner_name?: string | null
  confidence?: number | null
  source?: string | null
  source_chain?: string[]
  customer_message?: string | null
  raw?: Record<string, unknown>
}

export type WebsiteEnergyResolveInput = {
  postal_code: string
  city?: string | null
  street?: string | null
  address?: string | null
  apartment?: string | null
}

export type WebsitePricingPreviewInput = {
  offer_reference?: string | null
  contract_id?: string | null
  price_plan_id?: string | null
  price_plan_version_id?: string | null
  product_code?: string | null
  price_area_code: WebsitePriceArea
  postal_code?: string | null
  city?: string | null
  address?: string | null
  estimated_monthly_kwh: number
}

export type WebsitePricingQuoteContext = {
  postal_code: string
  city: string
  address: string
  price_area_code: WebsitePriceArea
  estimated_monthly_kwh: number
}

export type WebsitePricingPreview = {
  contract: {
    slug: string
    offer_reference?: string | null
    name: string
    contractType: 'spot_hourly' | 'portfolio_managed' | 'fixed' | 'mix'
    price_plan_version_id?: string | null
    price_plan_id?: string | null
    product_code?: string | null
    contract_id?: string | null
  }
  priceArea: WebsitePriceArea
  price_area_code?: WebsitePriceArea
  kwh: number
  pricePerKwhOre: number
  totalMonthlyCostSek: number
  totalMonthlyCostInclVatSek?: number
  totalYearlyCostSek?: number
  customerNotice?: string
  legalText?: string
  specification?: {
    basis?:
      | {
          type: 'previous_month_avg_spot'
          year: number
          month: number
          spotAvgOre: number
          source?:
            | 'gridex_monthly_spot_prices'
            | 'gridex_spot_monthly_avg'
            | 'elprisetjustnu_api'
        }
      | {
          type: 'admin_fixed_price' | 'fixed_price'
          fixedPriceOre: number
        }
      | {
          type: 'mix'
          spotShare?: number
          portfolioShare?: number
          spotPriceOre?: number
          portfolioPriceOre?: number
          source?: string
        }
    fees?: {
      markupOre?: number
      variableFeeOre?: number
      elcertOre?: number
      monthlyFeeSek?: number
      invoiceFeeSek?: number
      invoiceFeeIncludedInMonthlyEstimate?: boolean
      billingIntervalMonths?: number
    }
  }
  quote_token?: string
  quote_expires_at?: string
  raw?: Record<string, unknown>
}

function extractErrorMessage(data: unknown, fallback: string): string {
  const raw =
    data && typeof data === 'object'
      ? (data as Record<string, unknown>).customer_message ??
        (data as Record<string, unknown>).message ??
        (data as Record<string, unknown>).error
      : typeof data === 'string'
        ? data
        : null

  const message = typeof raw === 'string' ? raw.trim() : ''

  if (
    !message ||
    /NEXT_REDIRECT|NEXT_HTTP_ERROR_FALLBACK|redirect|<!doctype|<html|text\/html|login|logga in/i.test(
      message
    )
  ) {
    return fallback
  }

  return message
}

function assertOkResponse(res: Response, data: unknown, fallback: string): void {
  if (res.ok) return
  throw new Error(extractErrorMessage(data, fallback))
}

async function readJsonResponse(res: Response): Promise<unknown> {
  const contentType = res.headers.get('content-type') ?? ''

  if (!contentType.includes('application/json')) {
    await res.text().catch(() => '')
    return null
  }

  return res.json().catch(() => null)
}

export function normalizeWebsitePostalCode(value: string): string {
  return value.replace(/\s+/g, '').trim()
}

export function isWebsitePriceArea(value: unknown): value is WebsitePriceArea {
  return typeof value === 'string' && WEBSITE_PRICE_AREAS.includes(value as WebsitePriceArea)
}

export async function resolveWebsiteEnergyArea(
  input: WebsiteEnergyResolveInput
): Promise<WebsiteEnergyResolution> {
  const res = await fetch('/api/v1/website/energy/resolve', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })
  const data = await readJsonResponse(res)
  assertOkResponse(res, data, 'Kunde inte kontrollera elområde just nu.')
  return (data && typeof data === 'object' && 'data' in data
    ? (data as { data: WebsiteEnergyResolution }).data
    : data) as WebsiteEnergyResolution
}

export async function previewWebsitePricing(
  input: WebsitePricingPreviewInput
): Promise<WebsitePricingPreview> {
  const res = await fetch('/api/v1/website/pricing/preview', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })
  const data = await readJsonResponse(res)
  assertOkResponse(res, data, 'Kunde inte räkna pris just nu.')
  return (data && typeof data === 'object' && 'data' in data
    ? (data as { data: WebsitePricingPreview }).data
    : data) as WebsitePricingPreview
}

export async function validateWebsitePricingQuote(input: {
  quote_token: string
  offer_reference: string
  price_area_code: WebsitePriceArea
  estimated_monthly_kwh: number
  postal_code: string
  city: string
  address: string
}): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('/api/v1/website/pricing/quote/validate', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = await readJsonResponse(res)
  if (res.ok && data && typeof data === 'object') return data as { ok: boolean; error?: string }
  return { ok: false, error: extractErrorMessage(data, 'Prisofferten kunde inte kontrolleras. Räkna om priset innan du går vidare.') }
}
