import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdminPageAccess } from '@/lib/admin/guards'
import { getCustomerAdminDetail } from '@/lib/admin/customerAdmin'

export const dynamic = 'force-dynamic'

function acceptanceTypeLabel(item: {
  type?: string | null
  acceptance_type?: string | null
  kind?: string | null
  category?: string | null
}) {
  return (
    item.type ??
    item.acceptance_type ??
    item.kind ??
    item.category ??
    'acceptance'
  )
}

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  await requireAdminPageAccess({
    anyOf: ['agreements.read', 'agreements.write', 'admin.access'],
  })

  const detail = await getCustomerAdminDetail(id)

  if (!detail.card) {
    notFound()
  }

  const customer = detail.card

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-gray-800 bg-gray-950 p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-gray-500">
              Kundkort
            </div>
            <h1 className="mt-2 text-3xl font-bold text-white">
              {customer.fullName}
            </h1>
            <p className="mt-3 text-gray-400">
              {customer.email ?? 'Ingen e-post'} • Personnummer:{' '}
              {customer.personalNumber ?? '—'}
            </p>
          </div>

          <Link
            href="/admin/customers"
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-medium hover:bg-white/10"
          >
            Tillbaka till kunder
          </Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Kpi label="Totala avtal" value={customer.agreementsCount} />
        <Kpi label="Aktiva avtal" value={customer.activeAgreementsCount} />
        <Kpi label="Dokument" value={customer.documentsCount} />
        <Kpi label="Logins" value={customer.totalLogins} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-gray-800 bg-gray-950 p-6">
          <h2 className="text-xl font-semibold text-white">Kundinformation</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Info label="Namn" value={customer.fullName} />
            <Info label="E-post" value={customer.email ?? '—'} />
            <Info label="Telefon" value={customer.phone ?? '—'} />
            <Info label="Personnummer" value={customer.personalNumber ?? '—'} />
            <Info label="Onboarding" value={customer.onboardingState ?? '—'} />
            <Info label="Skapad" value={customer.createdAt ? formatDate(customer.createdAt) : '—'} />
            <Info label="Senaste login" value={customer.lastLoginAt ? formatDate(customer.lastLoginAt) : '—'} />
            <Info label="Totala logins" value={String(customer.totalLogins)} />
          </div>
        </section>

        <section className="rounded-3xl border border-gray-800 bg-gray-950 p-6">
          <h2 className="text-xl font-semibold text-white">Senaste accept</h2>
          <div className="mt-5 space-y-3">
            <Info label="Villkor" value={customer.latestAcceptedTermsAt ? formatDate(customer.latestAcceptedTermsAt) : '—'} />
            <Info label="Integritet" value={customer.latestAcceptedPrivacyAt ? formatDate(customer.latestAcceptedPrivacyAt) : '—'} />
            <Info label="Cookies" value={customer.latestAcceptedCookiesAt ? formatDate(customer.latestAcceptedCookiesAt) : '—'} />
            <Info label="Senaste signering" value={customer.latestSignedAt ? formatDate(customer.latestSignedAt) : '—'} />
            <Info label="Senaste aktivering" value={customer.latestActivatedAt ? formatDate(customer.latestActivatedAt) : '—'} />
          </div>
        </section>
      </div>

      <section className="rounded-3xl border border-gray-800 bg-gray-950 p-6">
        <h2 className="text-xl font-semibold text-white">Avtal</h2>
        <div className="mt-5 space-y-4">
          {detail.agreements.map((agreement) => (
            <div key={agreement.id} className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-lg font-semibold text-white">
                    {agreement.contract_slug ?? 'Avtal utan slug'}
                  </div>
                  <div className="mt-1 text-sm text-gray-400">
                    Avtal-ID: {agreement.id}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge label={agreement.status ?? '—'} />
                  <Badge label={agreement.sign_method ?? '—'} />
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-5">
                <Info label="Skapat" value={formatDate(agreement.created_at)} />
                <Info label="E-postsignerat" value={agreement.email_signed_at ? formatDate(agreement.email_signed_at) : '—'} />
                <Info label="BankID-signerat" value={agreement.bankid_completed_at ? formatDate(agreement.bankid_completed_at) : '—'} />
                <Info label="Aktiverat" value={agreement.activated_at ? formatDate(agreement.activated_at) : '—'} />
                <Info label="PDF" value={agreement.contract_pdf_path ?? '—'} />
              </div>

              <div className="mt-5">
                <div className="mb-2 text-sm font-medium text-white">Godkända villkor</div>
                <div className="space-y-2">
                  {(detail.acceptancesByAgreementId[agreement.id] ?? []).map((item) => (
                    <div key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-gray-300">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <span className="font-medium text-white">
                            {acceptanceTypeLabel(item)}
                          </span>
                          <span className="ml-2 text-gray-500">
                            version {item.version ?? '—'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400">{formatDate(item.accepted_at)}</div>
                      </div>
                      <div className="mt-2 text-xs text-gray-500 break-all">
                        IP: {item.ip_address ?? '—'}
                      </div>
                    </div>
                  ))}

                  {(detail.acceptancesByAgreementId[agreement.id] ?? []).length === 0 && (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 p-3 text-sm text-gray-500">
                      Inga legal acceptances loggade på detta avtal.
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 flex justify-end">
                <Link
                  href={`/admin/agreements/${agreement.id}`}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 text-sm hover:bg-white/10"
                >
                  Öppna avtal
                </Link>
              </div>
            </div>
          ))}

          {detail.agreements.length === 0 && (
            <div className="rounded-2xl border border-dashed border-gray-800 bg-black/20 p-5 text-sm text-gray-500">
              Kunden har ännu inga avtal sparade.
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-3xl border border-gray-800 bg-gray-950 p-6">
          <h2 className="text-xl font-semibold text-white">Sparade dokument</h2>
          <div className="mt-5 space-y-3">
            {detail.documents.map((document) => (
              <div key={document.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-medium text-white">{document.title ?? document.file_name ?? document.document_type}</div>
                    <div className="mt-1 text-xs text-gray-500">
                      {document.document_type} • {formatDate(document.created_at)}
                    </div>
                  </div>
                  <div className="text-right text-xs text-gray-500 break-all">
                    {document.storage_path ?? 'Ingen path'}
                  </div>
                </div>
              </div>
            ))}

            {detail.documents.length === 0 && (
              <div className="rounded-2xl border border-dashed border-gray-800 bg-black/20 p-4 text-sm text-gray-500">
                Inga dokument hittades för kunden.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-gray-800 bg-gray-950 p-6">
          <h2 className="text-xl font-semibold text-white">Aktivitet</h2>
          <div className="mt-5 space-y-3">
            {detail.activity.map((event) => (
              <div key={event.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-medium text-white">{event.summary ?? event.event_type}</div>
                    <div className="mt-1 text-xs text-gray-500">{event.event_type}</div>
                  </div>
                  <div className="text-xs text-gray-400">{formatDate(event.event_at)}</div>
                </div>
              </div>
            ))}

            {detail.activity.length === 0 && (
              <div className="rounded-2xl border border-dashed border-gray-800 bg-black/20 p-4 text-sm text-gray-500">
                Ingen extra aktivitet loggad ännu.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-gray-800 bg-gray-950 p-6">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-2 text-2xl font-bold text-white">{value}</div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-sm text-white break-words">{value}</div>
    </div>
  )
}

function Badge({ label }: { label: string }) {
  return <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200">{label}</span>
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('sv-SE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}