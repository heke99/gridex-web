import CustomerDocumentPages from '@/components/customer/CustomerDocumentPages'
import { readInvoiceCursor } from '@/lib/customerPortal/invoicePagination'
import PoaArchiveDocuments, { loadPoaArchiveDocuments } from '@/components/customer/PoaArchiveDocuments'
import { CustomerPortalAccessError, getCanonicalCustomerResource } from '@/lib/customerPortal/service'
import type { CustomerDocument } from '@/lib/customerPortal/types'
import type { Metadata } from 'next'

// Private page: ensure search engines do not index this page
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function DashboardDocumentsPage({ searchParams }: { searchParams: Promise<{ poa_cursor?: string | string[]; document_cursor?: string | string[] }> }) {
  const { poa_cursor: cursor, document_cursor } = await searchParams
  const archive = loadPoaArchiveDocuments(cursor)
  let documentCursor: string | undefined
  let resource: Awaited<ReturnType<typeof getCanonicalCustomerResource>> | null = null
  try {
    documentCursor = readInvoiceCursor(typeof document_cursor === 'string' ? [document_cursor] : document_cursor ?? []) ?? undefined
    resource = await getCanonicalCustomerResource('documents', undefined, documentCursor ? new URLSearchParams({ cursor: documentCursor }) : undefined)
  } catch (error) {
    if (error instanceof CustomerPortalAccessError) throw error
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-semibold">Mina dokument</h1>
        <p className="mt-2 text-sm text-white/60">
          Här visas avtal, fullmakter, villkor, ångerrättsinformation och andra dokument som är kopplade till din kundprofil.
        </p>
      </div>

      <PoaArchiveDocuments data={archive} documentCursor={documentCursor} />

      <CustomerDocumentPages key={documentCursor ?? 'first'} initialPage={resource && { data: resource.data as CustomerDocument[], page: resource.page }}
        initialCursor={documentCursor} poaCursor={typeof cursor === 'string' ? cursor : undefined} />
    </div>
  )
}
