import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Customer Portal OpenAPI does not define /api/v1/customer/switch-status.
 * Checkout status is exposed through the documented website switch-status route,
 * while authenticated portal status is obtained from portal-bundle/events.
 */
export async function GET() {
  return NextResponse.json(
    {
      error: {
        code: 'customer_switch_status_contract_unavailable',
        message: 'Bytesstatusen hämtas via Mina sidors översikt och händelser.',
      },
    },
    { status: 501, headers: { 'Cache-Control': 'private, no-store' } },
  )
}
