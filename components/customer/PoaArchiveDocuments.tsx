import { getCustomerPoaArchives } from '@/lib/customerPortal/poaArchive'
import { poaArchiveDownloadPath, type PoaArchiveList } from '@/lib/ops/client/poaArchive'
import { isOpsError } from '@/lib/ops/errors'

export async function loadPoaArchiveDocuments(cursor?: string | string[]): Promise<PoaArchiveList | null> {
  try {
    if (Array.isArray(cursor)) throw new Error('Repeated archive cursor')
    return await getCustomerPoaArchives({ limit: 20, ...(cursor ? { cursor } : {}) })
  } catch (error) {
    console.error('[customer portal] POA archive unavailable', isOpsError(error)
      ? { status: error.status, code: error.code, requestId: error.requestId } : { code: 'poa_archive_unavailable' })
    return null
  }
}

export default async function PoaArchiveDocuments({ data }: { data: Promise<PoaArchiveList | null> }) {
  const result = await data
  if (!result) {
    return (
      <section className="rounded-3xl border border-white/10 bg-black/30 p-6" aria-labelledby="poa-archive-heading">
        <h2 id="poa-archive-heading" className="text-lg font-semibold">Mina fullmakter</h2>
        <p className="mt-3 text-sm text-white/60">Fullmaktsdokumenten kan inte hämtas just nu. Försök igen senare eller kontakta kundtjänst.</p>
      </section>
    )
  }
  return (
    <section className="space-y-4" aria-labelledby="poa-archive-heading">
      <h2 id="poa-archive-heading" className="text-lg font-semibold">Mina fullmakter</h2>
      {result.data.map(item => {
        const download = poaArchiveDownloadPath(item)
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
              <p className="mt-3 text-sm text-white/60">{item.archive_status === 'unavailable'
                ? 'Dokumentet kan inte hämtas just nu. Kontakta kundtjänst om du behöver hjälp.' : 'Fullmaktsdokumentet förbereds.'}</p>
            )}
          </article>
        )
      })}
      {result.data.length === 0 ? <p className="text-sm text-white/60">Inga fullmaktsdokument finns att visa ännu.</p> : null}
      {result.page.has_more && result.page.next_cursor ? (
        <a href={`/dashboard/documents?poa_cursor=${encodeURIComponent(result.page.next_cursor)}`}
          className="inline-flex rounded-xl border border-white/10 px-4 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-4">Visa fler fullmakter</a>
      ) : null}
    </section>
  )
}
