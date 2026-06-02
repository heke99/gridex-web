import { requireAdminPageAccess } from '@/lib/admin/guards'

export const dynamic = 'force-dynamic'

type ProviderRow = {
  provider_key: string
  provider_name: string
  domain: string
  capabilities: unknown
  documentation_url: string | null
}

type ConnectionRow = {
  id: string
  provider_key: string
  connection_name: string
  domain: string
  status: string
  base_url: string | null
  is_sandbox: boolean
  last_healthcheck_at: string | null
  last_success_at: string | null
}

type SyncJobRow = {
  id: string
  provider_key: string | null
  entity_type: string
  entity_id: string | null
  direction: string
  status: string
  attempts: number
  last_error: string | null
  created_at: string
  updated_at: string
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'

  return new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatCapabilities(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function EnvBadge({ configured }: { configured: boolean }) {
  return (
    <span
      className={`rounded-full border px-2 py-1 text-[11px] ${
        configured
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
          : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
      }`}
    >
      {configured ? 'konfigurerad' : 'saknas'}
    </span>
  )
}

export default async function AdminIntegrationsPage() {
  const ctx = await requireAdminPageAccess({
    anyOf: ['integrations.read', 'admin.access'],
  })

  const [providersRes, connectionsRes, jobsRes] = await Promise.all([
    ctx.supabase
      .from('external_provider_catalog')
      .select('provider_key,provider_name,domain,capabilities,documentation_url')
      .order('domain', { ascending: true })
      .returns<ProviderRow[]>(),
    ctx.supabase
      .from('external_system_connections')
      .select(
        'id,provider_key,connection_name,domain,status,base_url,is_sandbox,last_healthcheck_at,last_success_at'
      )
      .order('domain', { ascending: true })
      .returns<ConnectionRow[]>(),
    ctx.supabase
      .from('integration_sync_jobs')
      .select(
        'id,provider_key,entity_type,entity_id,direction,status,attempts,last_error,created_at,updated_at'
      )
      .order('created_at', { ascending: false })
      .limit(12)
      .returns<SyncJobRow[]>(),
  ])

  if (providersRes.error) throw new Error(providersRes.error.message)
  if (connectionsRes.error) throw new Error(connectionsRes.error.message)
  if (jobsRes.error) throw new Error(jobsRes.error.message)

  const providers = providersRes.data ?? []
  const connections = connectionsRes.data ?? []
  const jobs = jobsRes.data ?? []

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-semibold">Integrationer</h1>
        <p className="mt-2 text-sm text-white/60">
          Status och kontrakt för externa system: CIS/fakturering, kundportal,
          datafeeds och marknadsprisimport.
        </p>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
          <div className="text-xs uppercase tracking-[0.18em] text-white/45">
            Providers
          </div>
          <div className="mt-3 text-3xl font-semibold">{providers.length}</div>
          <div className="mt-2 text-xs text-white/60">
            Registrerade externa systemtyper.
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
          <div className="text-xs uppercase tracking-[0.18em] text-white/45">
            Aktiva kopplingar
          </div>
          <div className="mt-3 text-3xl font-semibold">
            {connections.filter((connection) => connection.status === 'active').length}
          </div>
          <div className="mt-2 text-xs text-white/60">
            Kopplingar med status active.
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
          <div className="text-xs uppercase tracking-[0.18em] text-white/45">
            Senaste jobb
          </div>
          <div className="mt-3 text-3xl font-semibold">{jobs.length}</div>
          <div className="mt-2 text-xs text-white/60">
            Inbound/outbound sync-jobb i loggen.
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold">Vercel miljövariabler</h2>
        <p className="mt-2 text-sm text-white/60">
          Dessa behövs för deploy och server-side integrationer. Secrets visas
          aldrig här, bara om de är satta i miljön.
        </p>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {[
            {
              name: 'NEXT_PUBLIC_SUPABASE_URL',
              configured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
            },
            {
              name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
              configured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
            },
            {
              name: 'SUPABASE_SERVICE_ROLE_KEY',
              configured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
            },
            {
              name: 'GRIDEX_INTEGRATION_API_KEY',
              configured: Boolean(process.env.GRIDEX_INTEGRATION_API_KEY),
            },
            {
              name: 'CRON_SECRET',
              configured: Boolean(process.env.CRON_SECRET),
            },
            {
              name: 'SPOT_PRICE_API_URL_TEMPLATE',
              configured: Boolean(process.env.SPOT_PRICE_API_URL_TEMPLATE),
            },
          ].map((item) => (
            <div
              key={item.name}
              className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/30 p-4"
            >
              <code className="text-xs text-white/75">{item.name}</code>
              <EnvBadge configured={item.configured} />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold">API-kontrakt</h2>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
            <div className="text-sm font-semibold">Fakturaimport från CIS</div>
            <code className="mt-3 block rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-cyan-100">
              POST /api/integrations/invoices
            </code>
            <p className="mt-3 text-sm text-white/60">
              Kräver Authorization Bearer eller x-gridex-integration-key. Payload
              matchas mot befintlig kund via userId, billingCustomerRef,
              contractCustomerRef, externalIdentityRef eller email och upsertar
              kundfaktura idempotent på providerKey + externalInvoiceRef.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
            <div className="text-sm font-semibold">Marknadsprisimport</div>
            <code className="mt-3 block rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-cyan-100">
              POST /api/integrations/spot-prices/import
            </code>
            <p className="mt-3 text-sm text-white/60">
              Hämtar dagspriser från elprisetjustnu.se för SE1-SE4, räknar
              månadsgenomsnitt i öre/kWh och skriver till gridex_monthly_spot_prices.
              Samma route kan köras av Vercel Cron via CRON_SECRET.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold">Provider-katalog</h2>

        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
          <div className="grid grid-cols-12 gap-3 border-b border-white/10 bg-black/30 px-4 py-3 text-xs uppercase tracking-[0.16em] text-white/45">
            <div className="col-span-3">Provider</div>
            <div className="col-span-2">Domän</div>
            <div className="col-span-5">Capabilities</div>
            <div className="col-span-2">Dokumentation</div>
          </div>

          {providers.map((provider) => (
            <div
              key={provider.provider_key}
              className="grid grid-cols-12 gap-3 border-b border-white/5 px-4 py-4 text-sm"
            >
              <div className="col-span-3">
                <div className="font-medium text-white/90">
                  {provider.provider_name}
                </div>
                <div className="mt-1 text-xs text-white/45">
                  {provider.provider_key}
                </div>
              </div>
              <div className="col-span-2 text-white/70">{provider.domain}</div>
              <div className="col-span-5 flex flex-wrap gap-2">
                {formatCapabilities(provider.capabilities).map((capability) => (
                  <span
                    key={capability}
                    className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/65"
                  >
                    {capability}
                  </span>
                ))}
              </div>
              <div className="col-span-2 text-xs text-white/60">
                {provider.documentation_url ? (
                  <a
                    href={provider.documentation_url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline decoration-white/20 underline-offset-4 hover:text-white"
                  >
                    Öppna
                  </a>
                ) : (
                  '—'
                )}
              </div>
            </div>
          ))}

          {providers.length === 0 ? (
            <div className="px-4 py-5 text-sm text-white/55">
              Inga providers registrerade.
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold">Systemanslutningar</h2>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {connections.map((connection) => (
            <article
              key={connection.id}
              className="rounded-2xl border border-white/10 bg-black/30 p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium">{connection.connection_name}</h3>
                  <div className="mt-1 text-xs text-white/50">
                    {connection.provider_key} • {connection.domain}
                  </div>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/70">
                  {connection.status}
                </span>
              </div>

              <div className="mt-4 grid gap-2 text-xs text-white/60 sm:grid-cols-2">
                <div>Sandbox: {connection.is_sandbox ? 'ja' : 'nej'}</div>
                <div>Base URL: {connection.base_url ?? '—'}</div>
                <div>Healthcheck: {formatDate(connection.last_healthcheck_at)}</div>
                <div>Senast lyckad: {formatDate(connection.last_success_at)}</div>
              </div>
            </article>
          ))}

          {connections.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-sm text-white/55">
              Inga systemanslutningar är registrerade ännu.
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold">Senaste sync-jobb</h2>

        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
          <div className="grid grid-cols-12 gap-3 border-b border-white/10 bg-black/30 px-4 py-3 text-xs uppercase tracking-[0.16em] text-white/45">
            <div className="col-span-2">Tid</div>
            <div className="col-span-2">Provider</div>
            <div className="col-span-2">Entity</div>
            <div className="col-span-2">Riktning</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Fel</div>
          </div>

          {jobs.map((job) => (
            <div
              key={job.id}
              className="grid grid-cols-12 gap-3 border-b border-white/5 px-4 py-4 text-sm"
            >
              <div className="col-span-2 text-xs text-white/55">
                {formatDate(job.created_at)}
              </div>
              <div className="col-span-2 text-white/75">
                {job.provider_key ?? '—'}
              </div>
              <div className="col-span-2">
                <div className="text-white/75">{job.entity_type}</div>
                <div className="mt-1 truncate text-xs text-white/45">
                  {job.entity_id ?? '—'}
                </div>
              </div>
              <div className="col-span-2 text-white/65">{job.direction}</div>
              <div className="col-span-2">
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/70">
                  {job.status}
                </span>
              </div>
              <div className="col-span-2 truncate text-xs text-white/50">
                {job.last_error ?? '—'}
              </div>
            </div>
          ))}

          {jobs.length === 0 ? (
            <div className="px-4 py-5 text-sm text-white/55">
              Inga sync-jobb ännu.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
}