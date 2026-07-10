import { NextResponse } from 'next/server'
import { fetchOpsPublicContracts, getOpsClientStatus } from '@/lib/ops/client'

export const revalidate = 60
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type CustomerType = 'private' | 'company'

function customerType(request: Request): { value: CustomerType | null; valid: boolean } {
  const raw = new URL(request.url).searchParams.get('customer_type')
  if (!raw) return { value: null, valid: true }
  return raw === 'private' || raw === 'company'
    ? { value: raw, valid: true }
    : { value: null, valid: false }
}

export async function GET(request: Request) {
  const filter = customerType(request)
  if (!filter.valid) {
    return NextResponse.json(
      { error: { code: 'validation_error', message: 'customer_type måste vara private eller company.', field: 'customer_type' } },
      { status: 400 },
    )
  }

  const status = getOpsClientStatus()
  if (!status.configured) {
    return NextResponse.json({ error: 'Aktuella elavtal kan inte hämtas just nu.' }, { status: 503 })
  }

  try {
    const data = await fetchOpsPublicContracts(filter.value)
    return NextResponse.json(
      { data },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=60' } },
    )
  } catch (error) {
    console.error('[website contracts] OPS request failed', error)
    return NextResponse.json({ error: 'Aktuella elavtal kan inte hämtas just nu.' }, { status: 502 })
  }
}
