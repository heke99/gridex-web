import { NextResponse } from 'next/server'
import { fetchOpsPricePlans, getOpsClientStatus } from '@/lib/ops/client'
import { toBrowserPricePlan } from '@/lib/website/publicDtos'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const status = getOpsClientStatus()

  if (!status.configured) {
    return NextResponse.json(
      { error: 'Prisinformation kan inte hämtas just nu.' },
      { status: 503 }
    )
  }

  try {
    const data = (await fetchOpsPricePlans()).map(toBrowserPricePlan)
    return NextResponse.json(
      { data },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
    )
  } catch {
    return NextResponse.json(
      { error: 'Prisinformation kan inte hämtas just nu.' },
      { status: 502 }
    )
  }
}
