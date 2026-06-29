import Link from 'next/link'
import { requireAdminPageAccess } from '@/lib/admin/guards'

export const dynamic = 'force-dynamic'

export default async function AdminCustomerSpecPreviewPage() {
  await requireAdminPageAccess({ anyOf: ['admin.access'] })

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">
              Kundspecifikation • Preview
            </h1>
            <p className="mt-2 text-sm text-white/60">
              Enterprise-kontrollpunkt för att säkerställa att kundens
              specifikation alltid matchar publicerad prissättning, avgifter och
              elområde innan data exponeras i kundflöden eller publika sidor.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/calculator"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
            >
              Öppna kalkylator-preview
            </Link>
            <Link
              href="/admin/pricing"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
            >
              Till prishantering
            </Link>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="text-sm font-semibold">Kontrollpunkter</div>
        <div className="mt-3 space-y-3 text-[13px] leading-6 text-white/65">
          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
            Hämta publicerad pricing-version per kontrakt från
            <span className="ml-1 text-white/85">contract_pricing_versions</span>.
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
            Hämta area-priser från
            <span className="ml-1 text-white/85">contract_area_pricing</span>.
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
            Hämta spot-inställningar från
            <span className="ml-1 text-white/85">gridex_spot_area_settings</span>
            {' '}eller portfölj/fasta värden från
            <span className="ml-1 text-white/85">gridex_portfolio_area_pricing</span>.
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
            Rendera samma prisrad som kundvyn visar, inklusive avrundning,
            månadsavgift, rörliga avgifter och kontraktsspecifika komponenter.
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
            Säkerställ att preview-actions loggas i audit-flödet så att
            verifiering och felsökning kan spåras.
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="text-sm font-semibold">Rekommenderat arbetsflöde</div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-white/45">
              Steg 1
            </div>
            <div className="mt-2 text-sm text-white/85">
              Sätt eller uppdatera priser i pricing och områdesdata.
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-white/45">
              Steg 2
            </div>
            <div className="mt-2 text-sm text-white/85">
              Verifiera resultat i kalkylator-preview per område och förbrukning.
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-white/45">
              Steg 3
            </div>
            <div className="mt-2 text-sm text-white/85">
              Publicera först när kundspec och publikt utfall stämmer exakt.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}