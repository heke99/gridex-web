import type { CustomerPortalOverview } from '@/lib/customerPortal/types'

function formatDate(value: string | null | undefined) {
  if (!value) return '—'

  return new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))
}

export default function OverviewCards({
  overview,
}: {
  overview: CustomerPortalOverview
}) {
  const latestInvoice = overview.invoices[0] ?? null
  const unreadNotifications = overview.notifications.filter(
    (notification) => !notification.is_read
  ).length

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <div className="rounded-3xl border border-white/10 bg-black/30 p-6">
        <div className="text-xs uppercase tracking-[0.18em] text-white/45">
          Avtal
        </div>
        <div className="mt-3 text-3xl font-semibold">
          {overview.contracts.length}
        </div>
        <div className="mt-2 text-xs text-white/60">
          Aktiva och tidigare avtal som visas på Mina sidor.
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-black/30 p-6">
        <div className="text-xs uppercase tracking-[0.18em] text-white/45">
          Fakturor
        </div>
        <div className="mt-3 text-3xl font-semibold">
          {overview.invoices.length}
        </div>
        <div className="mt-2 text-xs text-white/60">
          Senaste fakturadatum: {formatDate(latestInvoice?.issued_at ?? null)}
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-black/30 p-6">
        <div className="text-xs uppercase tracking-[0.18em] text-white/45">
          Dokument
        </div>
        <div className="mt-3 text-3xl font-semibold">{overview.documents.length}</div>
        <div className="mt-2 text-xs text-white/60">
          Avtal, villkor, fullmakter och andra underlag.
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-black/30 p-6">
        <div className="text-xs uppercase tracking-[0.18em] text-white/45">
          Nya meddelanden
        </div>
        <div className="mt-3 text-3xl font-semibold">{unreadNotifications}</div>
        <div className="mt-2 text-xs text-white/60">
          Olästa notiser och uppdateringar på Mina sidor.
        </div>
      </div>
    </div>
  )
}
