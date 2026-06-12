import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST() {
  return NextResponse.json(
    {
      error:
        'Detta lokala beställningsflöde är stängt. Gridex-hemsidan ska skicka teckning server-side till Gridex OPS via /api/v1/website/customer-applications.',
    },
    { status: 410 }
  )
}
