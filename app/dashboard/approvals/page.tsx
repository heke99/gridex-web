import { formatCustomerDate as formatDate } from '@/lib/customerPortal/display'
import { getCustomerPortalApprovals } from '@/lib/customerPortal/service'
import type { Metadata } from 'next'
import Link from 'next/link'
import EventLink from '@/components/customer/EventLink'
import type { CustomerDocument } from '@/lib/customerPortal/types'
import { powerOfAttorneyStatusLabel, statusLabel } from '@/lib/customerPortal/statusHelper'

// Private page: prevent indexing by search engines
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function DashboardApprovalsPage() {
  const approvals = await getCustomerPortalApprovals()
  const documentsByReference = new Map<string, CustomerDocument | null>()
  for (const document of approvals.documents) {
    const reference = document.document_reference
    documentsByReference.set(reference, documentsByReference.has(reference) ? null : document)
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-semibold">Godkännanden och fullmakt</h1>
        <p className="mt-2 text-sm text-white/60">
          Här ser du vilka villkor, vilken ångerrättsinformation, vilken integritetspolicy och vilken fullmakt som är kopplade till din kundprofil.
        </p>
      </div>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold">Mina godkännanden</h2>
        <div className="mt-4 space-y-3">
          {approvals.legalAcceptances.map(item => {
            const document = item.document_reference ? documentsByReference.get(item.document_reference) : null
            const matchesVersion = document && (!item.version || document.version === item.version)
            const href = matchesVersion ? document.download_url || document.file_url : null
            return (
              <div key={item.id} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{item.title || 'Godkännande'}</div>
                    <div className="mt-1 text-xs text-white/50">
                      Version {item.version || '—'} • {formatDate(item.accepted_at)} • {item.source || 'Mina sidor'}
                    </div>
                    {item.document_reference ? (
                      <div className="mt-1 break-all text-xs text-white/50">Dokumentreferens {item.document_reference}</div>
                    ) : null}
                  </div>
                  <span className="w-fit rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/70">
                    {statusLabel(item.status)}
                  </span>
                </div>
                {item.verified_document_url ? (
                  <a href={item.verified_document_url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-cyan-300 underline">
                    Öppna godkänt dokument
                  </a>
                ) : href && document ? (
                  <EventLink href={href} target="_blank" rel="noreferrer" eventType="customer.opened_document"
                    entityType="document" entityId={document.id} className="mt-3 inline-block text-sm text-cyan-300 underline">
                    Öppna godkänt dokument
                  </EventLink>
                ) : (
                  <p className="mt-3 text-sm text-white/60">
                    Den godkända versionen kan inte öppnas här. <Link href="/dashboard/support" className="text-cyan-300 underline">Begär en kopia från kundtjänst</Link>.
                  </p>
                )}
              </div>
            )
          })}
          {approvals.legalAcceptances.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-white/60">
              Inga godkännanden visas ännu.
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold">Fullmakt för anläggningsuppgifter</h2>
        <p className="mt-2 text-sm text-white/60">
          Fullmakten gör att Gridex kan begära och ta emot uppgifter från elnätsföretaget som behövs för att starta och administrera ditt elavtal.
        </p>
        <div className="mt-4 space-y-3">
          {approvals.powersOfAttorney.map((poa) => (
            <div key={poa.id} className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="font-medium">{poa.title || 'Fullmakt'}</div>
                  <div className="mt-1 text-xs text-white/50">
                    Godkänd {formatDate(poa.accepted_at)} • Version {poa.version || '—'}
                  </div>
                  {poa.valid_until ? (
                    <div className="mt-1 text-xs text-white/50">Giltig till {formatDate(poa.valid_until)}</div>
                  ) : null}
                  {poa.revoked_at ? (
                    <div className="mt-1 text-xs text-white/50">Återkallad {formatDate(poa.revoked_at)}</div>
                  ) : null}
                </div>
                <span className="w-fit rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/70">
                  {powerOfAttorneyStatusLabel(poa.status)}
                </span>
              </div>
            </div>
          ))}
          {approvals.powersOfAttorney.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-white/60">
              Fullmakt visas när den är kopplad till din kundprofil.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
}
