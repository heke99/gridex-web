import { NextResponse } from 'next/server'
import { getCustomerPortalOverview } from '@/lib/customerPortal/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    const overview = await getCustomerPortalOverview()
    return NextResponse.json({ data: overview.sites })
  } catch {
    return NextResponse.json(
      { error: 'Du behöver logga in för att se dina uppgifter.' },
      { status: 401 }
    )
  }
}
