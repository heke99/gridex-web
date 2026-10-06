import { getCustomerPortalOverview } from '@/lib/customerPortal/service'
import type { Metadata } from 'next'
// Import status helper to translate raw status codes
import { statusLabel as friendlyStatusLabel } from '@/lib/customerPortal/statusHelper'

// Private page: prevent search engine indexing
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

function priceValue(value: unknown, unit: string): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toLocaleString('sv-SE', { maximumFractionDigits: 4 })} ${unit}` : 'Inväntas'
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))
}

function statusLabel(status: string | null | undefined) {
  // Delegate to central status helper for customer-friendly text
  return friendlyStatusLabel(status ?? undefined)
}

export default async function DashboardContractsPage() {
  const overview = await getCustomerPortalOverview()
  const { contracts, sites, events } = overview

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-semibold">Mina avtal</h1>
        <p className="mt-2 text-sm text-white/60">
          Här ser du dina elavtal, anläggningar och aktuella statusar.
        </p>
      </div>

      {!overview.opsAvailable ? (
        <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm text-amber-50/90">
          Vi visar senast lokalt sparade uppgifter. Uppgifter från Gridex kan vara äldre tills anslutningen är återställd.
        </div>
      ) : null}

      <div className="space-y-4">
        {contracts.map((contract) => (
          <article key={contract.id} className="rounded-3xl border border-white/10 bg-black/30 p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  {contract.contract_name || contract.contract_slug || 'Elavtal'}
                </h2>
                <p className="mt-1 text-sm text-white/60">
                  Status: <span className="text-white/85">{statusLabel(contract.status)}</span>
                </p>
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/60">
                Avtalsnummer: {contract.contract_number || contract.contract_external_ref || '—'}
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Info label="Startdatum" value={formatDate(contract.starts_at)} />
              <Info label="Bekräftat startdatum" value={formatDate(contract.confirmed_start_date)} />
              <Info label="Avtalsreferens" value={contract.contract_number || contract.contract_external_ref || '—'} />
              <Info label="Skapat" value={formatDate(contract.created_at)} />
              <Info label="Energiriktning" value={contract.pricing_snapshot.energy_direction === 'production' ? 'Produktion' : contract.pricing_snapshot.energy_direction === 'consumption' ? 'Förbrukning' : 'Inväntas'} />
              <Info label="Månadsavgift" value={priceValue(contract.pricing_snapshot.monthly_fee_sek, 'kr/mån')} />
              <Info label="Fast energipris" value={priceValue(contract.pricing_snapshot.fixed_price_ore_per_kwh, 'öre/kWh')} />
              <Info label="Påslag" value={priceValue(contract.pricing_snapshot.markup_ore_per_kwh, 'öre/kWh')} />
              <Info label="Bindningstid" value={priceValue(contract.pricing_snapshot.binding_months, 'mån')} />
              <Info label="Uppsägningstid" value={priceValue(contract.pricing_snapshot.notice_months, 'mån')} />
              <Info label="Automatisk förlängning" value={contract.pricing_snapshot.auto_renew_enabled === true ? 'Ja' : contract.pricing_snapshot.auto_renew_enabled === false ? 'Nej' : 'Inväntas'} />
            </div>
            <p className="mt-3 text-xs text-white/50">Priserna är dina avtalsuppgifter. Momshanteringen framgår av avtalsdokumentet.</p>
          </article>
        ))}

        {contracts.length === 0 && (
          <div className="rounded-3xl border border-dashed border-white/10 bg-black/20 p-6 text-sm text-white/60">
            Du har ännu inga avtal att visa.
          </div>
        )}
      </div>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold">Anläggningar</h2>
        <p className="mt-2 text-sm text-white/60">
          Här visas anläggningar och mätpunkter som är kopplade till dina avtal.
        </p>

        <div className="mt-4 space-y-3">
          {sites.map((site) => (
            <div key={site.id} className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="font-medium">
                    {[site.address, site.postal_code, site.city].filter(Boolean).join(', ') || 'Anläggning'}
                  </div>
                  <div className="mt-1 text-xs text-white/55">
                    {site.grid_owner_name || 'Nätägare kontrolleras'} • {site.price_area || site.grid_area_code || 'Område kontrolleras'}
                  </div>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/70">
                  {statusLabel(site.verification_status || site.resolution_status)}
                </span>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <Info label="Anläggnings-ID" value={site.facility_id || 'Kontrolleras'} />
                <Info label="Mätpunkts-ID" value={site.metering_point_id || 'Kontrolleras'} />
                <Info label="Nätområde" value={site.grid_area_code || 'Kontrolleras'} />
              </div>
            </div>
          ))}

          {sites.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-white/60">
              Ingen anläggning visas ännu.
            </div>
          ) : null}
        </div>
      </section>

      {events.length > 0 ? (
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold">Senaste händelser</h2>
          <div className="mt-4 space-y-3">
            {events.slice(0, 8).map((event) => (
              <div key={event.id} className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm">
                <div className="text-white/85">{event.title || event.summary || statusLabel(event.event_type)}</div>
                <div className="mt-1 text-xs text-white/45">{formatDate(event.created_at)}</div>
              </div>
            ))}
          </div>
        </section>
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
