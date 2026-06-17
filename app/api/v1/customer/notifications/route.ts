import { NextResponse } from 'next/server'
import { getCustomerPortalOverview } from '@/lib/customerPortal/service'

export async function GET() {
  try {
    const overview = await getCustomerPortalOverview()
    return NextResponse.json({ data: overview.notifications })
  } catch (error) {
    console.error('[customer portal] notifications route failed', error)
    return NextResponse.json(
      { error: 'Notiserna kunde inte hämtas just nu.' },
      { status: 500 },
    )
  }
}
