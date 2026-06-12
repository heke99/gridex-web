import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST() {
  return NextResponse.json(
    {
      error:
        'Det tidigare beställningsflödet är stängt. Använd sidan Teckna elavtal.',
    },
    { status: 410 }
  )
}
