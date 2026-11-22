import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPortalInvoiceDetail } from '@/lib/customerPortal/service'
import { customerInvoiceStatusLabel, formatCustomerCurrency, formatCustomerDate } from '@/lib/customerPortal/display'
import { isOpsError } from '@/lib/ops/errors'

export const dynamic = 'force-dynamic'

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[A-Za-z0-9_-]{1,240}$/.test(id)) notFound()

  const invoice = await getPortalInvoiceDetail(id).catch(error => {
    if (isOpsError(error) && [403, 404].includes(error.status)) notFound()
    throw error
  })
  const paidDate = formatCustomerDate(invoice.paidAt)
  const documents = invoice.documents.filter(document => document.available)

  return (
    <article className="space-y-5 rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6">
      <Link href="/dashboard/invoices" className="text-cyan-300 underline">Alla fakturor</Link>
      <h1 className="text-2xl font-semibold">Faktura {invoice.number ?? invoice.reference}</h1>
      <dl className="grid gap-3 sm:grid-cols-3">
        <div><dt>Status</dt><dd>{customerInvoiceStatusLabel(invoice.status)}</dd></div>
        <div><dt>Belopp inklusive moms</dt><dd>{formatCustomerCurrency(invoice.amount, invoice.currency ?? 'SEK')}</dd></div>
        <div><dt>Förfallodatum</dt><dd>{formatCustomerDate(invoice.dueDate)}</dd></div>
        {paidDate !== '—' ? <div><dt>Betalningsdatum</dt><dd>{paidDate}</dd></div> : null}
      </dl>
      <section>
        <h2 className="text-lg font-semibold">Fakturarader</h2>
        {invoice.lines.length ? <ul className="mt-2 space-y-2">
          {invoice.lines.map(line => <li key={line.reference}>{line.description ?? 'Fakturarad'} · {formatCustomerCurrency(line.amountIncVat, invoice.currency ?? 'SEK')}</li>)}
        </ul> : <p>Inga fakturarader finns att visa.</p>}
      </section>
      <section>
        <h2 className="text-lg font-semibold">Fakturadokument</h2>
        {documents.length ? <ul className="mt-2 space-y-2">
          {documents.map(document => <li key={document.reference}>
            <a className="text-cyan-300 underline" target="_blank" rel="noreferrer"
              href={`/api/web/customer/invoices/${encodeURIComponent(invoice.reference)}/documents/${encodeURIComponent(document.reference)}`}>
              Öppna {document.title ?? 'fakturadokument'}
            </a>
          </li>)}
        </ul> : <p>Inga dokument är tillgängliga.</p>}
      </section>
    </article>
  )
}
