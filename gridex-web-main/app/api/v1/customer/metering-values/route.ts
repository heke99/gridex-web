import { NextResponse } from 'next/server'
import { CustomerPortalAccessError, getCustomerPortalOverview } from '@/lib/customerPortal/service'

function customerRouteErrorResponse(error: unknown, logLabel: string, customerMessage: string) {
  if (error instanceof CustomerPortalAccessError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    )
  }

  console.error(`[customer portal] ${logLabel} route failed`, error)
  return NextResponse.json(
    { error: customerMessage, code: 'customer_portal_unavailable' },
    { status: 503 },
  )
}

export async function GET() {
  try {
    const overview = await getCustomerPortalOverview()
    return NextResponse.json({ data: overview.meteringValues })
  } catch (error) {
    return customerRouteErrorResponse(
      error,
      'metering-values',
      'Mätvärdena kunde inte hämtas just nu.',
    )
  }
}
