import { readInvoiceCursor } from '@/lib/customerPortal/invoicePagination'
import { webErrorResponse } from '@/lib/api/webBoundary'
import { customerResourceResponse } from '@/lib/customerPortal/resourceRoute'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  let cursor: string | null
  try {
    cursor = readInvoiceCursor(new URL(request.url).searchParams.getAll('cursor'))
  } catch {
    return webErrorResponse({ code: 'invalid_document_cursor', message: 'Ogiltig dokumentsida.', retryable: false }, 400)
  }
  return customerResourceResponse('documents', undefined, cursor ? new URLSearchParams({ cursor }) : undefined)
}
