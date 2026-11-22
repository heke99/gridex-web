'use client'

import { useState, type MouseEvent } from 'react'
import type { PoaArchiveList } from '@/lib/ops/client/poaArchive'

type ArchivePage = Pick<PoaArchiveList, 'data' | 'page'>
const archiveEndpoint = '/api/web/customer/powers-of-attorney/evidence'

const unavailableMessage = 'Dokumentet kan inte hämtas just nu. Kontakta kundtjänst om du behöver hjälp.'
const archiveMessages: Record<ArchivePage['data'][number]['archive_status'], string> = {
  missing: 'Det finns ännu inget arkiverat fullmaktsdokument.',
  incomplete_evidence: 'Fullmaktsdokumentet saknar verifieringsuppgifter och kan inte hämtas. Kontakta kundtjänst om du behöver hjälp.',
  archived_unverified: unavailableMessage,
  unavailable: unavailableMessage,
}

export default function PoaArchivePages({ initialPage, documentCursor }: { initialPage: ArchivePage | null; documentCursor?: string }) {
  const [result, setResult] = useState(initialPage)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function showNextPage(event: MouseEvent<HTMLAnchorElement>, cursor: string) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    if (pending) return

    setPending(true)
    setError(null)
    try {
      const query = new URLSearchParams({ limit: '20', cursor })
      const response = await fetch(`${archiveEndpoint}?${query}`, { cache: 'no-store' })
      if (!response.ok) throw new Error('Archive request failed')
      const page = await response.json() as ArchivePage
      setResult(page)
    } catch {
      setError('Nästa sida kunde inte hämtas. Försök igen.')
    } finally {
      setPending(false)
    }
  }

  if (!result) {
    return (
      <section className="rounded-3xl border border-white/10 bg-black/30 p-6" aria-labelledby="poa-archive-heading">
        <h2 id="poa-archive-heading" className="text-lg font-semibold">Mina fullmakter</h2>
        <p className="mt-3 text-sm text-white/60">Fullmaktsdokumenten kan inte hämtas just nu. Försök igen senare eller kontakta kundtjänst.</p>
      </section>
    )
  }
  const nextCursor = result.page.has_more ? result.page.next_cursor : null
  return (
    <section className="space-y-4" aria-labelledby="poa-archive-heading" aria-busy={pending}>
      <h2 id="poa-archive-heading" className="text-lg font-semibold">Mina fullmakter</h2>
      {result.data.map(item => {
        const download = item.archive_status === 'archived_unverified' ? item.download_url : null
        return (
          <article key={item.power_of_attorney_reference} className="rounded-3xl border border-white/10 bg-black/30 p-6">
            <h3 className="font-medium">Fullmakt för anläggningsuppgifter</h3>
            {item.verification_reference ? (
              <p className="mt-2 break-all text-xs text-white/60">Verifikationsnummer: {item.verification_reference}</p>
            ) : null}
            {download ? (
              <>
                <p className="mt-2 text-sm text-white/60">PDF-filens kontrollsumma kontrolleras när du hämtar dokumentet.</p>
                <a href={download} className="mt-4 inline-flex rounded-xl border border-white/10 px-4 py-2 text-sm text-white/80 transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-4"
                  aria-label={`Ladda ned fullmakt ${item.verification_reference} som PDF`}>Ladda ned fullmakt (PDF)</a>
              </>
            ) : (
              <p className="mt-3 text-sm text-white/60">{archiveMessages[item.archive_status] ?? unavailableMessage}</p>
            )}
          </article>
        )
      })}
      {result.data.length === 0 ? <p className="text-sm text-white/60">Inga fullmaktsdokument finns att visa ännu.</p> : null}
      {error && <p role="alert" className="text-sm text-amber-200">{error}</p>}
      {nextCursor ? (
        <a href={`/dashboard/documents?${new URLSearchParams({ poa_cursor: nextCursor, ...(documentCursor ? { document_cursor: documentCursor } : {}) })}`}
          onClick={event => void showNextPage(event, nextCursor)}
          aria-disabled={pending}
          className="inline-flex rounded-xl border border-white/10 px-4 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-4">
          {pending ? 'Hämtar fullmakter…' : 'Visa fler fullmakter'}
        </a>
      ) : null}
    </section>
  )
}
