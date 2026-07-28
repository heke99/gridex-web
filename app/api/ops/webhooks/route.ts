import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: 'legacy_webhook_route_removed',
        message: 'Use /webhooks/contracts.publication.changed.',
      },
    },
    {
      status: 410,
      headers: {
        Link: '</webhooks/contracts.publication.changed>; rel="successor-version"',
      },
    },
  )
}
