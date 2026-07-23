import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
export async function POST() {
  return NextResponse.json({ error: { code: 'endpoint_removed', replacement: '/api/v1/website/pricing/preview' } }, { status: 410 })
}
