import { NextResponse } from 'next/server'
import { getCustomerPortalOverview } from '@/lib/customerPortal/service'
import { customerApiErrorResponse } from '@/lib/customerPortal/apiErrors'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    const overview = await getCustomerPortalOverview()
    return NextResponse.json({ data: overview.profile })
  } catch (error) {
    return customerApiErrorResponse(error, {
      logLabel: 'me',
      fallbackMessage: 'Kundprofilen kunde inte hämtas just nu.',
    })
  }
}
