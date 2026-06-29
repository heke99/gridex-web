import EventLink from '@/components/customer/EventLink'
import { getCustomerPortalOverview } from '@/lib/customerPortal/service'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

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

function invoiceTitle(invoiceNumber: string | null, externalRef: string | null) {
  return invoiceNumber || externalRef || 'Faktura'
}

function invoiceStatus(status: string) {
  switch (status) {
    case 'paid':
      return 'Betald'
    case 'overdue':
      return 'Förfallen'
    case 'sent':
    case 'issued':
      return 'Skickad'
    case 'draft':
      return 'Förbereds'
    default:
      return 'Status uppdateras'
  }
}

export default async function DashboardInvoicesPage() {
  const overview = await getCustomerPortalOverview()
  const invoices = overview.invoices

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6">
        <h1 className="text-2xl font-semibold">Fakturor</h1>
        <p className="mt-2 text-sm text-white/60">
          Här ser du fakturor, belopp, förfallodatum och tillgängliga underlag.
        </p>
      </div>

      {!overview.opsAvailable ? (
        <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm text-amber-50/90">
          Vi visar senast lokalt sparade uppgifter. Uppgifter från Gridex kan vara äldre tills anslutningen är återställd.
        </div>
      ) : null}

      {invoices.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/10 bg-black/20 p-5 text-sm text-white/60 sm:p-6">
          Inga fakturor finns tillgängliga ännu.
        </div>
      ) : (
        <div className="space-y-4">
          {invoices.map((invoice) => (
            <article key={invoice.id} className="rounded-3xl border border-white/10 bg-black/30 p-5 sm:p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">
                    {invoiceTitle(invoice.invoice_number, invoice.external_invoice_ref)}
                  </h2>
                  <p className="mt-1 text-sm text-white/60">
                    Period: {formatDate(invoice.invoice_period_start)} – {formatDate(invoice.invoice_period_end)}
                  </p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/70">
                  {invoiceStatus(invoice.status)}
                </span>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-4">
                <Info label="Belopp" value={formatCurrency(Number(invoice.total_amount || 0), invoice.currency_code)} />
                <Info label="Moms" value={formatCurrency(Number(invoice.vat_amount || 0), invoice.currency_code)} />
                <Info label="Förfallodatum" value={formatDate(invoice.due_at)} />
                <Info label="OCR/referens" value={invoice.ocr_number || invoice.payment_reference || '—'} />
              </div>

              {invoice.pdf_url ? (
                <EventLink
                  href={invoice.pdf_url}
                  target="_blank"
                  rel="noreferrer"
                  eventType="customer.opened_invoice"
                  entityType="invoice"
                  entityId={invoice.id}
                  className="mt-5 inline-flex rounded-xl border border-white/10 px-4 py-2 text-sm text-white/80 transition hover:bg-white/5"
                >
                  Öppna faktura
                </EventLink>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
      <div className="text-white/45">{label}</div>
      <div className="mt-2 break-words">{value}</div>
    </div>
  )
}
