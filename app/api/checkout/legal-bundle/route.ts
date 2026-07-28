import { NextResponse } from 'next/server'
import { fetchOpsWebsiteLegalBundle, getOpsClientStatus, isOpsError } from '@/lib/ops/client'
import { toBrowserLegalBundle } from '@/lib/website/publicDtos'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const offerReference = new URL(request.url).searchParams.get('offer_reference')?.trim()
  if (!offerReference) {
    return NextResponse.json(
      {
        error: {
          code: 'offer_reference_required',
          message: 'Valt erbjudande saknas.',
          field: 'offer_reference',
          retryable: false,
          request_id: crypto.randomUUID(),
        },
      },
      { status: 400, headers: { 'Cache-Control': 'private, no-store' } },
    )
  }
  const status = getOpsClientStatus()
  if (!status.configured) {
    return NextResponse.json({ error: 'Juridiska underlag kan inte hämtas just nu.' }, { status: 503 })
  }
  try {
    const data = toBrowserLegalBundle(
      await fetchOpsWebsiteLegalBundle(offerReference),
    )
    return NextResponse.json({ data }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: isOpsError(error) ? error.code ?? 'legal_bundle_failed' : 'legal_bundle_failed',
          message: 'Juridiska underlag kan inte hämtas just nu.',
          retryable: isOpsError(error) ? error.retryable : true,
          request_id: isOpsError(error) ? error.requestId ?? crypto.randomUUID() : crypto.randomUUID(),
        },
      },
      { status: isOpsError(error) ? error.status : 502 },
    )
  }
}
