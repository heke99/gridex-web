import { NextResponse } from 'next/server'
import { getCustomerPortalOverview } from '@/lib/customerPortal/service'
import { customerApiErrorResponse } from '@/lib/customerPortal/apiErrors'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    const overview = await getCustomerPortalOverview()
    return NextResponse.json({ data: overview.contracts })
  } catch (error) {
    return customerApiErrorResponse(error, {
      logLabel: 'contracts',
      fallbackMessage: 'Avtalen kunde inte hämtas just nu.',
    })
  }
}
