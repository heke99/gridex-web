import { requireAdminPageAccess } from '@/lib/admin/guards'
import CisActionButton from '@/components/admin/CisActionButton'

export const dynamic = 'force-dynamic'

type SyncJob = {
  id: string
  provider_key: string | null
  entity_type: string
  entity_id: string | null
  direction: string
  status: string
  last_error: string | null
  created_at: string
}

type CisAction = {
  id: string
  action_type: string
  status: string
  provider_key: string
  attempts: number
  last_error: string | null
  created_at: string
  signup_order_id: string | null
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Date(value).toLocaleString('sv-SE', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

export default async function AdminIntegrationsPage() {
  const ctx = await requireAdminPageAccess({
    anyOf: ['integrations.read', 'cis.sync.write', 'admin.access'],
  })

  const [jobsRes, cisRes] = await Promise.all([
    ctx.supabase
      .from('integration_sync_jobs')
      .select('id,provider_key,entity_type,entity_id,direction,status,last_error,created_at')
      .order('created_at', { ascending: false })
      .limit(20)
      .returns<SyncJob[]>(),
    ctx.supabase
      .from('cis_sync_actions')
      .select('id,action_type,status,provider_key,attempts,last_error,created_at,signup_order_id')
      .order('created_at', { ascending: false })
      .limit(20)
      .returns<CisAction[]>(),
  ])

  const jobs = jobsRes.data ?? []
  const cisActions = cisRes.data ?? []

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-semibold">Integrationer</h1>
        <p className="mt-2 text-sm text-white/60">
          Status för CIS, fakturaimport, elprisimport och webhooks. Här ser du
          köade jobb, fel och actions som kan skickas om eller avbrytas.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <Kpi label="Sync-jobb" value={jobs.length} />
        <Kpi
          label="CIS-actions"
          value={cisActions.length}
        />
        <Kpi
          label="Fel/dead-letter"
          value={
            jobs.filter((job) => ['failed', 'dead_letter'].includes(job.status)).length +
            cisActions.filter((action) => ['failed', 'dead_letter'].includes(action.status)).length
          }
        />
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold">Miljö och lägen</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {[
            ['SUPABASE_SERVICE_ROLE_KEY', Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)],
            ['GRIDEX_INTEGRATION_API_KEY', Boolean(process.env.GRIDEX_INTEGRATION_API_KEY)],
            ['CRON_SECRET', Boolean(process.env.CRON_SECRET)],
            ['CIS_API_BASE_URL', Boolean(process.env.CIS_API_BASE_URL)],
            ['CIS_API_KEY', Boolean(process.env.CIS_API_KEY)],
            ['CIS_SANDBOX_MODE', process.env.CIS_SANDBOX_MODE !== 'false'],
            ['PII_ENCRYPTION_KEY', Boolean(process.env.PII_ENCRYPTION_KEY)],
            ['PII_HASH_PEPPER', Boolean(process.env.PII_HASH_PEPPER)],
          ].map(([name, ok]) => (
            <div
              key={String(name)}
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 p-4"
            >
              <code className="text-xs text-white/70">{name}</code>
              <span
                className={`rounded-full border px-2 py-1 text-[11px] ${
                  ok
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                }`}
              >
                {ok ? 'ok' : 'saknas'}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold">CIS-actions</h2>
        <div className="mt-4 space-y-3">
          {cisActions.map((action) => (
            <div
              key={action.id}
              className="rounded-2xl border border-white/10 bg-black/30 p-4"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="font-medium">{action.action_type}</div>
                  <div className="mt-1 text-xs text-white/50">
                    {action.provider_key} • {formatDate(action.created_at)} • försök {action.attempts}
                  </div>
                  {action.last_error ? (
                    <div className="mt-2 text-xs text-rose-200">{action.last_error}</div>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/70">
                    {action.status}
                  </span>
                  <CisActionButton actionId={action.id} operation="retry" label="Retry" />
                  <CisActionButton actionId={action.id} operation="resend_signature" label="Skicka signering igen" />
                  <CisActionButton actionId={action.id} operation="cancel" label="Avbryt" />
                </div>
              </div>
            </div>
          ))}

          {cisActions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-sm text-white/55">
              Inga CIS-actions ännu.
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold">Senaste sync-jobb</h2>
        <div className="mt-4 space-y-3">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="grid gap-2 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm md:grid-cols-5"
            >
              <div>{formatDate(job.created_at)}</div>
              <div>{job.provider_key ?? '—'}</div>
              <div>{job.entity_type}</div>
              <div>{job.direction} / {job.status}</div>
              <div className="truncate text-white/50">{job.last_error ?? job.entity_id ?? '—'}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
      <div className="text-xs uppercase tracking-[0.18em] text-white/45">
        {label}
      </div>
      <div className="mt-3 text-3xl font-semibold">{value}</div>
    </div>
  )
}
