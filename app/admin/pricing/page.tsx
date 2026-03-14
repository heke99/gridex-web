// app/admin/pricing/page.tsx
import Link from 'next/link'
import { requireAdminPageAccess } from '@/lib/admin/guards'

export const dynamic = 'force-dynamic'

type Contract = {
  id: string
  name: string
  slug: string
  contract_type: 'spot_hourly' | 'portfolio_managed' | 'fixed'
  is_active: boolean
  short_description?: string | null
  badge_text?: string | null
  sort_order?: number | null
  is_featured?: boolean | null
}

type Version = {
  id: string
  contract_id: string
  version_number: number
  valid_from: string
  is_published: boolean
  status?: string | null
}

type Audit = {
  contract_id: string
  version_id: string
  performed_at: string
}

function contractTypeLabel(type: Contract['contract_type']) {
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

function classifyVersion(
  version: Version,
  nowIso: string
): 'DRAFT' | 'LIVE' | 'SCHEDULED' {
  const isPublished = version.is_published === true || version.status === 'published'

  if (!isPublished) return 'DRAFT'
  if (version.valid_from > nowIso) return 'SCHEDULED'
  return 'LIVE'
}

export default async function AdminPricingIndexPage() {
  const ctx = await requireAdminPageAccess({
    anyOf: [
      'pricing.read',
      'pricing.write',
      'pricing.publish',
      'pricing.publish_prod',
      'admin.access',
    ],
  })

  const supabase = ctx.supabase

  const { data: contracts, error: cErr } = await supabase
    .from('contract_products')
    .select(
      'id,name,slug,contract_type,is_active,short_description,badge_text,sort_order,is_featured'
    )
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true })
    .returns<Contract[]>()

  if (cErr) throw new Error(cErr.message)

  const contractIds = (contracts ?? []).map((c) => c.id)
  const safeIds =
    contractIds.length > 0
      ? contractIds
      : ['00000000-0000-0000-0000-000000000000']

  const { data: versions, error: vErr } = await supabase
    .from('contract_pricing_versions')
    .select('id,contract_id,version_number,valid_from,is_published,status')
    .in('contract_id', safeIds)
    .order('version_number', { ascending: false })
    .returns<Version[]>()

  if (vErr) throw new Error(vErr.message)

  const { data: audits, error: aErr } = await supabase
    .from('pricing_version_audit')
    .select('contract_id,version_id,performed_at')
    .in('contract_id', safeIds)
    .order('performed_at', { ascending: false })
    .returns<Audit[]>()

  const nowIso = new Date().toISOString()

  const liveByContract = new Map<string, Version | undefined>()
  const scheduledByContract = new Map<string, Version | undefined>()
  const draftCountByContract = new Map<string, number>()

  for (const v of versions ?? []) {
    const state = classifyVersion(v, nowIso)

    if (state === 'DRAFT') {
      draftCountByContract.set(
        v.contract_id,
        (draftCountByContract.get(v.contract_id) ?? 0) + 1
      )
      continue
    }

    if (state === 'LIVE') {
      const curr = liveByContract.get(v.contract_id)
      if (!curr || curr.valid_from < v.valid_from) {
        liveByContract.set(v.contract_id, v)
      }
      continue
    }

    if (state === 'SCHEDULED') {
      const curr = scheduledByContract.get(v.contract_id)
      if (!curr || curr.valid_from > v.valid_from) {
        scheduledByContract.set(v.contract_id, v)
      }
    }
  }

  const lastAuditByContract = new Map<string, Audit | undefined>()

  if (!aErr) {
    for (const a of audits ?? []) {
      if (!lastAuditByContract.has(a.contract_id)) {
        lastAuditByContract.set(a.contract_id, a)
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Prishantering</h1>
          <p className="mt-2 text-sm text-gray-400">
            Översikt över avtalsprodukter, draft-versioner, LIVE-versioner och
            kommande schemalagda publiceringar.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/contracts"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-gray-200 hover:border-cyan-500/40"
          >
            Till avtal
          </Link>
          <Link
            href="/avtal"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-cyan-500 px-4 text-sm font-bold text-black"
          >
            Visa publikt
          </Link>
        </div>
      </div>

      <div className="grid gap-4">
        {(contracts ?? []).map((c) => {
          const live = liveByContract.get(c.id)
          const scheduled = scheduledByContract.get(c.id)
          const lastAudit = lastAuditByContract.get(c.id)
          const draftCount = draftCountByContract.get(c.id) ?? 0

          return (
            <div
              key={c.id}
              className="rounded-xl border border-gray-800 bg-gray-950 p-5"
            >
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-xl font-semibold">{c.name}</div>

                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-gray-300">
                      {contractTypeLabel(c.contract_type)}
                    </span>

                    {c.badge_text ? (
                      <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-[11px] text-cyan-200">
                        {c.badge_text}
                      </span>
                    ) : null}

                    {c.is_featured ? (
                      <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200">
                        Featured
                      </span>
                    ) : null}

                    <span
                      className={
                        c.is_active
                          ? 'rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-200'
                          : 'rounded-full border border-rose-500/20 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-200'
                      }
                    >
                      {c.is_active ? 'Aktiv produkt' : 'Inaktiv produkt'}
                    </span>
                  </div>

                  <div className="mt-2 font-mono text-xs text-gray-500">
                    slug: {c.slug}
                    {typeof c.sort_order === 'number'
                      ? ` • sort: ${c.sort_order}`
                      : ''}
                  </div>

                  {c.short_description ? (
                    <p className="mt-3 max-w-3xl text-sm text-gray-400">
                      {c.short_description}
                    </p>
                  ) : null}

                  <div className="mt-4 grid gap-2 text-sm text-gray-300">
                    <div>
                      Live prisversion (Hero/Kalkylator/API):{' '}
                      <span className="text-gray-200">
                        {live
                          ? `v${live.version_number} (från ${new Date(
                              live.valid_from
                            ).toLocaleString('sv-SE')})`
                          : 'Ingen'}
                      </span>
                    </div>

                    <div>
                      Nästa schemalagda version:{' '}
                      <span className="text-gray-200">
                        {scheduled
                          ? `v${scheduled.version_number} (från ${new Date(
                              scheduled.valid_from
                            ).toLocaleString('sv-SE')})`
                          : 'Ingen'}
                      </span>
                    </div>

                    <div>
                      Draft-versioner:{' '}
                      <span className="text-gray-200">{draftCount}</span>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      {live ? (
                        <Link
                          href={`/admin/pricing/${c.slug}?previewVersionId=${live.id}`}
                          className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200 hover:bg-emerald-500/15"
                        >
                          Öppna LIVE
                        </Link>
                      ) : null}

                      {scheduled ? (
                        <Link
                          href={`/admin/pricing/${c.slug}?previewVersionId=${scheduled.id}`}
                          className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200 hover:bg-cyan-500/15"
                        >
                          Öppna schemalagd
                        </Link>
                      ) : null}
                    </div>

                    {lastAudit && (
                      <div className="text-xs text-gray-500">
                        Senast ändrad (audit):{' '}
                        {new Date(lastAudit.performed_at).toLocaleString('sv-SE')}
                      </div>
                    )}

                    {aErr && (
                      <div className="text-xs text-amber-200">
                        Audit kunde inte läsas in just nu.
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href="/admin/contracts"
                    className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-200 hover:border-cyan-500/40"
                  >
                    Metadata
                  </Link>

                  <Link
                    href={`/admin/pricing/${c.slug}`}
                    className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-bold text-black"
                  >
                    Hantera
                  </Link>
                </div>
              </div>
            </div>
          )
        })}

        {(contracts ?? []).length === 0 && (
          <div className="rounded-xl border border-gray-800 bg-gray-950 p-6 text-gray-400">
            Inga avtalsprodukter hittades. Skapa avtal först under <b>/admin/contracts</b>.
          </div>
        )}
      </div>
    </div>
  )
}