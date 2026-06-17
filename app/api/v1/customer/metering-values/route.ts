import { NextResponse } from 'next/server'
import { getCustomerPortalOverview } from '@/lib/customerPortal/service'

export async function GET() {
  try {
    const overview = await getCustomerPortalOverview()
    return NextResponse.json({ data: overview.meteringValues })
  } catch (error) {
    console.error('[customer portal] metering-values route failed', error)
    return NextResponse.json(
      { error: 'Mätvärdena kunde inte hämtas just nu.' },
      { status: 500 },
    )
  }
}
