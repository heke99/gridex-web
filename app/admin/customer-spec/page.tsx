// app/admin/customer-spec/page.tsx
import { requirePermissionServer } from '@/lib/auth/requirePermissionServer'

export const dynamic = 'force-dynamic'

export default async function AdminCustomerSpecPreviewPage() {
  await requirePermissionServer('admin.access')

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-semibold">Kundspecifikation • Preview</h1>
        <p className="mt-2 text-sm text-white/60">
          Den här vyn är en enterprise-kontrollpunkt för att säkerställa att kundens specifikation alltid
          matchar publicerad prissättning (spot/portfölj/fast) + påslag + avgifter, per elområde.
        </p>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="text-sm font-semibold">Steg B/C koppling</div>
        <div className="mt-2 text-[12px] leading-6 text-white/60">
          • Hämta publicerad pricing-version per kontrakt (contract_pricing_versions)
          <br />
          • Hämta area-priser (contract_area_pricing)
          <br />
          • Hämta spot-inställningar (gridex_spot_area_settings) eller portfölj/fasta priser
          (gridex_portfolio_area_pricing)
          <br />
          • Rendera samma prisrad som kund-vyn visar (inkl moms/öresavrundning om ni har det)
          <br />
          • Logga preview-actions i audit
        </div>
      </div>
    </div>
  )
}