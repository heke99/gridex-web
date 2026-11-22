import { readInvoiceCursor } from '@/lib/customerPortal/invoicePagination'
import { notFound } from 'next/navigation'
import { customerInvoiceStatusLabel, formatCustomerCurrency as formatCurrency } from '@/lib/customerPortal/display'
import { formatCustomerDate as formatDate } from '@/lib/customerPortal/display'
import Link from 'next/link'
import { getCanonicalCustomerResource } from '@/lib/customerPortal/service'
import type { CustomerInvoice } from '@/lib/customerPortal/types'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}





function invoiceTitle(invoiceNumber: string | null, externalRef: string | null) {
  return invoiceNumber || externalRef || 'Faktura'
}

export default async function DashboardInvoicesPage({ searchParams }: { searchParams: Promise<{ cursor?: string | string[] }> }) {
  const { cursor: rawCursor } = await searchParams
  let cursor: string | null
  try {
    cursor = readInvoiceCursor(typeof rawCursor === 'string' ? [rawCursor] : rawCursor ?? [])
  } catch {
    notFound()
  }
  const resource = await getCanonicalCustomerResource('invoices', undefined, cursor)
  const invoices = resource.data as CustomerInvoice[]

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6">
        <h1 className="text-2xl font-semibold">Fakturor</h1>
        <p className="mt-2 text-sm text-white/60">
          Här ser du fakturor, belopp, förfallodatum och tillgängliga underlag.
        </p>
      </div>

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
                  {customerInvoiceStatusLabel(invoice.status)}
                </span>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-4">
                <Info label="Belopp" value={formatCurrency(invoice.total_amount, invoice.currency_code)} />
                <Info label="Moms" value={formatCurrency(invoice.vat_amount, invoice.currency_code)} />
                <Info label="Förfallodatum" value={formatDate(invoice.due_at)} />
                {invoice.paid_at && formatDate(invoice.paid_at) !== '—' ? <Info label="Betalningsdatum" value={formatDate(invoice.paid_at)} /> : null}
                <Info label="OCR/referens" value={invoice.ocr_number || invoice.payment_reference || '—'} />
              </div>

              <Link
                href={`/dashboard/invoices/${encodeURIComponent(invoice.invoice_reference ?? invoice.id)}`}
                prefetch={false}
                className="mt-5 inline-flex rounded-xl border border-white/10 px-4 py-2 text-sm text-white/80 transition hover:bg-white/5"
              >
                Visa fakturadetaljer
              </Link>
            </article>
          ))}
        </div>
      )}
      {(cursor || resource.page?.nextCursor) ? (
        <nav aria-label="Fakturasidor" className="flex gap-5">
          {cursor ? <Link prefetch={false} href="/dashboard/invoices" className="text-cyan-300 underline">Första fakturasidan</Link> : null}
          {resource.page?.nextCursor ? <Link prefetch={false} href={`/dashboard/invoices?${new URLSearchParams({ cursor: resource.page.nextCursor })}`} className="text-cyan-300 underline">Visa fler fakturor</Link> : null}
        </nav>
      ) : null}
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
