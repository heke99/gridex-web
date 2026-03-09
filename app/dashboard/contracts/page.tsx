import { getCustomerContracts, getPortalSession } from '@/lib/customerPortal/service'

export const dynamic = 'force-dynamic'

function formatDate(value: string | null | undefined) {
  if (!value) return '—'

  return new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))
}

export default async function DashboardContractsPage() {
  const { supabase, user } = await getPortalSession()
  const contracts = await getCustomerContracts(supabase, user.id)

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-semibold">Mina avtal</h1>
        <p className="mt-2 text-sm text-white/60">
          Här visas dina avtal och deras aktuella status i portalen.
        </p>
      </div>

      <div className="space-y-4">
        {contracts.map((contract) => (
          <article
            key={contract.id}
            className="rounded-3xl border border-white/10 bg-black/30 p-6"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  {contract.contract_name || contract.contract_slug || 'Avtal'}
                </h2>
                <p className="mt-1 text-sm text-white/60">
                  Status: <span className="text-white/80">{contract.status}</span>
                </p>
              </div>

              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/60">
                Referens: {contract.agreement_id || '—'}
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
                <div className="text-white/45">Signerat</div>
                <div className="mt-2">{formatDate(contract.signed_at)}</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
                <div className="text-white/45">Startdatum</div>
                <div className="mt-2">{formatDate(contract.starts_at)}</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
                <div className="text-white/45">Fakturasystem</div>
                <div className="mt-2">
                  {contract.billing_provider_key || 'Inte tillgängligt ännu'}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
                <div className="text-white/45">Avtalssystem</div>
                <div className="mt-2">
                  {contract.contract_provider_key || 'Inte tillgängligt ännu'}
                </div>
              </div>
            </div>
          </article>
        ))}

        {contracts.length === 0 && (
          <div className="rounded-3xl border border-dashed border-white/10 bg-black/20 p-6 text-sm text-white/60">
            Du har ännu inga avtal i portalen.
          </div>
        )}
      </div>
    </div>
  )
}