import { NextResponse } from 'next/server'
import { fetchOpsWebsiteLegalBundle, getOpsClientStatus } from '@/lib/ops/client'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const status = getOpsClientStatus()

  if (!status.configured) {
    return NextResponse.json(
      { error: 'Juridiska texter kan inte hämtas just nu.' },
      { status: 503 }
    )
  }

  try {
    const bundle = await fetchOpsWebsiteLegalBundle()
    return NextResponse.json({ data: bundle.texts })
  } catch {
    return NextResponse.json(
      { error: 'Juridiska texter kan inte hämtas just nu.' },
      { status: 502 }
    )
  }
}
