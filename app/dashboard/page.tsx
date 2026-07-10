import Link from 'next/link'
import OverviewCards from '@/components/dashboard/OverviewCards'
import { getCustomerPortalOverview } from '@/lib/customerPortal/service'
import type { Metadata } from 'next'

// Private dashboard pages should not be indexed by search engines
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}
// Import centralized status helper to translate backend statuses
import { statusLabel as friendlyStatusLabel } from '@/lib/customerPortal/statusHelper'

export const dynamic = 'force-dynamic'

function formatDate(value: string | null | undefined) {
  if (!value) return '—'

  return new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(value))
}

function customerStatusText(status: string | null | undefined) {
  // Delegate to the central status helper for customer-friendly text
  return friendlyStatusLabel(status ?? undefined)
}

function getDisplayName(
  profile: {
    company_name?: string | null
    first_name?: string | null
    full_name?: string | null
    last_name?: string | null
  } | null
) {
  if (!profile) return 'kund'
  const personalName = [profile.first_name, profile.last_name].filter(Boolean).join(' ')
  return profile.company_name || profile.full_name || personalName || 'kund'
}

function getCustomerLabel(
  profile:
    | {
        customer_type?: string | null
        company_name?: string | null
        customer_number?: string | null
      }
    | null
    | undefined
) {
  if (!profile) return null
  if (profile.customer_type === 'company' || profile.company_name) return 'Företag'
  return profile.customer_number ? `Kundnummer ${profile.customer_number}` : null
}

export default async function DashboardPage() {
  const overview = await getCustomerPortalOverview()
  const latestContract = overview.contracts[0] ?? null
  const latestNotification = overview.notifications[0] ?? null
  const latestSite = overview.sites[0] ?? null
  const displayName = getDisplayName(overview.profile)
  const customerLabel = getCustomerLabel(overview.profile)

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Översikt</h1>
            <p className="mt-2 text-sm text-white/60">
              Välkommen tillbaka {displayName}. Här ser du dina avtal, fakturor,
              anläggningar, meddelanden och dokument.
            </p>
          </div>

          {customerLabel ? (
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/70">
              {customerLabel}
            </div>
          ) : null}
        </div>
      </div>

      {!overview.opsAvailable ? (
        <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm text-amber-50/90">
          Vi visar senast lokalt sparade uppgifter. Uppgifter från Gridex kan vara äldre tills anslutningen är återställd.
          Vissa uppgifter kan visas igen när anslutningen är tillbaka.
        </div>
      ) : null}


      {overview.customerStatus ? (
        <div className={`rounded-3xl border p-5 ${overview.customerStatus.can_start_switch === false ? 'border-amber-500/30 bg-amber-500/10 text-amber-50/90' : 'border-cyan-500/20 bg-cyan-500/10 text-cyan-50/90'}`}>
          <div className="font-semibold text-white">
            {overview.customerStatus.label || customerStatusText(overview.customerStatus.code)}
          </div>
          {overview.customerStatus.message ? (
            <p className="mt-2 text-sm leading-6">{overview.customerStatus.message}</p>
          ) : null}
          {overview.dataQuality?.issues.length ? (
            <p className="mt-2 text-xs text-white/70">
              Uppgifter som kontrolleras: {overview.dataQuality.issues.map(customerStatusText).join(', ')}
            </p>
          ) : null}
        </div>
      ) : null}

      <OverviewCards overview={overview} />

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 lg:col-span-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Senaste avtalsstatus</h2>
              <p className="mt-1 text-sm text-white/60">
                Här visas den senaste informationen om ditt elavtal.
              </p>
            </div>
            <Link href="/dashboard/contracts" className="text-sm text-cyan-300 hover:text-cyan-200">
              Visa avtal
            </Link>
          </div>

          {latestContract ? (
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">
                    {latestContract.contract_name || latestContract.contract_slug || 'Elavtal'}
                  </div>
                  <div className="mt-1 text-xs text-white/55">
                    {customerStatusText(latestContract.status)} • Start:{' '}
                    {formatDate(latestContract.starts_at)}
                  </div>
                </div>

                <div className="text-xs text-white/50">
                  Avtalsnummer: {latestContract.contract_number || latestContract.contract_external_ref || '—'}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-sm text-white/60">
              Inget avtal visas ännu.
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold">Senaste meddelande</h2>

          {latestNotification ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-sm font-medium">{latestNotification.title}</div>
              <div className="mt-2 text-sm text-white/70">{latestNotification.body}</div>
              <div className="mt-3 text-[11px] text-white/45">
                {formatDate(latestNotification.created_at)}
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-white/60">
              Inga meddelanden ännu.
            </div>
          )}
        </section>
      </div>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Anläggning</h2>
            <p className="mt-2 text-sm text-white/60">
              Här visas den anläggning som är kopplad till ditt elavtal.
            </p>
          </div>
          <Link href="/dashboard/contracts" className="text-sm text-cyan-300 hover:text-cyan-200">
            Visa mer
          </Link>
        </div>

        {latestSite ? (
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <Info label="Adress" value={[latestSite.address, latestSite.city].filter(Boolean).join(', ') || '—'} />
            <Info label="Anläggnings-ID" value={latestSite.facility_id || 'Kontrolleras'} />
            <Info label="Mätpunkts-ID" value={latestSite.metering_point_id || 'Kontrolleras'} />
            <Info label="Status" value={customerStatusText(latestSite.verification_status || latestSite.resolution_status)} />
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-white/60">
            Ingen anläggning visas ännu.
          </div>
        )}
      </section>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="text-xs text-white/45">{label}</div>
      <div className="mt-2 break-words text-sm text-white/85">{value}</div>
    </div>
  )
}
