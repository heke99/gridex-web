import { NextResponse } from 'next/server'
import { CustomerPortalAccessError, getCustomerPortalOverview } from '@/lib/customerPortal/service'

function errorResponse(error: unknown) {
  if (error instanceof CustomerPortalAccessError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    )
  }

  console.error('[customer portal] portal-bundle route failed', error)
  return NextResponse.json(
    { error: 'Kunduppgifterna kan inte hämtas just nu. Försök igen om en stund.', code: 'customer_portal_unavailable' },
    { status: 503 },
  )
}

export async function GET() {
  try {
    const overview = await getCustomerPortalOverview()
    return NextResponse.json({ data: overview })
  } catch (error) {
    return errorResponse(error)
  }
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const overview = await getCustomerPortalOverview({
      email: text(body.email),
      customerNumber: text(body.customer_number ?? body.customerNumber),
      externalCustomerId: text(body.external_customer_id ?? body.externalCustomerId),
    })
    return NextResponse.json({ data: overview })
  } catch (error) {
    return errorResponse(error)
  }
}
