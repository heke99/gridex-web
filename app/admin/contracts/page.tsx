// app/admin/contracts/page.tsx
import Link from 'next/link'
import { requireAdminPageAccess } from '@/lib/admin/guards'
import { createClient } from '@supabase/supabase-js'
import { createContract, setContractActive } from './actions'

export const dynamic = 'force-dynamic'

type ContractType = 'spot_hourly' | 'portfolio_managed' | 'fixed'

type ContractRow = {
  id: string
  name: string
  slug: string
  contract_type: ContractType
  is_active: boolean
  created_at: string
}

type VersionRow = {
  id: string
  contract_id: string
  valid_from: string
  is_published: boolean | null
  status?: string | null
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

function fmtDate(v: string) {
  try {
    return new Date(v).toLocaleString('sv-SE', { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return v
  }
}

type PublishState = 'DRAFT' | 'LIVE' | 'SCHEDULED'

function classifyPublishState(nowIso: string, published: VersionRow | null): PublishState {
  if (!published) return 'DRAFT'
  if (published.valid_from > nowIso) return 'SCHEDULED'
  return 'LIVE'
}

export default async function AdminContractsPage() {
  const ctx = await requireAdminPageAccess({ anyOf: ['contracts.read', 'contracts.write', 'admin.access'] })
  const supabase = ctx.supabase

  // 🔥 Service client (bypass RLS)
  const service = getServiceClient()
  const nowIso = new Date().toISOString()

  const { data, error } = await service
    .from('contract_products')
    .select('id,name,slug,contract_type,is_active,created_at')
    .order('created_at', { ascending: false })
    .returns<ContractRow[]>()

  if (error) throw new Error(error.message)

  const contracts = data ?? []
  const ids = contracts.map((c) => c.id)
  const safeIds = ids.length ? ids : ['00000000-0000-0000-0000-000000000000']

  // We support both schema variants:
  // A) contract_pricing_versions.status = 'published'
  // B) contract_pricing_versions.is_published = true
  const publishedByContract = new Map<string, VersionRow | null>()

  const qStatus = await service
    .from('contract_pricing_versions')
    .select('id,contract_id,valid_from,status')
    .in('contract_id', safeIds)
    .eq('status', 'published')
    .order('valid_from', { ascending: false })

  if (!qStatus.error && Array.isArray(qStatus.data) && qStatus.data.length > 0) {
    for (const v of qStatus.data as VersionRow[]) {
      if (!publishedByContract.has(v.contract_id)) publishedByContract.set(v.contract_id, v)
    }
  } else {
    const qIsPub = await service
      .from('contract_pricing_versions')
      .select('id,contract_id,valid_from,is_published')
      .in('contract_id', safeIds)
      .eq('is_published', true)
      .order('valid_from', { ascending: false })

    if (qIsPub.error) throw new Error(qIsPub.error.message)

    for (const v of (qIsPub.data ?? []) as VersionRow[]) {
      if (!publishedByContract.has(v.contract_id)) publishedByContract.set(v.contract_id, v)
    }
  }

  return (
    <div className="space-y-10">
      <div className="flex items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold">Elavtal</h1>
          <p className="text-gray-400 mt-2">
            Skapa och hantera avtalsprodukter (spot, portfölj, fast).
            Publicering sker via prisversioner.
          </p>
        </div>

        <Link
          href="/admin/pricing"
          className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-bold text-black"
        >
          Till prishantering
        </Link>
      </div>

      {/* Create */}
      <div className="rounded-3xl border border-gray-800 bg-gray-950 p-6">
        <div className="text-lg font-semibold">Skapa nytt avtal</div>
        <form action={createContract} className="mt-4 grid gap-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className="text-xs text-gray-400">Namn</label>
            <input
              name="name"
              required
              className="mt-2 w-full h-11 rounded-xl border border-gray-800 bg-black/40 px-3 text-sm"
              placeholder="Gridex Spot – Rörligt"
            />
          </div>

          <div>
            <label className="text-xs text-gray-400">Slug</label>
            <input
              name="slug"
              required
              className="mt-2 w-full h-11 rounded-xl border border-gray-800 bg-black/40 px-3 text-sm"
              placeholder="gridex-spot-rorligt"
            />
          </div>

          <div>
            <label className="text-xs text-gray-400">Typ</label>
            <select
              name="contract_type"
              defaultValue="spot_hourly"
              className="mt-2 w-full h-11 rounded-xl border border-gray-800 bg-black/40 px-3 text-sm"
            >
              <option value="spot_hourly">spot_hourly</option>
              <option value="portfolio_managed">portfolio_managed</option>
              <option value="fixed">fixed</option>
            </select>
          </div>

          <div className="md:col-span-4 flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input type="checkbox" name="is_active" defaultChecked value="true" />
              Aktiv produkt
            </label>

            <button className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90">
              Skapa avtal
            </button>
          </div>
        </form>

        <div className="mt-4 text-xs text-gray-500">
          När avtalet skapas får det automatiskt en <span className="text-gray-200">Draft</span>-version i prishanteringen.
          Du behöver fylla priser per område och publicera för att avtalet ska gå LIVE.
        </div>
      </div>

      {/* List */}
      <div className="rounded-3xl border border-gray-800 bg-gray-950 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-gray-400 border-b border-gray-800">
              <tr>
                <th className="p-4">Namn</th>
                <th className="p-4">Slug</th>
                <th className="p-4">Typ</th>
                <th className="p-4">Produkt</th>
                <th className="p-4">Publiceringsstatus</th>
                <th className="p-4">Skapad</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => {
                const published = publishedByContract.get(c.id) ?? null
                const state = classifyPublishState(nowIso, published)

                return (
                  <tr key={c.id} className="border-t border-gray-800">
                    <td className="p-4 text-gray-200">{c.name}</td>
                    <td className="p-4 font-mono text-xs text-gray-400">{c.slug}</td>
                    <td className="p-4 text-gray-300">{c.contract_type}</td>

                    <td className="p-4">
                      <span className={c.is_active ? 'text-emerald-300' : 'text-rose-300'}>
                        {c.is_active ? 'Aktiv' : 'Inaktiv'}
                      </span>
                    </td>

                    <td className="p-4">
                      {state === 'DRAFT' && (
                        <div className="text-amber-200">
                          Draft saknar publicering
                        </div>
                      )}
                      {state === 'LIVE' && (
                        <div className="text-emerald-300">
                          LIVE publicerad
                          <div className="text-xs text-gray-500 mt-1">
                            Gäller fr.o.m. {published ? fmtDate(published.valid_from) : '—'}
                          </div>
                        </div>
                      )}
                      {state === 'SCHEDULED' && (
                        <div className="text-cyan-200">
                          Schemalagd publicering
                          <div className="text-xs text-gray-500 mt-1">
                            Blir LIVE: {published ? fmtDate(published.valid_from) : '—'}
                          </div>
                        </div>
                      )}
                    </td>

                    <td className="p-4 text-gray-500">
                      {new Date(c.created_at).toLocaleDateString('sv-SE')}
                    </td>

                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <form action={setContractActive}>
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="is_active" value={c.is_active ? 'false' : 'true'} />
                          <button className="rounded-xl border border-gray-800 bg-black/40 px-3 py-2 text-xs text-gray-200 hover:border-cyan-500/40">
                            {c.is_active ? 'Inaktivera' : 'Aktivera'}
                          </button>
                        </form>

                        <Link
                          href={`/admin/pricing/${c.slug}`}
                          className="rounded-xl bg-cyan-500 px-3 py-2 text-xs font-bold text-black"
                        >
                          Priser & publicering
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}

              {contracts.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-gray-500">
                    Inga avtal hittades.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}