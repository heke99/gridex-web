import EventLink from '@/components/customer/EventLink'
import { getCustomerPortalOverview } from '@/lib/customerPortal/service'
import type { Metadata } from 'next'

// Private page: ensure search engines do not index this page
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))
}

function statusLabel(status: string | null | undefined) {
  switch (status) {
    case 'available':
    case 'published':
      return 'Tillgängligt'
    case 'sent':
      return 'Skickat'
    case 'draft':
      return 'Förbereds'
    default:
      return 'Status uppdateras'
  }
}

export default async function DashboardDocumentsPage() {
  const overview = await getCustomerPortalOverview()

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-semibold">Mina dokument</h1>
        <p className="mt-2 text-sm text-white/60">
          Här visas avtal, fullmakter, villkor, ångerrättsinformation och andra dokument som är kopplade till din kundprofil.
        </p>
      </div>

      {!overview.opsAvailable ? (
        <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm text-amber-50/90">
          Vi kunde inte hämta dokument just nu. Försök igen om en stund.
        </div>
      ) : null}

      <div className="space-y-4">
        {overview.documents.map((doc) => (
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
            ) : null}
          </article>
        ))}

        {overview.documents.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/10 bg-black/20 p-6 text-sm text-white/60">
            Inga dokument finns att visa ännu.
          </div>
        ) : null}
      </div>
    </div>
  )
}
