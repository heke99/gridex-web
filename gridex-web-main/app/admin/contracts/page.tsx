import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { requireAdminPageAccess } from '@/lib/admin/guards'
import {
  createContract,
  setContractActive,
  updateContractMetadata,
} from './actions'

export const dynamic = 'force-dynamic'

type ContractType = 'spot_hourly' | 'portfolio_managed' | 'fixed'

type ContractRow = {
  id: string
  name: string
  slug: string
  contract_type: ContractType
  is_active: boolean
  created_at: string
  short_description?: string | null
  badge_text?: string | null
  sort_order?: number | null
  is_featured?: boolean | null
}

type VersionRow = {
  id: string
  contract_id: string
  valid_from: string
  is_published: boolean | null
  status?: string | null
  version_number?: number | null
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL'
    )
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  })
}

function fmtDate(value: string) {
  try {
    return new Date(value).toLocaleString('sv-SE', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return value
  }
}

type PublishState = 'DRAFT' | 'LIVE' | 'SCHEDULED'

function classifyPublishState(
  nowIso: string,
  published: VersionRow | null
): PublishState {
  if (!published) return 'DRAFT'
  if (published.valid_from > nowIso) return 'SCHEDULED'
  return 'LIVE'
}

function contractTypeLabel(type: ContractType) {
  switch (type) {
    case 'spot_hourly':
      return 'Spot / tim'
    case 'portfolio_managed':
      return 'Portfölj'
    case 'fixed':
      return 'Fastpris'
    default:
      return type
  }
}

export default async function AdminContractsPage() {
  await requireAdminPageAccess({
    anyOf: ['contracts.read', 'contracts.write', 'admin.access'],
  })

  const service = getServiceClient()
  const nowIso = new Date().toISOString()

  const baseQuery = service
    .from('contract_products')
    .select(
      'id,name,slug,contract_type,is_active,created_at,short_description,badge_text,sort_order,is_featured'
    )

  const resWithSort = await baseQuery
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .returns<ContractRow[]>()

  let contracts: ContractRow[] = []

  if (!resWithSort.error) {
    contracts = resWithSort.data ?? []
  } else {
    const fallback = await service
      .from('contract_products')
      .select(
        'id,name,slug,contract_type,is_active,created_at,short_description,badge_text,is_featured'
      )
      .order('created_at', { ascending: false })
      .returns<ContractRow[]>()

    if (fallback.error) throw new Error(fallback.error.message)
    contracts = fallback.data ?? []
  }

  const ids = contracts.map((contract) => contract.id)
  const safeIds = ids.length
    ? ids
    : ['00000000-0000-0000-0000-000000000000']

  const publishedByContract = new Map<string, VersionRow | null>()

  const qStatus = await service
    .from('contract_pricing_versions')
    .select('id,contract_id,valid_from,status,version_number')
    .in('contract_id', safeIds)
    .eq('status', 'published')
    .order('valid_from', { ascending: false })

  if (!qStatus.error && Array.isArray(qStatus.data) && qStatus.data.length > 0) {
    for (const version of qStatus.data as VersionRow[]) {
      if (!publishedByContract.has(version.contract_id)) {
        publishedByContract.set(version.contract_id, version)
      }
    }
  } else {
    const qIsPub = await service
      .from('contract_pricing_versions')
      .select('id,contract_id,valid_from,is_published,version_number')
      .in('contract_id', safeIds)
      .eq('is_published', true)
      .order('valid_from', { ascending: false })

    if (qIsPub.error) throw new Error(qIsPub.error.message)

    for (const version of (qIsPub.data ?? []) as VersionRow[]) {
      if (!publishedByContract.has(version.contract_id)) {
        publishedByContract.set(version.contract_id, version)
      }
    }
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Elavtal</h1>
          <p className="mt-2 text-gray-400">
            Skapa, namnge och sortera avtalsprodukter för spot, portfölj och
            fastpris. Publicering sker via prisversioner.
          </p>
        </div>

        <Link
          href="/admin/pricing"
          className="inline-flex h-11 items-center justify-center rounded-xl bg-cyan-500 px-4 text-sm font-bold text-black"
        >
          Till prishantering
        </Link>
      </div>

      <div className="rounded-3xl border border-gray-800 bg-gray-950 p-6">
        <div className="text-lg font-semibold">Skapa nytt avtal</div>

        <form action={createContract} className="mt-4 grid gap-4 md:grid-cols-6">
          <div className="md:col-span-2">
            <label className="text-xs text-gray-400">Namn</label>
            <input
              name="name"
              required
              className="mt-2 h-11 w-full rounded-xl border border-gray-800 bg-black/40 px-3 text-sm"
              placeholder="Gridex Spot – Rörligt"
            />
          </div>

          <div>
            <label className="text-xs text-gray-400">Slug</label>
            <input
              name="slug"
              required
              className="mt-2 h-11 w-full rounded-xl border border-gray-800 bg-black/40 px-3 text-sm"
              placeholder="gridex-spot-rorligt"
            />
          </div>

          <div>
            <label className="text-xs text-gray-400">Typ</label>
            <select
              name="contract_type"
              defaultValue="spot_hourly"
              className="mt-2 h-11 w-full rounded-xl border border-gray-800 bg-black/40 px-3 text-sm"
            >
              <option value="spot_hourly">spot_hourly</option>
              <option value="portfolio_managed">portfolio_managed</option>
              <option value="fixed">fixed</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-400">Badge</label>
            <input
              name="badge_text"
              className="mt-2 h-11 w-full rounded-xl border border-gray-800 bg-black/40 px-3 text-sm"
              placeholder="Populär"
            />
          </div>

          <div>
            <label className="text-xs text-gray-400">Sortering</label>
            <input
              name="sort_order"
              type="number"
              className="mt-2 h-11 w-full rounded-xl border border-gray-800 bg-black/40 px-3 text-sm"
              placeholder="10"
            />
          </div>

          <div className="md:col-span-4">
            <label className="text-xs text-gray-400">Kort beskrivning</label>
            <input
              name="short_description"
              className="mt-2 h-11 w-full rounded-xl border border-gray-800 bg-black/40 px-3 text-sm"
              placeholder="Kort text som visas på avtalssidan och i urvalet."
            />
          </div>

          <div className="md:col-span-2 flex flex-col justify-end gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input type="checkbox" name="is_active" defaultChecked value="true" />
              Aktiv produkt
            </label>

            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input type="checkbox" name="is_featured" value="true" />
              Visa som featured
            </label>
          </div>

          <div className="flex justify-end md:col-span-6">
            <button className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90">
              Skapa avtal
            </button>
          </div>
        </form>

        <div className="mt-4 text-xs text-gray-500">
          När avtalet skapas får det automatiskt en <span className="text-gray-200">Draft</span>-version i
          prishanteringen. Du behöver fylla priser per område och publicera för
          att avtalet ska gå LIVE.
        </div>
      </div>

      <div className="space-y-4">
        {contracts.map((contract) => {
          const published = publishedByContract.get(contract.id) ?? null
          const state = classifyPublishState(nowIso, published)

          return (
            <div
              key={contract.id}
              className="rounded-3xl border border-gray-800 bg-gray-950 p-6"
            >
              <div className="flex flex-col gap-4 border-b border-gray-800 pb-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold text-white">
                      {contract.name}
                    </h2>

                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-gray-300">
                      {contractTypeLabel(contract.contract_type)}
                    </span>

                    {contract.badge_text ? (
                      <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-[11px] text-cyan-200">
                        {contract.badge_text}
                      </span>
                    ) : null}

                    {contract.is_featured ? (
                      <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200">
                        Featured
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-2 font-mono text-xs text-gray-500">
                    {contract.slug}
                  </div>

                  {contract.short_description ? (
                    <p className="mt-3 max-w-3xl text-sm text-gray-400">
                      {contract.short_description}
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">Produktstatus:</span>{' '}
                    <span
                      className={
                        contract.is_active ? 'text-emerald-300' : 'text-rose-300'
                      }
                    >
                      {contract.is_active ? 'Aktiv' : 'Inaktiv'}
                    </span>
                  </div>

                  <div>
                    <span className="text-gray-500">Publicering:</span>{' '}
                    {state === 'DRAFT' && (
                      <span className="text-amber-200">Draft saknar publicering</span>
                    )}
                    {state === 'LIVE' && (
                      <span className="text-emerald-300">LIVE publicerad</span>
                    )}
                    {state === 'SCHEDULED' && (
                      <span className="text-cyan-200">Schemalagd publicering</span>
                    )}
                  </div>

                  <div className="text-xs text-gray-500">
                    Skapad: {fmtDate(contract.created_at)}
                  </div>

                  <div className="text-xs text-gray-500">
                    Sortering: {contract.sort_order ?? '—'}
                  </div>

                  {published ? (
                    <div className="text-xs text-gray-500">
                      Version {published.version_number ?? '—'} • Gäller fr.o.m. {fmtDate(published.valid_from)}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 grid gap-6 xl:grid-cols-[1.5fr_0.5fr]">
                <form action={updateContractMetadata} className="grid gap-4 md:grid-cols-6">
                  <input type="hidden" name="id" value={contract.id} />

                  <div className="md:col-span-2">
                    <label className="text-xs text-gray-400">Namn</label>
                    <input
                      name="name"
                      defaultValue={contract.name}
                      required
                      className="mt-2 h-11 w-full rounded-xl border border-gray-800 bg-black/40 px-3 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-400">Slug</label>
                    <input
                      name="slug"
                      defaultValue={contract.slug}
                      required
                      className="mt-2 h-11 w-full rounded-xl border border-gray-800 bg-black/40 px-3 text-sm font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-400">Badge</label>
                    <input
                      name="badge_text"
                      defaultValue={contract.badge_text ?? ''}
                      className="mt-2 h-11 w-full rounded-xl border border-gray-800 bg-black/40 px-3 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-400">Sortering</label>
                    <input
                      name="sort_order"
                      type="number"
                      defaultValue={contract.sort_order ?? ''}
                      className="mt-2 h-11 w-full rounded-xl border border-gray-800 bg-black/40 px-3 text-sm"
                    />
                  </div>

                  <div className="md:col-span-6">
                    <label className="text-xs text-gray-400">Kort beskrivning</label>
                    <input
                      name="short_description"
                      defaultValue={contract.short_description ?? ''}
                      className="mt-2 h-11 w-full rounded-xl border border-gray-800 bg-black/40 px-3 text-sm"
                    />
                  </div>

                  <div className="md:col-span-6 flex flex-wrap items-center justify-between gap-4">
                    <label className="flex items-center gap-2 text-sm text-gray-300">
                      <input
                        type="checkbox"
                        name="is_featured"
                        value="true"
                        defaultChecked={Boolean(contract.is_featured)}
                      />
                      Visa som featured på publika avtalssidan
                    </label>

                    <div className="flex flex-wrap gap-3">
                      <Link
                        href={`/admin/pricing/${contract.slug}`}
                        className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 px-4 text-sm font-medium text-gray-200 hover:border-cyan-500/40 hover:bg-white/5"
                      >
                        Prissättning
                      </Link>

                      <button className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90">
                        Spara metadata
                      </button>
                    </div>
                  </div>
                </form>

                <div className="space-y-3 rounded-2xl border border-gray-800 bg-black/30 p-4">
                  <div className="text-sm font-semibold text-white">Produktstatus</div>

                  <form action={setContractActive}>
                    <input type="hidden" name="id" value={contract.id} />
                    <input
                      type="hidden"
                      name="is_active"
                      value={contract.is_active ? 'false' : 'true'}
                    />
                    <button
                      className={
                        contract.is_active
                          ? 'w-full rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-200 hover:bg-rose-500/15'
                          : 'w-full rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/15'
                      }
                    >
                      {contract.is_active ? 'Gör inaktiv' : 'Aktivera produkt'}
                    </button>
                  </form>

                  <p className="text-xs leading-relaxed text-gray-500">
                    Endast aktiva produkter kan bli synliga i publika flöden.
                    LIVE-visning styrs fortfarande av publicerad prisversion med
                    giltigt datum.
                  </p>
                </div>
              </div>
            </div>
          )
        })}

        {contracts.length === 0 && (
          <div className="rounded-3xl border border-gray-800 bg-gray-950 p-6 text-sm text-gray-400">
            Inga avtalsprodukter hittades ännu. Skapa första avtalet ovan.
          </div>
        )}
      </div>
    </div>
  )
}