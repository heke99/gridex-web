// app/admin/audit/pricing/page.tsx
import Link from 'next/link'
import { requireAdminPageAccess } from '@/lib/admin/guards'

export const dynamic = 'force-dynamic'

type Search = {
  contract?: string
  action?: string
  from?: string
  to?: string
  limit?: string
}

type Contract = {
  id: string
  name: string
  slug: string
}

type AuditRow = {
  id: string
  contract_id: string
  version_id: string
  action: 'publish' | 'unpublish'
  performed_by: string
  performed_at: string
}

function clampLimit(v: string | undefined): number {
  const n = Number(v || 50)
  if (!Number.isFinite(n)) return 50
  return Math.max(10, Math.min(500, Math.floor(n)))
}

export default async function PricingAuditPage({
  searchParams,
}: {
  searchParams?: Promise<Search>
}) {
  const ctx = await requireAdminPageAccess({ anyOf: ['admin.access'] })
  const supabase = ctx.supabase

  const sp = (await searchParams) || {}
  const contract = (sp.contract ?? '').trim()
  const action = (sp.action ?? '').trim()
  const from = (sp.from ?? '').trim()
  const to = (sp.to ?? '').trim()
  const limit = clampLimit(sp.limit)

  const { data: contractsData } = await supabase
    .from('contract_products')
    .select('id,name,slug')
    .order('name', { ascending: true })

  const contracts: Contract[] = contractsData ?? []

  let query = supabase
    .from('pricing_version_audit')
    .select(
      'id, contract_id, version_id, action, performed_by, performed_at'
    )
    .order('performed_at', { ascending: false })
    .limit(limit)

  if (contract) query = query.eq('contract_id', contract)
  if (action) query = query.eq('action', action)
  if (from) query = query.gte('performed_at', new Date(from).toISOString())
  if (to) query = query.lte('performed_at', new Date(to).toISOString())

  const { data: auditData, error } =
    await query.returns<AuditRow[]>()

  const rows: AuditRow[] = auditData ?? []

  const exportParams = new URLSearchParams()
  if (contract) exportParams.set('contract', contract)
  if (action) exportParams.set('action', action)
  if (from) exportParams.set('from', from)
  if (to) exportParams.set('to', to)
  exportParams.set('limit', String(limit))

  const exportHref = `/admin/audit/pricing/export?${exportParams.toString()}`

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-gray-800 bg-gray-950 p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Pricing Audit Log</h1>
            <p className="text-gray-400 mt-2">
              Spårar publish/unpublish per kontrakt. Investor-grade governance.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={exportHref}
              className="rounded-xl border border-gray-800 bg-black/40 px-4 py-2 text-sm text-white hover:border-cyan-500/40"
            >
              Export CSV
            </Link>
            <Link
              href="/admin/pricing"
              className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-bold text-black"
            >
              Till prishantering
            </Link>
          </div>
        </div>
      </div>

      {/* Filter */}
      <form className="rounded-3xl border border-gray-800 bg-gray-950 p-6">
        <div className="grid gap-4 md:grid-cols-5">
          <div className="md:col-span-2">
            <label className="text-xs text-gray-400">Kontrakt</label>
            <select
              name="contract"
              defaultValue={contract}
              className="mt-2 w-full rounded-xl border border-gray-800 bg-black/40 px-3 py-2 text-sm"
            >
              <option value="">Alla</option>
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.slug})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-400">Action</label>
            <select
              name="action"
              defaultValue={action}
              className="mt-2 w-full rounded-xl border border-gray-800 bg-black/40 px-3 py-2 text-sm"
            >
              <option value="">Alla</option>
              <option value="publish">publish</option>
              <option value="unpublish">unpublish</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-400">From</label>
            <input
              name="from"
              type="date"
              defaultValue={from}
              className="mt-2 w-full rounded-xl border border-gray-800 bg-black/40 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-gray-400">To</label>
            <input
              name="to"
              type="date"
              defaultValue={to}
              className="mt-2 w-full rounded-xl border border-gray-800 bg-black/40 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-gray-400">Limit</label>
            <input
              name="limit"
              type="number"
              min={10}
              max={500}
              defaultValue={String(limit)}
              className="mt-2 w-full rounded-xl border border-gray-800 bg-black/40 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="mt-5">
          <button
            type="submit"
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90"
          >
            Filtrera
          </button>
        </div>
      </form>

      {/* Table */}
      <div className="rounded-3xl border border-gray-800 bg-gray-950 p-6">
        {error && (
          <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            Kunde inte läsa audit log: {error.message}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-gray-400">
              <tr>
                <th className="py-2 pr-4">performed_at</th>
                <th className="py-2 pr-4">action</th>
                <th className="py-2 pr-4">contract_id</th>
                <th className="py-2 pr-4">version_id</th>
                <th className="py-2 pr-4">performed_by</th>
              </tr>
            </thead>
            <tbody className="text-gray-200">
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-gray-800">
                  <td className="py-3 pr-4">
                    {new Date(r.performed_at).toLocaleString('sv-SE')}
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={
                        r.action === 'publish'
                          ? 'text-emerald-300'
                          : 'text-amber-300'
                      }
                    >
                      {r.action}
                    </span>
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs text-gray-400">
                    {r.contract_id}
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs text-gray-400">
                    {r.version_id}
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs text-gray-400">
                    {r.performed_by}
                  </td>
                </tr>
              ))}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-gray-500">
                    Inga audit events matchar filtret.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 text-xs text-gray-500">
          Tips: exportera CSV för compliance/rapportering.
        </div>
      </div>
    </div>
  )
}