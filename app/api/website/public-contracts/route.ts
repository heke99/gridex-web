import { NextResponse } from 'next/server'
import { fetchOpsPublicContracts, getOpsClientStatus } from '@/lib/ops/client'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const status = getOpsClientStatus()

  if (!status.configured) {
    return NextResponse.json(
      {
        error: 'OPS API är inte konfigurerat för hemsidan.',
        missing: status.missing,
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
            ? error.message
            : 'Kunde inte hämta publicerade avtal från OPS.',
      },
      { status: 502 }
    )
  }
}
