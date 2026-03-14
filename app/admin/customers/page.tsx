import Link from 'next/link'
import { requireAdminPageAccess } from '@/lib/admin/guards'
import { getCustomerAdminOverview } from '@/lib/admin/customerAdmin'

export const dynamic = 'force-dynamic'

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams?: { q?: string }
}) {
  await requireAdminPageAccess({
    anyOf: ['agreements.read', 'agreements.write', 'admin.access'],
  })

  const q = searchParams?.q?.trim() ?? ''
  const overview = await getCustomerAdminOverview(q)

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-gray-800 bg-gray-950 p-8">
        <h1 className="text-3xl font-bold">Kunder</h1>
        <p className="mt-3 text-gray-400">
          Sök kund på namn, e-post eller personnummer. Se avtal, signering,
          villkorsgodkännanden, dokument och aktivitet.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Kpi label="Totala kunder" value={overview.totalCustomers} />
        <Kpi label="Aktiva kunder" value={overview.activeCustomers} />
        <Kpi label="Signerade kunder" value={overview.signedCustomers} />
        <Kpi label="Kunder med dokument" value={overview.customersWithDocuments} />
      </div>

      <div className="rounded-3xl border border-gray-800 bg-gray-950 p-6">
        <form className="grid gap-4 md:grid-cols-[1fr_auto_auto]">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Sök namn, e-post eller personnummer"
            className="h-11 rounded-2xl border border-gray-800 bg-black/40 px-4 text-sm outline-none ring-0 placeholder:text-gray-500"
          />
          <button className="rounded-2xl border border-white/10 bg-white/10 px-4 text-sm font-medium hover:bg-white/15">
            Sök
          </button>
          <Link
            href="/admin/customers"
            className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-black/30 px-4 text-sm font-medium hover:bg-white/5"
          >
            Rensa
          </Link>
        </form>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {overview.cards.map((customer) => (
          <Link
            key={customer.userId}
            href={`/admin/customers/${customer.userId}`}
            className="rounded-3xl border border-gray-800 bg-gray-950 p-6 transition hover:border-cyan-500/30 hover:bg-gray-900"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-white">
                  {customer.fullName}
                </div>
                <div className="mt-1 text-sm text-gray-400">
                  {customer.email ?? 'Ingen e-post'}
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  Personnummer: {customer.personalNumber ?? '—'}
                </div>
              </div>

              <div className="text-right text-xs text-gray-500">
                <div>Logins: {customer.totalLogins}</div>
                <div>
                  Senast inloggad:{' '}
                  {customer.lastLoginAt
                    ? formatDate(customer.lastLoginAt)
                    : '—'}
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <Info label="Avtal" value={String(customer.agreementsCount)} />
              <Info label="Aktiva" value={String(customer.activeAgreementsCount)} />
              <Info label="Dokument" value={String(customer.documentsCount)} />
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <Info label="Senaste avtal" value={customer.latestContractSlug ?? '—'} />
              <Info label="Status" value={customer.latestAgreementStatus ?? '—'} />
              <Info
                label="Signerat"
                value={customer.latestSignedAt ? formatDate(customer.latestSignedAt) : '—'}
              />
              <Info
                label="Aktiverat"
                value={customer.latestActivatedAt ? formatDate(customer.latestActivatedAt) : '—'}
              />
            </div>

            <div className="mt-5 flex flex-wrap gap-2 text-xs">
              <Tag label={`Villkor: ${customer.latestAcceptedTermsAt ? formatDate(customer.latestAcceptedTermsAt) : '—'}`} />
              <Tag label={`Integritet: ${customer.latestAcceptedPrivacyAt ? formatDate(customer.latestAcceptedPrivacyAt) : '—'}`} />
              <Tag label={`Cookies: ${customer.latestAcceptedCookiesAt ? formatDate(customer.latestAcceptedCookiesAt) : '—'}`} />
            </div>
          </Link>
        ))}

        {overview.cards.length === 0 && (
          <div className="rounded-3xl border border-dashed border-gray-800 bg-gray-950 p-8 text-sm text-gray-500 xl:col-span-2">
            Inga kunder hittades för din sökning.
          </div>
        )}
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
      <div className="mt-1 text-sm text-white">{value}</div>
    </div>
  )
}

function Tag({ label }: { label: string }) {
  return <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-gray-300">{label}</span>
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('sv-SE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}