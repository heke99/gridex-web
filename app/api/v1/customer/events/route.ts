import { NextResponse } from 'next/server'
import { getCustomerPortalOverview } from '@/lib/customerPortal/service'

export async function GET() {
  try {
    const overview = await getCustomerPortalOverview()
    return NextResponse.json({ data: overview.events })
  } catch (error) {
    console.error('[customer portal] events route failed', error)
    return NextResponse.json(
      { error: 'Händelserna kunde inte hämtas just nu.' },
      { status: 500 },
    )
  }
}
