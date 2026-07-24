import { NextResponse } from 'next/server'
import { fetchOpsPublicContractsFresh, isOpsError } from '@/lib/ops/client'
import { contractSupportsCustomerType, parseWebsiteCustomerType } from '@/lib/website/customerType'
import { validateCanonicalWebsiteQuote } from '@/lib/website/canonicalQuoteValidation'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function text(value: unknown, max = 12_000): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  const customerType = parseWebsiteCustomerType(body?.customer_type) ?? 'private'
  const offerReference = text(body?.offer_reference, 180)
  const postalCode = text(body?.postal_code, 20).replace(/\s+/g, '')
  const city = text(body?.city, 180)
  const address = text(body?.address, 240)
  const estimatedMonthlyKwh = Number(body?.estimated_monthly_kwh)
  const annualConsumptionKwh = Number(body?.annual_consumption_kwh)
  const requestedStartMode = body?.requested_start_mode === 'specific_date' ? 'specific_date' : 'earliest_possible'
  const requestedStartDate = text(body?.requested_start_date, 30) || null

  if (!offerReference || !/^\d{5}$/.test(postalCode) || !city || !address ||
      !Number.isFinite(estimatedMonthlyKwh) || estimatedMonthlyKwh <= 0 ||
      !Number.isFinite(annualConsumptionKwh) || annualConsumptionKwh <= 0) {
    return NextResponse.json({ ok: false, error: { code: 'invalid_request' } }, { status: 400 })
  }

  try {
    const contracts = await fetchOpsPublicContractsFresh(customerType)
    const contract = contracts.find((item) => item.offer_reference === offerReference)
    if (!contract || !contractSupportsCustomerType(contract.customer_types, customerType)) {
      return NextResponse.json({ ok: false, error: { code: 'offer_not_available' } }, { status: 409 })
    }
    const result = await validateCanonicalWebsiteQuote({
      pricingToken: text(body?.pricing_token),
      pricingSnapshotReference: text(body?.pricing_snapshot_reference, 180) || null,
      resolutionToken: text(body?.resolution_token),
      contract,
      customerType,
      estimatedMonthlyKwh,
      annualConsumptionKwh,
      requestedStartMode,
      requestedStartDate,
      location: { postalCode, city, address },
    })
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: { code: result.reason } }, { status: 409 })
    }
    return NextResponse.json({
      ok: true,
      quote_reference: result.value.quote.ops_quote_reference,
      pricing_snapshot_reference: result.value.quote.pricing_snapshot_reference,
      resolution_reference: result.value.area.resolutionReference,
      valid_until: result.value.opsValidation.valid_until ?? result.value.quote.valid_until,
    })
  } catch (error) {
    const status = isOpsError(error) && error.status >= 400 && error.status < 500 ? error.status : 503
    return NextResponse.json({ ok: false, error: { code: 'ops_quote_validation_unavailable' } }, { status })
  }
}
