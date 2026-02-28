// app/admin/pricing/[slug]/page.tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requirePermissionServer } from '@/lib/auth/requirePermissionServer'
import { requireAdminRole } from '@/lib/auth/admin'
import { computeCustomerSpec, type PriceArea } from '@/lib/gridex/previewEngine'
import {
  createVersionAction,
  savePricingAction,
  publishVersionAction,
  cloneVersionAction,
} from './actions'

const AREAS: PriceArea[] = ['SE1', 'SE2', 'SE3', 'SE4']

type Contract = {
  id: string
  name: string
  slug: string
  contract_type: 'spot_hourly' | 'portfolio_managed' | 'fixed'
}

type Version = {
  id: string
  contract_id: string
  version_number: number
  valid_from: string
  is_published: boolean | null
  status?: string | null
}

type AreaPricing = {
  pricing_version_id: string
  price_area: PriceArea
  price_per_kwh_ore: number | null
  markup_ore: number | null
  monthly_fee_sek: number | null
}

function fmtWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString('sv-SE', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

type PublishState = 'DRAFT' | 'LIVE' | 'SCHEDULED'
function classify(nowIso: string, v: Version): PublishState {
  const isPublished = v.is_published === true || v.status === 'published'
  if (!isPublished) return 'DRAFT'
  if (v.valid_from > nowIso) return 'SCHEDULED'
  return 'LIVE'
}

export const dynamic = 'force-dynamic'

export default async function AdminPricingContractPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams?: Promise<{ previewVersionId?: string; kwh?: string; area?: PriceArea }>
}) {
  const { slug } = await params
  const sp = searchParams ? await searchParams : undefined

  const supabase = await createSupabaseServerClient()
  const nowIso = new Date().toISOString()

  // Gate: pricing.write OR pricing.publish
  await requirePermissionServer('pricing.write').catch(async () => {
    await requirePermissionServer('pricing.publish')
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Determine UI capabilities
  const legacy = await requireAdminRole(supabase).catch(() => null)
  const isLegacyAdmin = legacy?.role === 'admin'

  let canWrite = isLegacyAdmin
  if (!canWrite) {
    try {
      const r = await supabase.rpc('gridex_has_permission', {
        p_user_id: user.id,
        p_permission: 'pricing.write',
      })
      canWrite = r.data === true
    } catch {
      canWrite = false
    }
  }

  let canPublish = isLegacyAdmin
  if (!canPublish) {
    try {
      const r = await supabase.rpc('gridex_has_permission', {
        p_user_id: user.id,
        p_permission: 'pricing.publish',
      })
      canPublish = r.data === true
    } catch {
      canPublish = false
    }
  }

  const { data: contract } = await supabase
    .from('contract_products')
    .select('id,name,slug,contract_type')
    .eq('slug', slug)
    .single()

  if (!contract) redirect('/admin/pricing')
  const typedContract = contract as Contract

  const { data: versionsRaw } = await supabase
    .from('contract_pricing_versions')
    .select('id,contract_id,version_number,valid_from,is_published,status')
    .eq('contract_id', typedContract.id)
    .order('version_number', { ascending: false })

  const versions = (versionsRaw ?? []) as Version[]

  const live = versions
    .filter((v) => classify(nowIso, v) === 'LIVE')
    .sort((a, b) => (a.valid_from < b.valid_from ? 1 : -1))[0]

  const scheduled = versions
    .filter((v) => classify(nowIso, v) === 'SCHEDULED')
    .sort((a, b) => (a.valid_from > b.valid_from ? 1 : -1))[0]

  const activePublished = live ?? scheduled ?? null

  const previewVersionId = sp?.previewVersionId ?? activePublished?.id ?? versions[0]?.id
  const previewKwh = Number(sp?.kwh ?? 2000)
  const previewArea = (sp?.area ?? 'SE3') as PriceArea

  const previewSpec = await computeCustomerSpec({
    supabase,
    contract: {
      id: typedContract.id,
      slug: typedContract.slug,
      name: typedContract.name,
      contract_type: typedContract.contract_type,
      is_active: true,
    },
    priceArea: previewArea,
    kwh: previewKwh,
    selection: previewVersionId ? { mode: 'by_id', id: previewVersionId } : undefined,
  }).catch(() => null)

  const previewLines = previewSpec?.lines ?? []

  const { data: pricingRows } = previewVersionId
    ? await supabase
        .from('contract_area_pricing')
        .select('pricing_version_id,price_area,price_per_kwh_ore,markup_ore,monthly_fee_sek')
        .eq('pricing_version_id', previewVersionId)
        .returns<AreaPricing[]>()
    : { data: null }

  const pricingMap = new Map<PriceArea, AreaPricing>()
  ;(pricingRows ?? []).forEach((r) => pricingMap.set(r.price_area, r))

  type AreaNumericKey = 'price_per_kwh_ore' | 'markup_ore' | 'monthly_fee_sek'
  function defaultVal(area: PriceArea, key: AreaNumericKey) {
    const row = pricingMap.get(area)
    if (!row) return '0'
    const value = row[key]
    return typeof value === 'number' && Number.isFinite(value) ? String(value) : '0'
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="text-xs text-gray-500">Prishantering</div>
          <h1 className="text-3xl font-bold">{typedContract.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-gray-200">
              {typedContract.contract_type}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-gray-300">
              slug: <span className="font-mono">{typedContract.slug}</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/contracts"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-200 hover:border-cyan-500/40"
          >
            Till avtal
          </Link>
          <Link
            href="/avtal"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-200 hover:border-cyan-500/40"
          >
            Visa publikt
          </Link>
        </div>
      </div>

      {/* Publiceringsstatus */}
      <div className="rounded-3xl border border-gray-800 bg-gray-950 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-lg font-semibold">Publiceringsstatus</div>
            <p className="text-gray-400 mt-1 text-sm">
              Endast <span className="text-gray-200">publicerade</span> versioner med{' '}
              <span className="text-gray-200">valid_from ≤ nu</span> är LIVE. Schemalagda versioner är publicerade men blir
              LIVE först på datumet.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {!activePublished && <span className="text-amber-200 text-sm">Draft saknar publicering</span>}
            {activePublished && classify(nowIso, activePublished) === 'LIVE' && (
              <span className="text-emerald-300 text-sm">
                LIVE publicerad (fr.o.m. {fmtWhen(activePublished.valid_from)})
              </span>
            )}
            {activePublished && classify(nowIso, activePublished) === 'SCHEDULED' && (
              <span className="text-cyan-200 text-sm">
                Schemalagd publicering (blir LIVE: {fmtWhen(activePublished.valid_from)})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Step 1: Create version */}
      <div className="rounded-3xl border border-gray-800 bg-gray-950 p-6">
        <div className="text-lg font-semibold">1) Skapa version</div>
        <p className="text-gray-400 mt-1 text-sm">
          Skapa en ny prisversion (Draft). Välj datum när den ska börja gälla. Vill du schemalägga? Sätt ett framtida datum
          och publicera.
        </p>

        <form action={createVersionAction} className="mt-4 flex flex-col gap-3 md:flex-row md:items-end">
          <input type="hidden" name="contract_id" value={typedContract.id} />
          <input type="hidden" name="slug" value={slug} />

          <div className="flex-1">
            <label className="text-xs text-gray-400">valid_from (YYYY-MM-DD)</label>
            <input
              name="valid_from"
              defaultValue={new Date().toISOString().slice(0, 10)}
              className="mt-2 w-full h-11 rounded-xl border border-gray-800 bg-black/40 px-3 text-sm"
              placeholder="2026-02-27"
              disabled={!canWrite}
            />
          </div>

          <button
            disabled={!canWrite}
            className="h-11 rounded-xl bg-white px-4 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-60"
          >
            Skapa version
          </button>
        </form>
      </div>

      {/* Step 2: Versions list */}
      <div className="rounded-3xl border border-gray-800 bg-gray-950 overflow-hidden">
        <div className="p-6 border-b border-gray-800">
          <div className="text-lg font-semibold">2) Versioner</div>
          <p className="text-gray-400 mt-1 text-sm">
            Välj version för att redigera priser och göra Preview. Publicera när allt är klart.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-gray-400 border-b border-gray-800">
              <tr>
                <th className="p-4">Version</th>
                <th className="p-4">valid_from</th>
                <th className="p-4">Status</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => {
                const state = classify(nowIso, v)
                const isSelected = v.id === previewVersionId
                return (
                  <tr key={v.id} className="border-t border-gray-800">
                    <td className="p-4 text-gray-200">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">v{v.version_number}</span>
                        {isSelected && (
                          <span className="text-[11px] rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-cyan-200">
                            Preview
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 font-mono">{v.id}</div>
                    </td>
                    <td className="p-4 text-gray-300">{fmtWhen(v.valid_from)}</td>
                    <td className="p-4">
                      {state === 'DRAFT' && (
                        <span className="text-[11px] rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-amber-200">
                          Draft
                        </span>
                      )}
                      {state === 'LIVE' && (
                        <span className="text-[11px] rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-emerald-200">
                          LIVE
                        </span>
                      )}
                      {state === 'SCHEDULED' && (
                        <span className="text-[11px] rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-cyan-200">
                          Schemalagd
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/admin/pricing/${typedContract.slug}?previewVersionId=${v.id}&kwh=${previewKwh}&area=${previewArea}`}
                          className="rounded-xl border border-gray-800 bg-black/40 px-3 py-2 text-xs text-gray-200 hover:border-cyan-500/40"
                        >
                          Välj för preview
                        </Link>

                        <form action={cloneVersionAction} className="flex items-center gap-2">
                          <input type="hidden" name="contract_id" value={typedContract.id} />
                          <input type="hidden" name="source_version_id" value={v.id} />
                          <input type="hidden" name="slug" value={slug} />
                          <input
                            name="reason"
                            placeholder="Anledning (clone)"
                            className="h-9 w-44 rounded-lg border border-gray-800 bg-black/40 px-3 text-xs text-gray-200"
                            required
                            disabled={!canWrite}
                          />
                          <button
                            disabled={!canWrite}
                            className="h-9 rounded-lg border border-gray-800 bg-black/40 px-3 text-xs text-gray-200 hover:border-cyan-500/40 disabled:opacity-60"
                          >
                            Klona
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                )
              })}

              {versions.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-gray-500">
                    Inga versioner hittades. Skapa en version ovan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Step 3: Edit prices */}
      <div className="rounded-3xl border border-gray-800 bg-gray-950 p-6">
        <div className="text-lg font-semibold">3) Fyll priser per område</div>
        <p className="text-gray-400 mt-1 text-sm">
          För <span className="text-gray-200">spot_hourly</span> använder vi{' '}
          <span className="text-gray-200">markup_ore + monthly_fee</span>. För{' '}
          <span className="text-gray-200">fixed/portfolio_managed</span> använder vi{' '}
          <span className="text-gray-200">price_per_kwh_ore + monthly_fee</span>.
        </p>

        {!previewVersionId ? (
          <div className="mt-4 text-sm text-gray-500">Välj en version för att redigera priser.</div>
        ) : (
          <form action={savePricingAction} className="mt-5 space-y-4">
            <input type="hidden" name="pricing_version_id" value={previewVersionId} />
            <input type="hidden" name="contract_type" value={typedContract.contract_type} />
            <input type="hidden" name="slug" value={slug} />

            <div className="grid gap-4 md:grid-cols-4">
              {AREAS.map((area) => (
                <div key={area} className="rounded-2xl border border-gray-800 bg-black/30 p-4">
                  <div className="text-sm font-semibold text-gray-200">{area}</div>

                  {typedContract.contract_type === 'spot_hourly' ? (
                    <div className="mt-3 space-y-2">
                      <label className="text-xs text-gray-400">Markup (öre/kWh)</label>
                      <input
                        name={`${area}_markup_ore`}
                        defaultValue={defaultVal(area, 'markup_ore')}
                        className="w-full h-10 rounded-xl border border-gray-800 bg-black/40 px-3 text-sm"
                        disabled={!canWrite}
                      />
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2">
                      <label className="text-xs text-gray-400">Pris (öre/kWh)</label>
                      <input
                        name={`${area}_price_per_kwh_ore`}
                        defaultValue={defaultVal(area, 'price_per_kwh_ore')}
                        className="w-full h-10 rounded-xl border border-gray-800 bg-black/40 px-3 text-sm"
                        disabled={!canWrite}
                      />
                    </div>
                  )}

                  <div className="mt-3 space-y-2">
                    <label className="text-xs text-gray-400">Månadsavgift (SEK)</label>
                    <input
                      name={`${area}_monthly_fee_sek`}
                      defaultValue={defaultVal(area, 'monthly_fee_sek')}
                      className="w-full h-10 rounded-xl border border-gray-800 bg-black/40 px-3 text-sm"
                      disabled={!canWrite}
                    />
                  </div>
                </div>
              ))}
            </div>

            <button
              disabled={!canWrite}
              className="w-full h-11 rounded-xl bg-white text-black font-semibold hover:bg-white/90 disabled:opacity-60"
            >
              Spara priser
            </button>
          </form>
        )}
      </div>

      {/* Step 4: Preview */}
      <div className="rounded-3xl border border-gray-800 bg-gray-950 p-6">
        <div className="text-lg font-semibold">4) Preview</div>
        <p className="text-gray-400 mt-1 text-sm">
          Preview kör samma pricing-engine som <span className="text-gray-200">/api/price</span>. Du kan byta area och kWh
          för att verifiera totalsumma och specifikation.
        </p>

        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex-1">
            <label className="text-xs text-gray-400">kWh/mån</label>
            <input
              defaultValue={String(previewKwh)}
              className="mt-2 w-full h-11 rounded-xl border border-gray-800 bg-black/40 px-3 text-sm"
              readOnly
            />
          </div>

          <div className="flex-1">
            <label className="text-xs text-gray-400">Elområde</label>
            <input
              defaultValue={previewArea}
              className="mt-2 w-full h-11 rounded-xl border border-gray-800 bg-black/40 px-3 text-sm"
              readOnly
            />
          </div>

          <div className="flex-1">
            <label className="text-xs text-gray-400">Byt preview</label>
            <div className="mt-2 flex gap-2">
              {AREAS.map((a) => (
                <Link
                  key={a}
                  href={`/admin/pricing/${typedContract.slug}?previewVersionId=${previewVersionId ?? ''}&kwh=${previewKwh}&area=${a}`}
                  className="flex-1 text-center rounded-xl border border-gray-800 bg-black/40 px-3 py-2 text-xs text-gray-200 hover:border-cyan-500/40"
                >
                  {a}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {previewSpec ? (
          <div className="mt-5 rounded-2xl border border-gray-800 bg-black/30 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-gray-300">
                Total: <span className="text-white font-semibold">{previewSpec.totalMonthlyCostSek.toFixed(2)} SEK</span>
                <span className="text-gray-500"> / mån</span>
              </div>
              <div className="text-xs text-gray-500">
                Öre/kWh: {previewSpec.totalOrePerKwh.toFixed(2)} • inkl. moms:{' '}
                {previewSpec.totalMonthlyCostInclVatSek.toFixed(2)} SEK
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              {previewLines.map((l) => (
                <div key={l.key} className="flex items-center justify-between text-sm">
                  <div className="text-gray-300">{l.label}</div>
                  <div className="text-gray-200">
                    {typeof l.sekPerMonth === 'number'
                      ? `${l.sekPerMonth.toFixed(2)} SEK`
                      : typeof l.orePerKwh === 'number'
                      ? `${l.orePerKwh.toFixed(2)} öre/kWh`
                      : '—'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-4 text-sm text-gray-500">
            Preview kunde inte beräknas ännu (saknar data för vald version/område).
          </div>
        )}
      </div>

      {/* Step 5: Publish */}
      <div className="rounded-3xl border border-gray-800 bg-gray-950 p-6">
        <div className="text-lg font-semibold">5) Publicera</div>
        <p className="text-gray-400 mt-1 text-sm">
          Publicering kräver audit reason och gör enterprise-korrekt unpublish av alla andra versioner för samma avtal.
        </p>

        {!previewVersionId ? (
          <div className="mt-4 text-sm text-gray-500">Välj en version för att publicera.</div>
        ) : (
          <form action={publishVersionAction} className="mt-4 flex flex-col gap-3 md:flex-row md:items-end">
            <input type="hidden" name="contract_id" value={typedContract.id} />
            <input type="hidden" name="version_id" value={previewVersionId} />
            <input type="hidden" name="slug" value={slug} />

            <div className="flex-1">
              <label className="text-xs text-gray-400">Audit reason</label>
              <input
                name="reason"
                required
                placeholder="Ex: Justering av priser p.g.a. Q2-hedge, godkänd av CFO"
                className="mt-2 w-full h-11 rounded-xl border border-gray-800 bg-black/40 px-3 text-sm"
                disabled={!canPublish}
              />
            </div>

            <button
              disabled={!canPublish}
              className="h-11 rounded-xl bg-cyan-500 px-5 text-sm font-bold text-black hover:bg-cyan-400 disabled:opacity-60"
            >
              Publicera version
            </button>
          </form>
        )}

        {!canPublish && (
          <div className="mt-3 text-xs text-amber-200">
            Du saknar <span className="font-mono">pricing.publish</span>. Du kan fortfarande skapa/ändra (om du har{' '}
            <span className="font-mono">pricing.write</span>), men publicering är låst.
          </div>
        )}
      </div>
    </div>
  )
}