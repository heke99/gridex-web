import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(
    {
      error: 'Detta pris-API är stängt. Använd /api/v1/website/pricing/preview för lokal prisberäkning baserad på publicerad prisgrund.',
      replacement: '/api/v1/website/pricing/preview',
    },
    { status: 410 },
  )
}

export async function POST() {
  return NextResponse.json(
    {
      error: 'Detta pris-API är stängt. Använd /api/v1/website/pricing/preview för lokal prisberäkning baserad på publicerad prisgrund.',
      replacement: '/api/v1/website/pricing/preview',
    },
    { status: 410 },
  )
}
