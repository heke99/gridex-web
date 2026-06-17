import { NextResponse } from 'next/server'
import { getCustomerPortalOverview } from '@/lib/customerPortal/service'

export async function GET() {
  try {
    const overview = await getCustomerPortalOverview()
    return NextResponse.json({ data: overview })
  } catch (error) {
    console.error('[customer portal] portal-bundle route failed', error)
    return NextResponse.json(
      { error: 'Kunduppgifterna kunde inte hämtas just nu.' },
      { status: 500 },
    )
  }
}

export async function POST() {
  return GET()
}
