import type { CustomerPortalContract } from '@/lib/customerPortal/types'
import { CUSTOMER_NETWORK_FEE_NOTICE } from '@/lib/website/customerFacingCopy'

function price(value: unknown, unit: string): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? `${value.toLocaleString('sv-SE', { maximumFractionDigits: 4 })} ${unit}`
    : 'Uppgift saknas'
}

/** Only the customer's recorded contract values; never today's public quote. */
export default function ContractPricing({ contract }: { contract: CustomerPortalContract }) {
  const snapshot = contract.pricing_snapshot
  const marketBased = [
    'variable_spot', 'variable_monthly', 'spot_monthly', 'variable_hourly', 'spot_hourly',
    'variable_quarterly', 'spot_quarterly', 'quarter_hourly', 'portfolio', 'portfolio_managed',
  ].includes(String(snapshot.contract_type))
  const fixedPriceApplies = !marketBased || typeof snapshot.fixed_price_ore_per_kwh === 'number'
  return (
    <section aria-label="Dina avtalspriser" className="mt-5">
      <h3 className="font-semibold text-white">Dina avtalspriser</h3>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Price label="Elområde" value={typeof snapshot.price_area === 'string' ? snapshot.price_area : 'Uppgift saknas'} />
        <Price label="Månadsavgift" value={price(snapshot.monthly_fee_sek, 'kr/mån')} />
        <Price label="Fakturaavgift" value={price(snapshot.invoice_fee_sek, 'kr/faktura')} />
        {fixedPriceApplies ? <Price label="Fast energipris" value={price(snapshot.fixed_price_ore_per_kwh, 'öre/kWh')} /> : null}
        <Price label="Påslag" value={price(snapshot.markup_ore_per_kwh, 'öre/kWh')} />
      </dl>
      {marketBased ? <p className="mt-3 text-sm text-white/70">Din energikostnad beräknas för faktureringsperioden enligt avtalet, utifrån uppmätt förbrukning eller produktion samt avtalade priser, påslag och avgifter.</p> : null}
      <p className="mt-3 text-xs text-white/55">Beloppen är avtalets registrerade prisuppgifter. Momshanteringen framgår av avtalsdokumentet. {CUSTOMER_NETWORK_FEE_NOTICE}</p>
    </section>
  )
}

function Price({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm"><dt className="text-white/55">{label}</dt><dd className="mt-2 break-words text-white">{value}</dd></div>
}
