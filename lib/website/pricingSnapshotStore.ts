import { createHash, randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import type { OpsPublicContract } from '@/lib/ops/client'
import type { WebsiteCustomerType } from '@/lib/website/customerType'
import type { WebsitePricingPreview } from '@/lib/website/publicApi'
import { OpsError } from '@/lib/ops/errors'

function env(name: string): string | null {
  const value = process.env[name]?.trim()
  return value || null
}

function serviceClient() {
  const url = env('NEXT_PUBLIC_SUPABASE_URL')
  const key = env('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Website pricing snapshot storage is not configured.')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function snapshotHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

export async function persistWebsitePricingSnapshot(input: {
  preview: WebsitePricingPreview
  contract: OpsPublicContract
  customerType: WebsiteCustomerType
  /**
   * Used by server-side quote renewal. A deterministic reference makes retries
   * safe without replacing or mutating the original customer-visible snapshot.
   */
  idempotent?: boolean
}): Promise<string> {
  const issuedAt = new Date().toISOString()
  const validUntil = input.preview.valid_until
  const validUntilTimestamp = typeof validUntil === 'string' ? Date.parse(validUntil) : Number.NaN
  if (!Number.isFinite(validUntilTimestamp)) {
    throw new Error('Website pricing snapshot requires a canonical valid_until compatibility timestamp.')
  }

  const reference = input.preview.pricing_snapshot_reference ?? `wps_${randomUUID().replaceAll('-', '')}`
  const subtotalExVat = input.preview.totalMonthlyCostSek
  const totalIncVat = input.preview.totalMonthlyCostInclVatSek
  const annualConsumptionKwh = input.preview.annual_consumption_kwh
  if (!finite(subtotalExVat) || !finite(totalIncVat) || !finite(annualConsumptionKwh)) {
    throw new Error('Website pricing snapshot values are invalid.')
  }

  const fullCalculation = {
    contract: {
      offer_reference: input.contract.offer_reference,
      type: input.contract.type,
      pricing_model: input.contract.pricing_model ?? null,
      public_contract_etag: input.preview.public_contract_etag ?? null,
      publication_revision: input.preview.publication_revision ?? null,
    },
    price_area_code: input.preview.price_area_code ?? input.preview.priceArea,
    annual_consumption_kwh: annualConsumptionKwh,
    market_reference: input.preview.market_reference ?? null,
    market_price_snapshot_id: null,
    estimated_monthly_kwh: input.preview.kwh,
    price_per_kwh_ore: input.preview.pricePerKwhOre,
    specification: input.preview.specification ?? null,
    source_period: input.preview.source_period ?? null,
    market_data_timestamp: input.preview.market_data_timestamp ?? null,
  }
  const hash = snapshotHash(fullCalculation)

  const row = {
    pricing_snapshot_reference: reference,
    ops_quote_reference: input.preview.ops_quote_reference ?? null,
    ops_quote_valid_until: validUntil,
    ops_quote_payload_sha256: snapshotHash(input.preview.raw ?? input.preview),
    ops_quote_validation_status: 'issued',
    ops_publication_revision: input.preview.publication_revision ?? null,
    ops_public_contract_etag: input.preview.public_contract_etag ?? null,
    ops_contract_payload_sha256: input.preview.contract_payload_sha256 ?? null,
    offer_reference: input.contract.offer_reference,
    customer_type: input.customerType,
    price_area_code: input.preview.price_area_code ?? input.preview.priceArea,
    annual_consumption_kwh: annualConsumptionKwh,
    market_price_snapshot_id: null,
    calculation_components_json: fullCalculation,
    subtotal_ex_vat: subtotalExVat,
    vat_amount: Number((totalIncVat - subtotalExVat).toFixed(6)),
    total_inc_vat: totalIncVat,
    calculation_version: input.preview.pricing_snapshot_schema_version ?? 'website-pricing-v3',
    issued_at: issuedAt,
    valid_until: validUntil,
    snapshot_sha256: hash,
    status: 'issued',
  }

  const supabase = serviceClient()
  const { error } = await supabase.from('website_pricing_snapshots').insert(row)
  if (error) {
    if (error.code !== '23505') throw new Error(`Website pricing snapshot storage failed: ${error.message}`)
    // OPS returns the original canonical reference on an idempotent quote
    // replay. Keep the first audit row (including issued/validated times), and
    // only accept an equivalent calculation under that same reference.
    const { data: original, error: readError } = await supabase.from('website_pricing_snapshots')
      .select('snapshot_sha256,ops_quote_reference,offer_reference,customer_type,subtotal_ex_vat,total_inc_vat,calculation_version')
      .eq('pricing_snapshot_reference', reference)
      .maybeSingle()
    if (readError) throw new Error('Website pricing snapshot audit could not be read.')
    if (!original || original.snapshot_sha256 !== hash ||
      original.ops_quote_reference !== row.ops_quote_reference ||
      original.offer_reference !== row.offer_reference || original.customer_type !== row.customer_type ||
      Number(original.subtotal_ex_vat) !== subtotalExVat || Number(original.total_inc_vat) !== totalIncVat ||
      original.calculation_version !== row.calculation_version) {
      throw new OpsError('Prisreferensen har redan använts för ett annat underlag.', 409, {
        code: 'pricing_snapshot_conflict', retryable: false,
      })
    }
  }
  return reference
}

export async function markWebsitePricingSnapshotValidated(input: {
  pricingSnapshotReference: string
  quoteReference: string
  status: 'valid' | 'invalid'
  validatedAt?: string
}): Promise<void> {
  const { error } = await serviceClient()
    .from('website_pricing_snapshots')
    .update({
      ops_quote_reference: input.quoteReference,
      ops_quote_validation_status: input.status,
      ops_quote_validated_at: input.validatedAt ?? new Date().toISOString(),
    })
    .eq('pricing_snapshot_reference', input.pricingSnapshotReference)
    .eq('ops_quote_reference', input.quoteReference)
  if (error) throw new Error(`Website pricing validation audit failed: ${error.message}`)
}
