import type { CustomerPortalOverview } from '@/lib/customerPortal/types'

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))
}

export default function OverviewCards({ overview }: { overview: CustomerPortalOverview }) {
  const openTickets = overview.tickets.filter(
    (ticket) => ticket.status !== 'resolved' && ticket.status !== 'closed'
  ).length
  const latestInvoice = overview.invoices[0] ?? null
  const activeConnections = overview.connections.filter((c) => c.status === 'active').length

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <div className="rounded-3xl border border-white/10 bg-black/30 p-6">
        <div className="text-xs uppercase tracking-[0.18em] text-white/45">Avtal</div>
        <div className="mt-3 text-3xl font-semibold">{overview.contracts.length}</div>
        <div className="mt-2 text-xs text-white/60">Totalt registrerade avtal i portalen.</div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-black/30 p-6">
        <div className="text-xs uppercase tracking-[0.18em] text-white/45">Fakturor</div>
        <div className="mt-3 text-3xl font-semibold">{overview.invoices.length}</div>
        <div className="mt-2 text-xs text-white/60">
          Senast skapad: {formatDate(latestInvoice?.issued_at ?? null)}
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-black/30 p-6">
        <div className="text-xs uppercase tracking-[0.18em] text-white/45">Öppna ärenden</div>
        <div className="mt-3 text-3xl font-semibold">{openTickets}</div>
        <div className="mt-2 text-xs text-white/60">Supportärenden som fortfarande är aktiva.</div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-black/30 p-6">
        <div className="text-xs uppercase tracking-[0.18em] text-white/45">API-status</div>
        <div className="mt-3 text-3xl font-semibold">{activeConnections}</div>
        <div className="mt-2 text-xs text-white/60">Aktiva externa kopplingar för faktura/CIS.</div>
      </div>
    </div>
  )
}
