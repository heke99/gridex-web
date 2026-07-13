import { NextResponse } from 'next/server'
import { fetchOpsWebsiteLegalBundle, getOpsClientStatus, isOpsError } from '@/lib/ops/client'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const status = getOpsClientStatus()
  if (!status.configured) {
    return NextResponse.json({ error: 'Juridiska underlag kan inte hämtas just nu.' }, { status: 503 })
  }
  try {
    const data = await fetchOpsWebsiteLegalBundle()
    return NextResponse.json({ data }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return NextResponse.json(
      { error: 'Juridiska underlag kan inte hämtas just nu.' },
      { status: isOpsError(error) ? error.status : 502 },
    )
  }
}
