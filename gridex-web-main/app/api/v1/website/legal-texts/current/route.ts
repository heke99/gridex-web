import { NextResponse } from 'next/server'
import { fetchOpsLegalTextsCurrent, getOpsClientStatus } from '@/lib/ops/client'

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
    const data = await fetchOpsLegalTextsCurrent()
    return NextResponse.json({ data })
  } catch {
    return NextResponse.json(
      { error: 'Juridiska texter kan inte hämtas just nu.' },
      { status: 502 }
    )
  }
}
