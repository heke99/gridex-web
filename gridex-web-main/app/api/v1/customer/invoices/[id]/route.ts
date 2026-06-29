import { NextResponse } from 'next/server'
import { CustomerPortalAccessError, getCustomerPortalOverview } from '@/lib/customerPortal/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ id: string }>
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = decodeURIComponent(value).trim()
  return trimmed ? trimmed : null
}

function invoiceMatches(invoice: Record<string, unknown>, id: string): boolean {
  const candidates = [
    invoice.id,
    invoice.invoice_number,
    invoice.external_invoice_ref,
    invoice.payment_reference,
    invoice.pdf_storage_path,
  ]
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())

  return candidates.some((candidate) => candidate === id)
}

function errorResponse(error: unknown) {
  if (error instanceof CustomerPortalAccessError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    )
  }

  console.error('[customer portal] invoice detail route failed', error)
  return NextResponse.json(
    { error: 'Fakturan kunde inte hämtas just nu.', code: 'customer_portal_unavailable' },
    { status: 503 },
  )
}

export async function GET(_request: Request, context: RouteContext) {
  const { id: rawId } = await context.params
  const id = text(rawId)

  if (!id) {
    return NextResponse.json(
      { error: 'Faktura-id saknas.', code: 'missing_invoice_id' },
      { status: 400 },
    )
  }

  try {
    const overview = await getCustomerPortalOverview()
    const invoice = overview.invoices.find((item) => invoiceMatches(item as Record<string, unknown>, id))

    if (!invoice) {
      return NextResponse.json(
        { error: 'Fakturan hittades inte för den inloggade kunden.', code: 'invoice_not_found' },
        { status: 404 },
      )
    }

    return NextResponse.json({ data: invoice })
  } catch (error) {
    return errorResponse(error)
  }
}
