import { NextResponse } from 'next/server'
import { customerResourceResponse } from '@/lib/customerPortal/resourceRoute'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ id: string }>
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = decodeURIComponent(value).trim()
  return trimmed ? trimmed : null
}

export async function GET(_request: Request, context: RouteContext) {
  const { id: rawId } = await context.params
  const id = text(rawId)

  if (!id) {
    return NextResponse.json(
      { error: 'Faktura-id saknas.', code: 'missing_invoice_id' },
      { status: 400 },
    )
  }

  return customerResourceResponse('invoices', id)
}
