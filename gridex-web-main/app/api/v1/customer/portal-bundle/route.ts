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

export async function POST() {
  return GET()
}
