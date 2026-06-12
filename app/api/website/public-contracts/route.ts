import { NextResponse } from 'next/server'
import { fetchOpsPublicContracts, getOpsClientStatus } from '@/lib/ops/client'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const status = getOpsClientStatus()

  if (!status.configured) {
    return NextResponse.json(
      {
        error: 'Aktuella elavtal kan inte hämtas just nu.',
      },
      { status: 503 }
    )
  }

  try {
    const data = await fetchOpsPublicContracts()
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? 'Aktuella elavtal kan inte hämtas just nu.'
            : 'Aktuella elavtal kan inte hämtas just nu.',
      },
      { status: 502 }
    )
  }
}
