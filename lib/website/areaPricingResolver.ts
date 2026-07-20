import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { OpsPublicContract } from '@/lib/ops/client'
import {
  fetchActivePublishedPricingVersion,
  fetchAreaPricing,
  tryQuery,
} from '@/lib/gridex/pricing/db'
import type { PriceArea } from '@/lib/gridex/pricing/types'
import {
  extractEmbeddedAreaPricing,
  type EmbeddedPricingModel,
} from '@/lib/website/embeddedAreaPricing'

export type ResolvedWebsiteAreaPricing = {
  fixedPriceOrePerKwh: number | null
  portfolioPriceOrePerKwh: number | null
  markupOrePerKwh: number | null
  variableFeeOrePerKwh: number | null
  elcertOrePerKwh: number | null
  monthlyFeeSek: number | null
  invoiceFeeSek: number | null
  spotShare: number | null
  portfolioShare: number | null
  source: 'embedded_public_contract' | 'contract_area_pricing' | 'public_contract' | 'combined'
  pricingVersionId: string | null
}

let cachedSupabase: SupabaseClient | null | undefined

function optionalSupabase(): SupabaseClient | null {
  if (cachedSupabase !== undefined) return cachedSupabase
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !serviceKey) {
    cachedSupabase = null
    return cachedSupabase
  }
  cachedSupabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cachedSupabase
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function finite(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(typeof value === 'string' ? value.trim().replace(',', '.') : value)
  return Number.isFinite(parsed) ? parsed : null
}

function firstText(rows: Array<Record<string, unknown> | null>, keys: string[]): string | null {
  for (const row of rows) {
    if (!row) continue
    for (const key of keys) {
      const value = text(row[key])
      if (value) return value
    }
  }
  return null
}

function firstNumber(...values: Array<number | null | undefined>): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value
  }
  return null
}

type LocalContractRow = {
  id: string
  name: string | null
  slug: string | null
  contract_type: string | null
}

function normalized(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .toLocaleLowerCase('sv-SE')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function localContractType(model: EmbeddedPricingModel): string | null {
  if (model === 'fixed') return 'fixed'
  if (model === 'portfolio') return 'portfolio_managed'
  if (model === 'variable') return 'spot_hourly'
  if (model === 'mix') return 'mix'
  return null
}

async function resolveLocalContractId(
  supabase: SupabaseClient,
  contract: OpsPublicContract,
  model: EmbeddedPricingModel,
): Promise<string | null> {
  const raw = contract.raw ?? {}
  const candidateSlugs = Array.from(
    new Set(
      [
        contract.product_code,
        text(raw.slug),
        text(raw.contract_slug),
        text(raw.contractSlug),
        text(raw.code),
        contract.offer_reference,
      ]
        .map((value) => normalized(value))
        .filter(Boolean),
    ),
  )

  for (const slug of candidateSlugs) {
    const result = await tryQuery<LocalContractRow | null>(
      supabase
        .from('contract_products')
        .select('id,name,slug,contract_type')
        .eq('slug', slug)
        .limit(1)
        .maybeSingle(),
    )
    if (result.data?.id) return result.data.id
  }

  const nameResult = await tryQuery<LocalContractRow[]>(
    supabase
      .from('contract_products')
      .select('id,name,slug,contract_type')
      .eq('name', contract.name)
      .limit(5),
  )
  const rows = nameResult.data ?? []
  if (rows.length === 1) return rows[0]?.id ?? null

  const expectedType = localContractType(model)
  const exactTypeRows = expectedType
    ? rows.filter((row) => row.contract_type === expectedType)
    : rows
  return exactTypeRows.length === 1 ? exactTypeRows[0]?.id ?? null : null
}

function pricingIds(contract: OpsPublicContract): {
  contractId: string | null
  pricingVersionId: string | null
} {
  const raw = contract.raw ?? {}
  const pricing = record(raw.pricing)
  const version = record(raw.price_plan_version) ?? record(raw.pricePlanVersion) ?? record(raw.version)

  return {
    contractId:
      contract.contract_id ??
      firstText([raw, pricing, version], [
        'contract_id',
        'contractId',
        'contract_product_id',
        'contractProductId',
      ]),
    pricingVersionId:
      contract.price_plan_version_id ??
      firstText([raw, pricing, version], [
        'pricing_version_id',
        'pricingVersionId',
        'price_plan_version_id',
        'pricePlanVersionId',
        'price_version_id',
        'priceVersionId',
        'version_id',
        'versionId',
      ]),
  }
}

async function databaseAreaPricing(params: {
  contract: OpsPublicContract
  priceAreaCode: PriceArea
  now?: Date
  model: EmbeddedPricingModel
}): Promise<{
  basePriceOrePerKwh: number | null
  markupOrePerKwh: number | null
  variableFeeOrePerKwh: number | null
  elcertOrePerKwh: number | null
  monthlyFeeSek: number | null
  pricingVersionId: string | null
} | null> {
  const supabase = optionalSupabase()
  if (!supabase) return null

  const ids = pricingIds(params.contract)
  let pricingVersionId = ids.pricingVersionId
  let contractId = ids.contractId

  if (pricingVersionId) {
    const directRow = await fetchAreaPricing(supabase, pricingVersionId, params.priceAreaCode)
    if (directRow) {
      return {
        basePriceOrePerKwh: finite(directRow.price_per_kwh_ore),
        markupOrePerKwh: finite(directRow.markup_ore),
        variableFeeOrePerKwh: finite(directRow.variable_fee_ore),
        elcertOrePerKwh: finite(directRow.elcert_ore),
        monthlyFeeSek: finite(directRow.monthly_fee_sek),
        pricingVersionId,
      }
    }
    pricingVersionId = null
  }

  if (contractId) {
    const version = await fetchActivePublishedPricingVersion(
      supabase,
      contractId,
      (params.now ?? new Date()).toISOString(),
    )
    pricingVersionId = version?.id ?? null
  }

  if (!pricingVersionId) {
    contractId = await resolveLocalContractId(supabase, params.contract, params.model)
    if (contractId) {
      const version = await fetchActivePublishedPricingVersion(
        supabase,
        contractId,
        (params.now ?? new Date()).toISOString(),
      )
      pricingVersionId = version?.id ?? null
    }
  }

  if (!pricingVersionId) return null
  const row = await fetchAreaPricing(supabase, pricingVersionId, params.priceAreaCode)
  if (!row) return null

  return {
    basePriceOrePerKwh: finite(row.price_per_kwh_ore),
    markupOrePerKwh: finite(row.markup_ore),
    variableFeeOrePerKwh: finite(row.variable_fee_ore),
    elcertOrePerKwh: finite(row.elcert_ore),
    monthlyFeeSek: finite(row.monthly_fee_sek),
    pricingVersionId,
  }
}

export async function resolveWebsiteAreaPricing(params: {
  contract: OpsPublicContract
  priceAreaCode: PriceArea
  model: EmbeddedPricingModel
  now?: Date
  allowDatabase?: boolean
}): Promise<ResolvedWebsiteAreaPricing> {
  const embedded = extractEmbeddedAreaPricing(
    params.contract.raw,
    params.priceAreaCode,
    params.model,
  )
  const database = params.allowDatabase === false
    ? null
    : await databaseAreaPricing(params).catch((error) => {
        console.warn('[website pricing] contract_area_pricing lookup failed', {
          offer_reference: params.contract.offer_reference,
          price_area_code: params.priceAreaCode,
          message: error instanceof Error ? error.message : String(error),
        })
        return null
      })

  const hasEmbedded = embedded.matchedRows > 0
  const hasDatabase = Boolean(database)
  const source = hasEmbedded && hasDatabase
    ? 'combined'
    : hasEmbedded
      ? 'embedded_public_contract'
      : hasDatabase
        ? 'contract_area_pricing'
        : 'public_contract'

  const basePrice = firstNumber(
    embedded.basePriceOrePerKwh,
    database?.basePriceOrePerKwh,
  )

  return {
    fixedPriceOrePerKwh: firstNumber(
      embedded.fixedPriceOrePerKwh,
      params.model === 'fixed' ? basePrice : null,
      params.contract.fixed_price_ore_per_kwh,
    ),
    portfolioPriceOrePerKwh: firstNumber(
      embedded.portfolioPriceOrePerKwh,
      params.model === 'portfolio' || params.model === 'mix' ? basePrice : null,
      params.contract.portfolio_price_ore_per_kwh,
      params.model === 'portfolio' || params.model === 'mix'
        ? params.contract.fixed_price_ore_per_kwh
        : null,
    ),
    markupOrePerKwh: firstNumber(
      embedded.markupOrePerKwh,
      database?.markupOrePerKwh,
      params.contract.markup_ore_per_kwh,
    ),
    variableFeeOrePerKwh: firstNumber(
      embedded.variableFeeOrePerKwh,
      database?.variableFeeOrePerKwh,
      params.contract.variable_markup_ore_per_kwh,
    ),
    elcertOrePerKwh: firstNumber(
      embedded.elcertOrePerKwh,
      database?.elcertOrePerKwh,
      params.contract.elcert_ore_per_kwh,
    ),
    monthlyFeeSek: firstNumber(
      embedded.monthlyFeeSek,
      database?.monthlyFeeSek,
      params.contract.monthly_fee_sek,
    ),
    invoiceFeeSek: firstNumber(
      embedded.invoiceFeeSek,
      params.contract.invoice_fee_sek,
    ),
    spotShare: firstNumber(embedded.spotShare, params.contract.spot_share),
    portfolioShare: firstNumber(embedded.portfolioShare, params.contract.portfolio_share),
    source,
    pricingVersionId: database?.pricingVersionId ?? pricingIds(params.contract).pricingVersionId,
  }
}
