import { customerApiErrorResponse } from '@/lib/customerPortal/apiErrors'
import { openPortalInvoiceDocument } from '@/lib/customerPortal/service'
import { webErrorResponse } from '@/lib/api/webBoundary'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(_request: Request, { params }: {
  params: Promise<{ id: string; documentRef: string }>
}) {
  const { id, documentRef } = await params
  if ([id, documentRef].some(reference => !/^[A-Za-z0-9_-]{1,240}$/.test(reference))) {
    return webErrorResponse({ code: 'invalid_document_reference', message: 'Ogiltig dokumentreferens.', retryable: false }, 400)
  }

  try {
    const { url } = await openPortalInvoiceDocument(id, documentRef)
    return new Response(null, {
      status: 302,
      headers: { Location: url, 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' },
    })
  } catch (error) {
    return customerApiErrorResponse(error, {
      logLabel: 'invoice document',
      fallbackMessage: 'Fakturadokumentet är inte tillgängligt.',
    })
  }
}
