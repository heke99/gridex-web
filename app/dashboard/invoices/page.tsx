import { getCustomerInvoices, getPortalSession } from '@/lib/customerPortal/service'

export const dynamic = 'force-dynamic'

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))
}

function formatCurrency(value: number, currencyCode: string) {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: currencyCode || 'SEK',
  }).format(value)
}

export default async function DashboardInvoicesPage() {
  const { supabase, user } = await getPortalSession()
  const invoices = await getCustomerInvoices(supabase, user.id)

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-semibold">Fakturor</h1>
        <p className="mt-2 text-sm text-white/60">
          Fakturor hämtas från tabellen <span className="text-white/80">customer_invoices</span>. När du kopplar ett externt fakturasystem är det denna modell som fylls via sync-jobb.
        </p>
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/30">
        <div className="grid grid-cols-[1.1fr_.8fr_.8fr_.8fr_.9fr] gap-4 border-b border-white/10 px-5 py-4 text-xs uppercase tracking-[0.18em] text-white/45">
          <div>Faktura</div>
          <div>Status</div>
          <div>Belopp</div>
          <div>Förfallo</div>
          <div>PDF</div>
        </div>

        {invoices.map((invoice) => (
          <div key={invoice.id} className="grid grid-cols-[1.1fr_.8fr_.8fr_.8fr_.9fr] gap-4 border-b border-white/5 px-5 py-4 text-sm text-white/85">
            <div>
              <div className="font-medium">{invoice.invoice_number || invoice.external_invoice_ref || 'Faktura'}</div>
              <div className="mt-1 text-xs text-white/50">
                Period: {formatDate(invoice.invoice_period_start)} – {formatDate(invoice.invoice_period_end)}
              </div>
            </div>
            <div>{invoice.status}</div>
            <div>{formatCurrency(Number(invoice.total_amount || 0), invoice.currency_code)}</div>
            <div>{formatDate(invoice.due_at)}</div>
            <div>
              {invoice.pdf_url ? (
                <a href={invoice.pdf_url} target="_blank" className="underline decoration-white/20 underline-offset-4 hover:text-white" rel="noreferrer">
                  Öppna PDF
                </a>
              ) : (
                <span className="text-white/40">Saknas</span>
              )}
            </div>
          </div>
        ))}

        {invoices.length === 0 && (
          <div className="px-5 py-6 text-sm text-white/60">Inga fakturor har synkats in ännu.</div>
        )}
      </div>
    </div>
  )
}
