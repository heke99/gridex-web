import { getCustomerPortalOverview } from '@/lib/customerPortal/service'
import type { Metadata } from 'next'
// Import status helper to translate status codes to customer-friendly labels
import { statusLabel as friendlyStatusLabel } from '@/lib/customerPortal/statusHelper'

// Private page: prevent indexing by search engines
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))
}

function statusLabel(status: string | null | undefined) {
  // Delegate to central helper. Unknown statuses fall back to safe default.
  return friendlyStatusLabel(status ?? undefined)
}

export default async function DashboardApprovalsPage() {
  const overview = await getCustomerPortalOverview()

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-semibold">Godkännanden och fullmakt</h1>
        <p className="mt-2 text-sm text-white/60">
          Här ser du vilka villkor, vilken ångerrättsinformation, vilken integritetspolicy och vilken fullmakt som är kopplade till din kundprofil.
        </p>
      </div>

      {!overview.opsAvailable ? (
        <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm text-amber-50/90">
          Vi visar senast lokalt sparade uppgifter. Uppgifter från Gridex kan vara äldre tills anslutningen är återställd.
        </div>
      ) : null}

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold">Mina godkännanden</h2>
        <div className="mt-4 space-y-3">
          {overview.legalAcceptances.map((item) => (
            <div key={item.id} className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="font-medium">{item.title || 'Godkännande'}</div>
                  <div className="mt-1 text-xs text-white/50">
                    Version {item.version || '—'} • {formatDate(item.accepted_at)} • {item.source || 'Mina sidor'}
                  </div>
                </div>
                <span className="w-fit rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/70">
                  {statusLabel(item.status)}
                </span>
              </div>
            </div>
          ))}
          {overview.legalAcceptances.length === 0 ? (
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
          {overview.powersOfAttorney.map((poa) => (
            <div key={poa.id} className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="font-medium">{poa.title || 'Fullmakt'}</div>
                  <div className="mt-1 text-xs text-white/50">
                    Godkänd {formatDate(poa.accepted_at)} • Version {poa.version || '—'}
                  </div>
                  {poa.revoked_at ? (
                    <div className="mt-1 text-xs text-white/50">Återkallad {formatDate(poa.revoked_at)}</div>
                  ) : null}
                </div>
                <span className="w-fit rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/70">
                  {statusLabel(poa.status)}
                </span>
              </div>
            </div>
          ))}
          {overview.powersOfAttorney.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-white/60">
              Fullmakt visas när den är kopplad till din kundprofil.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
}
