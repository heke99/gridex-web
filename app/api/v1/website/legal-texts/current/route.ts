import { NextResponse } from 'next/server'
import { fetchOpsWebsiteLegalBundle, getOpsClientStatus } from '@/lib/ops/client'
import { toBrowserLegalText } from '@/lib/website/publicDtos'

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
    return NextResponse.json(
      { data: bundle.texts.map(toBrowserLegalText) },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch {
    return NextResponse.json(
      { error: 'Juridiska texter kan inte hämtas just nu.' },
      { status: 502 }
    )
  }
}
