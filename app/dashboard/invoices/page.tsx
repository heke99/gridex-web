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

function getInvoiceTitle(invoiceNumber: string | null, externalRef: string | null) {
  return invoiceNumber || externalRef || 'Faktura'
}

export default async function DashboardInvoicesPage() {
  const { supabase, user } = await getPortalSession()
  const invoices = await getCustomerInvoices(supabase, user.id)

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6">
        <h1 className="text-2xl font-semibold">Fakturor</h1>
        <p className="mt-2 text-sm text-white/60">
          Här ser du dina fakturor, belopp, förfallodatum och tillgängliga underlag.
        </p>
      </div>

      {invoices.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/10 bg-black/20 p-5 text-sm text-white/60 sm:p-6">
          Inga fakturor finns tillgängliga ännu.
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-3xl border border-white/10 bg-black/30 md:block">
            <div className="grid grid-cols-[1.1fr_.8fr_.8fr_.8fr_.9fr] gap-4 border-b border-white/10 px-5 py-4 text-xs uppercase tracking-[0.18em] text-white/45">
              <div>Faktura</div>
              <div>Status</div>
              <div>Belopp</div>
              <div>Förfallodatum</div>
              <div>Underlag</div>
            </div>

            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="grid grid-cols-[1.1fr_.8fr_.8fr_.8fr_.9fr] gap-4 border-b border-white/5 px-5 py-4 text-sm text-white/85"
              >
                <div>
                  <div className="font-medium">
                    {getInvoiceTitle(invoice.invoice_number, invoice.external_invoice_ref)}
                  </div>
                  <div className="mt-1 text-xs text-white/50">
                    Period: {formatDate(invoice.invoice_period_start)} –{' '}
                    {formatDate(invoice.invoice_period_end)}
                  </div>
                </div>

                <div>{invoice.status}</div>
                <div>{formatCurrency(Number(invoice.total_amount || 0), invoice.currency_code)}</div>
                <div>{formatDate(invoice.due_at)}</div>

                <div>
                  {invoice.pdf_url ? (
                    <a
                      href={invoice.pdf_url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline decoration-white/20 underline-offset-4 hover:text-white"
                    >
                      Öppna PDF
                    </a>
                  ) : (
                    <span className="text-white/40">Inte tillgänglig</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-4 md:hidden">
            {invoices.map((invoice) => (
              <article
                key={invoice.id}
                className="rounded-3xl border border-white/10 bg-black/30 p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold">
                      {getInvoiceTitle(invoice.invoice_number, invoice.external_invoice_ref)}
                    </h2>
                    <div className="mt-1 text-xs text-white/50">
                      Period: {formatDate(invoice.invoice_period_start)} –{' '}
                      {formatDate(invoice.invoice_period_end)}
                    </div>
                  </div>

                  <div className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/70">
                    {invoice.status}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs text-white/45">Belopp</div>
                    <div className="mt-1 text-sm font-medium text-white/90">
                      {formatCurrency(Number(invoice.total_amount || 0), invoice.currency_code)}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs text-white/45">Förfallodatum</div>
                    <div className="mt-1 text-sm font-medium text-white/90">
                      {formatDate(invoice.due_at)}
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  {invoice.pdf_url ? (
                    <a
                      href={invoice.pdf_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-white/85 transition hover:bg-white/10"
                    >
                      Öppna underlag
                    </a>
                  ) : (
                    <div className="text-sm text-white/45">Underlag är inte tillgängligt.</div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  )
}