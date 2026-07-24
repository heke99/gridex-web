import { requireAdminPageAccess } from '@/lib/admin/guards'
import CisActionButton from '@/components/admin/CisActionButton'
import PortalOutboxReplayButton from '@/components/admin/PortalOutboxReplayButton'
import { checkOpsIntegrationReadiness } from '@/lib/ops/readiness'
import { checkOpsCustomerPortalReadiness } from '@/lib/ops/portalReadiness'
import { fetchOpsPublicContractDiagnostics } from '@/lib/ops/client'

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


type PortalOutboxRow = {
  id: string
  operation_type: string
  status: string
  attempt_count: number
  max_attempts: number
  last_error_code: string | null
  last_error_message: string | null
  next_attempt_at: string | null
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

  const [jobsRes, cisRes, outboxRes, opsReadiness, portalReadiness, publicContractDiagnostics] = await Promise.all([
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
    ctx.supabase
      .from('customer_portal_write_outbox')
      .select('id,operation_type,status,attempt_count,max_attempts,last_error_code,last_error_message,next_attempt_at,created_at')
      .order('created_at', { ascending: false })
      .limit(30)
      .returns<PortalOutboxRow[]>(),
    checkOpsIntegrationReadiness(),
    checkOpsCustomerPortalReadiness(),
    fetchOpsPublicContractDiagnostics()
      .then((data) => ({ data, error: null as string | null }))
      .catch((error) => ({
        data: null,
        error: error instanceof Error ? error.message : String(error),
      })),
  ])

  const jobs = jobsRes.data ?? []
  const cisActions = cisRes.data ?? []
  const portalOutbox = outboxRes.data ?? []

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
            cisActions.filter((action) => ['failed', 'dead_letter'].includes(action.status)).length +
            portalOutbox.filter((item) => ['failed', 'dead_letter'].includes(item.status)).length
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
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Gridex API-readiness</h2>
            <p className="mt-1 text-sm text-white/60">{opsReadiness.message}</p>
          </div>
          <span className={`w-fit rounded-full border px-3 py-1 text-xs ${opsReadiness.ready ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-rose-500/30 bg-rose-500/10 text-rose-200'}`}>
            {opsReadiness.code}
          </span>
        </div>
        <div className="mt-5 grid gap-2 md:grid-cols-2">
          {opsReadiness.scopes.map((scope) => (
            <div key={scope.scope} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2">
              <code className="text-[11px] text-white/70">{scope.scope}</code>
              <span className={`text-[11px] ${scope.status === 'missing' ? 'text-rose-300' : scope.status === 'verified' || scope.status === 'declared' ? 'text-emerald-300' : 'text-amber-300'}`}>{scope.status}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 space-y-2">
          {opsReadiness.probes.map((probe) => (
            <div key={probe.name} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs">
              <span className="text-white/65">{probe.name}</span>
              <span className={probe.ok ? 'text-emerald-300' : 'text-rose-300'}>
                {probe.ok ? `verifierad (${probe.status ?? 200})` : `fel (${probe.status ?? 'n/a'}${probe.code ? `, ${probe.code}` : ''})`}
              </span>
            </div>
          ))}
        </div>
        <div className={`mt-5 rounded-2xl border p-4 ${opsReadiness.webhook.ready ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-rose-500/30 bg-rose-500/10'}`}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold">OPS-webhooks för portalstatus</div>
              <p className="mt-1 text-xs text-white/60">
                Kräver aktiverad mottagning, signeringshemlighet och förväntat company-ID utan konflikt mellan hemlighetsalias.
              </p>
            </div>
            <span className={opsReadiness.webhook.ready ? 'text-emerald-300' : 'text-rose-300'}>
              {opsReadiness.webhook.ready ? 'redo' : 'blockerad'}
            </span>
          </div>
          <div className="mt-3 grid gap-2 text-xs md:grid-cols-4">
            <span>Aktiv: {opsReadiness.webhook.enabled ? 'ja' : 'nej'}</span>
            <span>Secret: {opsReadiness.webhook.signingSecretConfigured ? 'ja' : 'nej'}</span>
            <span>Tenantreferens: {opsReadiness.webhook.expectedTenantReferenceConfigured ? 'ja' : 'nej'}</span>
            <span>Konflikt: {opsReadiness.webhook.secretConflict ? 'ja' : 'nej'}</span>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Mina sidor-readiness</h2>
            <p className="mt-1 text-sm text-white/60">{portalReadiness.message}</p>
          </div>
          <span className={portalReadiness.ready ? 'text-emerald-300' : 'text-rose-300'}>
            {portalReadiness.ready ? 'redo' : 'blockerad'}
          </span>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {portalReadiness.scopes.map((scope) => (
            <div key={scope.scope} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2">
              <code className="text-[11px] text-white/70">{scope.scope}</code>
              <span className={scope.status === 'missing' ? 'text-rose-300' : scope.status === 'declared' ? 'text-emerald-300' : 'text-amber-300'}>{scope.status}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 text-xs text-white/60">
          portal-bundle: {portalReadiness.portalBundleProbe.ok ? 'verifierad' : 'fel'} ({portalReadiness.portalBundleProbe.status ?? 'n/a'}{portalReadiness.portalBundleProbe.code ? `, ${portalReadiness.portalBundleProbe.code}` : ''})
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div>
          <h2 className="text-lg font-semibold">Publiceringsdiagnostik för avtal</h2>
          <p className="mt-1 text-sm text-white/60">
            Hämtas server-side från OPS canonical diagnostics-endpoint och visas endast för behörig admin.
          </p>
        </div>
        {publicContractDiagnostics.error ? (
          <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
            Diagnostiken kunde inte hämtas: {publicContractDiagnostics.error}
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {(publicContractDiagnostics.data?.items ?? []).map((item, index) => (
              <div key={item.offer_reference ?? `${item.name ?? 'offer'}-${index}`} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-medium">{item.name ?? 'Avtal utan namn'}</div>
                    <code className="mt-1 block text-[11px] text-white/45">{item.offer_reference ?? 'saknar offer_reference'}</code>
                  </div>
                  <span className={`w-fit rounded-full border px-3 py-1 text-xs ${item.visible === true ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : item.visible === false ? 'border-rose-500/30 bg-rose-500/10 text-rose-200' : 'border-amber-500/30 bg-amber-500/10 text-amber-200'}`}>
                    {item.visible === true ? 'synligt' : item.visible === false ? 'blockerat' : 'okänd status'}
                  </span>
                </div>
                {item.blockers.length > 0 ? (
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-rose-100/80">
                    {item.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
                  </ul>
                ) : (
                  <div className="mt-3 text-sm text-white/50">Inga blockers rapporterade.</div>
                )}
              </div>
            ))}
            {(publicContractDiagnostics.data?.items.length ?? 0) === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-sm text-white/55">
                OPS returnerade ingen avtalsdiagnostik.
              </div>
            ) : null}
          </div>
        )}
      </section>


      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div>
          <h2 className="text-lg font-semibold">Kundportalens skrivkö</h2>
          <p className="mt-1 text-sm text-white/60">Tillfälliga fel försöks om automatiskt. Permanenta fel och dead-letter kan köas om efter att grundfelet är rättat.</p>
        </div>
        <div className="mt-4 space-y-3">
          {portalOutbox.map((item) => (
            <div key={item.id} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/30 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-medium">{item.operation_type}</div>
                <div className="mt-1 text-xs text-white/50">
                  {formatDate(item.created_at)} • {item.status} • försök {item.attempt_count}/{item.max_attempts}
                </div>
                {item.last_error_message || item.last_error_code ? (
                  <div className="mt-2 text-xs text-rose-200">{item.last_error_code ? `${item.last_error_code}: ` : ''}{item.last_error_message}</div>
                ) : null}
              </div>
              {['failed', 'dead_letter'].includes(item.status) ? <PortalOutboxReplayButton outboxId={item.id} /> : null}
            </div>
          ))}
          {portalOutbox.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-sm text-white/55">Inga köade kundportalåtgärder.</div>
          ) : null}
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
