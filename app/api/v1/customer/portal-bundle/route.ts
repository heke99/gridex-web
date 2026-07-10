import { NextResponse } from 'next/server'
import { getCustomerPortalOverview } from '@/lib/customerPortal/service'
import { customerApiErrorResponse } from '@/lib/customerPortal/apiErrors'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function handle() {
  try {
    const overview = await getCustomerPortalOverview()
    return NextResponse.json({ data: overview })
  } catch (error) {
    return customerApiErrorResponse(error, {
      logLabel: 'portal-bundle',
      fallbackMessage: 'Kunduppgifterna kan inte hämtas just nu. Försök igen om en stund.',
    })
  }
}

export async function GET() {
  return handle()
}

export async function POST() {
  // Customer identity is always derived from the verified server-side session/profile.
  // Request-body identity overrides are intentionally ignored.
  return handle()
}
