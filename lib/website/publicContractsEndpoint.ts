import { NextResponse } from 'next/server'
import { fetchOpsPublicContractsSnapshot, getOpsClientStatus } from '@/lib/ops/client'
import { parseWebsiteCustomerType, type WebsiteCustomerType } from '@/lib/website/customerType'
import { toBrowserPublicContract } from '@/lib/website/publicDtos'

function customerType(request: Request): { value: WebsiteCustomerType | null; valid: boolean } {
  const raw = new URL(request.url).searchParams.get('customer_type')
  if (!raw) return { value: null, valid: true }
  const value = parseWebsiteCustomerType(raw)
  return value ? { value, valid: true } : { value: null, valid: false }
}

function etagMatches(request: Request, etag: string | null): boolean {
  if (!etag) return false
  return (request.headers.get('if-none-match') ?? '')
    .split(',')
    .map((value) => value.trim())
    .includes(etag)
}

export async function publicContractsResponse(request: Request) {
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
    const snapshot = await fetchOpsPublicContractsSnapshot(filter.value)
    const headers = new Headers({
      'Cache-Control': 'public, no-cache, must-revalidate',
      'Vary': 'Accept-Encoding, If-None-Match',
    })
    if (snapshot.etag) headers.set('ETag', snapshot.etag)
    if (snapshot.publication_revision) {
      headers.set('X-Gridex-Publication-Revision', snapshot.publication_revision)
    }

    if (etagMatches(request, snapshot.etag)) {
      return new NextResponse(null, { status: 304, headers })
    }

    return NextResponse.json(
      {
        data: snapshot.contracts.map(toBrowserPublicContract),
        meta: {
          tenant_reference: snapshot.tenant_reference,
          channel: 'website',
          publication_revision: snapshot.publication_revision,
        },
      },
      { headers },
    )
  } catch (error) {
    console.error('[website public-contracts] OPS request failed', error)
    return NextResponse.json({ error: 'Aktuella elavtal kan inte hämtas just nu.' }, { status: 502 })
  }
}
