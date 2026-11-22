"use client"

import { useState, type MouseEvent } from 'react'
import { formatCustomerDate as formatDate } from '@/lib/customerPortal/display'
import EventLink from '@/components/customer/EventLink'
import type { CustomerDocument } from '@/lib/customerPortal/types'

type DocumentPage = { data: CustomerDocument[]; page?: { hasMore: boolean; nextCursor: string | null } }

function pagePath(poaCursor?: string, cursor?: string) {
  const params = new URLSearchParams()
  if (poaCursor) params.set('poa_cursor', poaCursor)
  if (cursor) params.set('document_cursor', cursor)
  return params.size ? `/dashboard/documents?${params}` : '/dashboard/documents'
}

function statusLabel(status: string | null | undefined) {
  switch (status) {
    case 'available':
    case 'published':
      return 'Publicerat'
    case 'sent':
      return 'Skickat'
    case 'draft':
      return 'Förbereds'
    default:
      return 'Status uppdateras'
  }
}

export default function CustomerDocumentPages({ initialPage, initialCursor, poaCursor }: {
  initialPage: DocumentPage | null
  initialCursor?: string
  poaCursor?: string
}) {
  const [result, setResult] = useState(initialPage)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const documents = result?.data ?? []
  const nextCursor = result?.page?.hasMore ? result.page.nextCursor : null

  async function loadPage(event: MouseEvent<HTMLAnchorElement>, cursor?: string) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    if (pending) return
    setPending(true)
    setError(null)
    try {
      const query = cursor ? `?${new URLSearchParams({ cursor })}` : ''
      const response = await fetch(`/api/web/customer/documents${query}`, { cache: 'no-store' })
      if (!response.ok) throw new Error('Document request failed')
      const page = await response.json() as DocumentPage
      if (!Array.isArray(page.data)) throw new Error('Invalid document page')
      setResult(page)
    } catch {
      setError('Dokumentsidan kunde inte hämtas. Försök igen.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-4" aria-busy={pending}>
      {documents.map((doc) => (
        <article key={doc.id} className="rounded-3xl border border-white/10 bg-black/30 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">{doc.title || doc.document_type || 'Dokument'}</h2>
              <p className="mt-1 text-sm text-white/60">
                Version {doc.version || '—'} • {formatDate(doc.created_at)}
              </p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/70">
              {statusLabel(doc.status)}
            </span>
          </div>

          {(doc.download_url || doc.file_url) ? (
            <EventLink
              href={doc.download_url || doc.file_url || '#'}
              target="_blank"
              rel="noreferrer"
              eventType="customer.opened_document"
              entityType="document"
              entityId={doc.id}
              className="mt-5 inline-flex rounded-xl border border-white/10 px-4 py-2 text-sm text-white/80 transition hover:bg-white/5"
            >
              Öppna dokument
            </EventLink>
          ) : doc.status === 'available' || doc.status === 'published' ? (
            <p className="mt-4 text-sm text-white/60">Dokumentet är publicerat men går inte att öppna här. Kontakta kundtjänst om du behöver en kopia.</p>
          ) : null}
        </article>
      ))}

      {result === null ? (
        <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-6 text-sm text-amber-50/90" role="status">
          <p>Dokumenten kunde inte hämtas just nu.</p>
          <a href={pagePath(poaCursor, initialCursor)} onClick={event => void loadPage(event, initialCursor)} className="mt-2 inline-block underline">Försök hämta dokumenten igen</a>
        </div>
      ) : documents.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/10 bg-black/20 p-6 text-sm text-white/60">
          Inga dokument finns att visa ännu.
        </div>
      ) : null}
      {error && <p role="alert" className="text-sm text-amber-200">{error}</p>}
      {nextCursor && (
        <a href={pagePath(poaCursor, nextCursor)} onClick={event => void loadPage(event, nextCursor)}
          aria-disabled={pending} className="inline-flex rounded-xl border border-white/10 px-4 py-2 text-sm">
          {pending ? 'Hämtar dokument…' : 'Visa fler dokument'}
        </a>
      )}
    </div>
  )
}
