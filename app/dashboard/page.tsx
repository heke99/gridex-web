import OverviewCards from '@/components/dashboard/OverviewCards'
import { getCustomerPortalOverview } from '@/lib/customerPortal/service'

export const dynamic = 'force-dynamic'

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(value))
}

export default async function DashboardPage() {
  const overview = await getCustomerPortalOverview()
  const latestContract = overview.contracts[0] ?? null
  const latestNotification = overview.notifications[0] ?? null

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-semibold">Översikt</h1>
        <p className="mt-2 text-sm text-white/60">
          Välkommen tillbaka {overview.profile?.full_name || overview.profile?.email || 'kund'}.
          Här ser du avtal, fakturor, support och integrationsstatus i samma vy.
        </p>
      </div>

      <OverviewCards overview={overview} />

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 lg:col-span-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Senaste avtalsstatus</h2>
              <p className="mt-1 text-sm text-white/60">
                Detta block är byggt för att kunna visa live-data från ditt valda CIS/avtalssystem när API-kopplingen aktiveras.
              </p>
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/60">
              API-ready
            </div>
          </div>

          {latestContract ? (
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">{latestContract.contract_name || latestContract.contract_slug || 'Avtal'}</div>
                  <div className="mt-1 text-xs text-white/55">
                    Status: {latestContract.status} • Signerat: {formatDate(latestContract.signed_at)}
                  </div>
                </div>
                <div className="text-xs text-white/50">
                  Extern referens: {latestContract.contract_external_ref || 'Ej synkad ännu'}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-sm text-white/60">
              Inget avtal är ännu synligt i portalen. När tecknat avtal har registrerats eller importerats kommer det visas här.
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold">Senaste notis</h2>
          {latestNotification ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-sm font-medium">{latestNotification.title}</div>
              <div className="mt-2 text-sm text-white/70">{latestNotification.body}</div>
              <div className="mt-3 text-[11px] text-white/45">{formatDate(latestNotification.created_at)}</div>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-white/60">
              Inga notiser ännu.
            </div>
          )}
        </section>
      </div>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold">Integrationsberedskap</h2>
        <p className="mt-2 text-sm text-white/60">
          Portalen är förberedd för API-koppling mot både fakturasystem och avtal/CIS. När du väljer leverantör fyller du bara på
          anslutningsuppgifter i <span className="text-white/80">external_system_connections</span> och köar sync-jobb i <span className="text-white/80">integration_sync_jobs</span>.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {overview.connections.map((connection) => (
            <div key={connection.id} className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-sm font-medium">{connection.connection_name}</div>
              <div className="mt-1 text-xs text-white/50">{connection.provider_key} • {connection.domain}</div>
              <div className="mt-3 text-xs text-white/70">Status: {connection.status}</div>
              <div className="mt-1 text-[11px] text-white/45">Senast OK: {formatDate(connection.last_success_at)}</div>
            </div>
          ))}
          {overview.connections.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-white/60">
              Inga provider-anslutningar är registrerade ännu.
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
