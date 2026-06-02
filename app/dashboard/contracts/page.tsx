import {
  getCustomerAgreementEvents,
  getCustomerContracts,
  getCustomerSignupOrders,
  getPortalSession,
} from '@/lib/customerPortal/service'

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
  const [contracts, signupOrders, events] = await Promise.all([
    getCustomerContracts(supabase, user.id),
    getCustomerSignupOrders(supabase, user.id),
    getCustomerAgreementEvents(supabase, user.id),
  ])

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-semibold">Mina avtal</h1>
        <p className="mt-2 text-sm text-white/60">
          Här visas dina avtal och deras aktuella status i portalen.
        </p>
      </div>

      {signupOrders.length > 0 ? (
        <section className="space-y-4">
          {signupOrders.map((order) => (
            <article
              key={order.id}
              className="rounded-3xl border border-cyan-500/20 bg-cyan-500/5 p-6"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">
                    {order.contract_name || order.contract_slug}
                  </h2>
                  <p className="mt-1 text-sm text-cyan-100">
                    {order.customer_status_label}
                  </p>
                  <p className="mt-2 text-xs text-white/50">
                    {order.price_area} • {Number(order.monthly_consumption_kwh).toLocaleString('sv-SE')} kWh/mån • {order.signing_provider}
                  </p>
                </div>

                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/70">
                  Steg {order.customer_status_step}/5
                </div>
              </div>

              <div className="mt-5 grid gap-2 md:grid-cols-5">
                {[
                  'Vi har tagit emot din beställning',
                  'Avtal väntar på signering',
                  'Avtal signerat',
                  'Avtal aktiveras',
                  'Avtal aktivt',
                ].map((label, index) => {
                  const step = index + 1
                  const active = order.customer_status_step >= step

                  return (
                    <div
                      key={label}
                      className={`rounded-2xl border p-3 text-xs ${
                        active
                          ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-100'
                          : 'border-white/10 bg-black/20 text-white/45'
                      }`}
                    >
                      <div className="font-semibold">Steg {step}</div>
                      <div className="mt-1">{label}</div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-xs leading-relaxed text-white/60">
                Rörligt månadspris innebär att priset kan variera månad till
                månad och baseras på föregående månads snittpris. Endast fasta
                elprisavtal har fast kWh-pris.
              </div>
            </article>
          ))}
        </section>
      ) : null}

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

      {events.length > 0 ? (
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold">Senaste händelser</h2>
          <div className="mt-4 space-y-3">
            {events.slice(0, 8).map((event) => (
              <div
                key={event.id}
                className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm"
              >
                <div className="text-white/85">
                  {event.customer_label || event.summary || event.event_type}
                </div>
                <div className="mt-1 text-xs text-white/45">
                  {formatDate(event.created_at)}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}