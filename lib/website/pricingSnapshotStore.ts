import { createHash, randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import type { OpsPublicContract } from '@/lib/ops/client'
import type { WebsiteCustomerType } from '@/lib/website/customerType'
import type { WebsitePricingPreview } from '@/lib/website/publicApi'

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
}): Promise<string> {
  const issuedAt = new Date().toISOString()
  const validUntil = input.preview.valid_until ?? input.preview.pricing_expires_at
  if (!validUntil || !Number.isFinite(Date.parse(validUntil))) {
    throw new Error('Website pricing snapshot has no valid expiry.')
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
    },
    price_area_code: input.preview.price_area_code ?? input.preview.priceArea,
    annual_consumption_kwh: annualConsumptionKwh,
    estimated_monthly_kwh: input.preview.kwh,
    price_per_kwh_ore: input.preview.pricePerKwhOre,
    specification: input.preview.specification ?? null,
    source_period: input.preview.source_period ?? null,
    market_data_timestamp: input.preview.market_data_timestamp ?? null,
  }
  const hash = snapshotHash(fullCalculation)

  const { error } = await serviceClient().from('website_pricing_snapshots').insert({
    pricing_snapshot_reference: reference,
    offer_reference: input.contract.offer_reference,
    customer_type: input.customerType,
    price_area_code: input.preview.price_area_code ?? input.preview.priceArea,
    annual_consumption_kwh: annualConsumptionKwh,
    calculation_components_json: fullCalculation,
    subtotal_ex_vat: subtotalExVat,
    vat_amount: Number((totalIncVat - subtotalExVat).toFixed(6)),
    total_inc_vat: totalIncVat,
    calculation_version: input.preview.pricing_snapshot_schema_version ?? 'website-pricing-v3',
    issued_at: issuedAt,
    valid_until: validUntil,
    snapshot_sha256: hash,
    status: 'issued',
  })

  if (error) throw new Error(`Website pricing snapshot storage failed: ${error.message}`)
  return reference
}
