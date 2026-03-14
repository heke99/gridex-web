import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireAdminPageAccess } from '@/lib/admin/guards'
import { computeCustomerSpec, type PriceArea } from '@/lib/gridex/previewEngine'
import { unpublishPricingForContract } from '../actions'
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
  short_description?: string | null
  badge_text?: string | null
  is_featured?: boolean | null
  is_active?: boolean | null
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
  variable_fee_ore: number | null
  elcert_ore: number | null
  monthly_fee_sek: number | null
}

type PageSearchParams = {
  previewVersionId?: string
  kwh?: string
  area?: PriceArea
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

function classify(nowIso: string, version: Version): PublishState {
  const isPublished =
    version.is_published === true || version.status === 'published'
  if (!isPublished) return 'DRAFT'
  if (version.valid_from > nowIso) return 'SCHEDULED'
  return 'LIVE'
}

function parsePreviewKwh(value: string | undefined): number {
  const n = Number(value ?? 2000)
  if (!Number.isFinite(n)) return 2000
  return Math.min(200000, Math.max(1, n))
}

function parsePreviewArea(value: PriceArea | undefined): PriceArea {
  return AREAS.includes(value as PriceArea) ? (value as PriceArea) : 'SE3'
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

export const dynamic = 'force-dynamic'

export default async function AdminPricingContractPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams?: Promise<PageSearchParams>
}) {
  const { slug } = await params
  const sp = searchParams ? await searchParams : undefined

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
  const nowIso = new Date().toISOString()

  const isAdmin =
    ctx.isAdmin ||
    ctx.roles.includes('admin') ||
    ctx.permissions.includes('admin.access')

  const canWrite =
    isAdmin ||
    ctx.permissions.includes('pricing.write') ||
    ctx.permissions.includes('pricing.publish') ||
    ctx.permissions.includes('pricing.publish_prod')

  const canPublish =
    isAdmin ||
    ctx.permissions.includes('pricing.publish') ||
    ctx.permissions.includes('pricing.publish_prod')

  const { data: contract, error: contractError } = await supabase
    .from('contract_products')
    .select(
      'id,name,slug,contract_type,short_description,badge_text,is_featured,is_active'
    )
    .eq('slug', slug)
    .maybeSingle<Contract>()

  if (contractError) {
    throw new Error(contractError.message)
  }

  if (!contract) {
    redirect('/admin/pricing')
  }

  const typedContract = contract

  const { data: versionsRaw, error: versionsError } = await supabase
    .from('contract_pricing_versions')
    .select('id,contract_id,version_number,valid_from,is_published,status')
    .eq('contract_id', typedContract.id)
    .order('version_number', { ascending: false })
    .returns<Version[]>()

  if (versionsError) {
    throw new Error(versionsError.message)
  }

  const versions = versionsRaw ?? []

  const live = versions
    .filter((version) => classify(nowIso, version) === 'LIVE')
    .sort((a, b) => (a.valid_from < b.valid_from ? 1 : -1))[0]

  const scheduled = versions
    .filter((version) => classify(nowIso, version) === 'SCHEDULED')
    .sort((a, b) => (a.valid_from > b.valid_from ? 1 : -1))[0]

  const activePublished = live ?? scheduled ?? null

  const previewVersionId =
    sp?.previewVersionId ?? activePublished?.id ?? versions[0]?.id ?? ''

  const previewKwh = parsePreviewKwh(sp?.kwh)
  const previewArea = parsePreviewArea(sp?.area)

  const selectedVersion =
    versions.find((version) => version.id === previewVersionId) ?? null

  const previewSpec = previewVersionId
    ? await computeCustomerSpec({
        supabase,
        contract: {
          id: typedContract.id,
          slug: typedContract.slug,
          name: typedContract.name,
          contract_type: typedContract.contract_type,
          is_active: typedContract.is_active ?? true,
        },
        priceArea: previewArea,
        kwh: previewKwh,
        selection: { mode: 'by_id', id: previewVersionId },
      }).catch(() => null)
    : null

  const previewLines = previewSpec?.lines ?? []

  const pricingRowsResult = previewVersionId
    ? await supabase
        .from('contract_area_pricing')
        .select(
          'pricing_version_id,price_area,price_per_kwh_ore,markup_ore,variable_fee_ore,elcert_ore,monthly_fee_sek'
        )
        .eq('pricing_version_id', previewVersionId)
        .returns<AreaPricing[]>()
    : { data: null, error: null }

  if (pricingRowsResult.error) {
    throw new Error(pricingRowsResult.error.message)
  }

  const pricingMap = new Map<PriceArea, AreaPricing>()
  ;(pricingRowsResult.data ?? []).forEach((row) =>
    pricingMap.set(row.price_area, row)
  )

  type AreaNumericKey =
    | 'price_per_kwh_ore'
    | 'markup_ore'
    | 'variable_fee_ore'
    | 'elcert_ore'
    | 'monthly_fee_sek'

  function defaultVal(area: PriceArea, key: AreaNumericKey) {
    const row = pricingMap.get(area)
    if (!row) return '0'
    const value = row[key]
    return typeof value === 'number' && Number.isFinite(value)
      ? String(value)
      : '0'
  }

  const liveCount = versions.filter(
    (version) => classify(nowIso, version) === 'LIVE'
  ).length
  const scheduledCount = versions.filter(
    (version) => classify(nowIso, version) === 'SCHEDULED'
  ).length
  const draftCount = versions.filter(
    (version) => classify(nowIso, version) === 'DRAFT'
  ).length

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs text-gray-500">Prishantering</div>
          <h1 className="text-3xl font-bold">{typedContract.name}</h1>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-gray-200">
              {contractTypeLabel(typedContract.contract_type)}
            </span>

            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-gray-300">
              slug: <span className="font-mono">{typedContract.slug}</span>
            </span>

            {typedContract.badge_text ? (
              <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-cyan-200">
                {typedContract.badge_text}
              </span>
            ) : null}

            {typedContract.is_featured ? (
              <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-amber-200">
                Featured
              </span>
            ) : null}

            <span
              className={
                typedContract.is_active
                  ? 'rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-emerald-200'
                  : 'rounded-full border border-rose-500/20 bg-rose-500/10 px-2 py-1 text-rose-200'
              }
            >
              {typedContract.is_active ? 'Aktiv produkt' : 'Inaktiv produkt'}
            </span>
          </div>

          {typedContract.short_description ? (
            <p className="mt-3 max-w-3xl text-sm text-gray-400">
              {typedContract.short_description}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/contracts"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-200 hover:border-cyan-500/40"
          >
            Till avtal
          </Link>
          <Link
            href="/admin/pricing"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-200 hover:border-cyan-500/40"
          >
            Alla prisversioner
          </Link>
          <Link
            href="/avtal"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-200 hover:border-cyan-500/40"
          >
            Visa publikt
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-gray-800 bg-gray-950 p-5">
          <div className="text-sm font-semibold text-white">LIVE-versioner</div>
          <div className="mt-2 text-2xl font-bold text-emerald-300">
            {liveCount}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Versioner som är publicerade och giltiga nu.
          </p>
        </div>

        <div className="rounded-2xl border border-gray-800 bg-gray-950 p-5">
          <div className="text-sm font-semibold text-white">Schemalagda</div>
          <div className="mt-2 text-2xl font-bold text-cyan-300">
            {scheduledCount}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Publicerade versioner med framtida startdatum.
          </p>
        </div>

        <div className="rounded-2xl border border-gray-800 bg-gray-950 p-5">
          <div className="text-sm font-semibold text-white">Drafts</div>
          <div className="mt-2 text-2xl font-bold text-amber-300">
            {draftCount}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Ej publicerade versioner som kan redigeras.
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-gray-800 bg-gray-950 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-lg font-semibold">Publiceringsstatus</div>
            <p className="mt-1 text-sm text-gray-400">
              Endast publicerade versioner med valid_from ≤ nu är LIVE.
              Schemalagda versioner är publicerade men blir LIVE först på datumet.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {!activePublished && (
              <span className="text-sm text-amber-200">
                Draft saknar publicering
              </span>
            )}

            {activePublished && classify(nowIso, activePublished) === 'LIVE' && (
              <span className="text-sm text-emerald-300">
                LIVE publicerad (fr.o.m. {fmtWhen(activePublished.valid_from)})
              </span>
            )}

            {activePublished &&
              classify(nowIso, activePublished) === 'SCHEDULED' && (
                <span className="text-sm text-cyan-200">
                  Schemalagd publicering (blir LIVE:{' '}
                  {fmtWhen(activePublished.valid_from)})
                </span>
              )}
          </div>
        </div>

        {activePublished ? (
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href={`/admin/pricing/${typedContract.slug}?previewVersionId=${activePublished.id}&kwh=${previewKwh}&area=${previewArea}`}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-200 hover:border-cyan-500/40"
            >
              Välj aktiv publicerad version
            </Link>

            <form
              action={async () => {
                'use server'
                await unpublishPricingForContract(typedContract.id)
              }}
            >
              <button
                disabled={!canPublish}
                className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-200 hover:bg-rose-500/15 disabled:opacity-60"
              >
                Avpublicera alla publicerade versioner
              </button>
            </form>
          </div>
        ) : null}
      </div>

      <div className="rounded-3xl border border-gray-800 bg-gray-950 p-6">
        <div className="text-lg font-semibold">1) Skapa version</div>
        <p className="mt-1 text-sm text-gray-400">
          Skapa en ny prisversion (Draft). Välj datum när den ska börja gälla.
          Vill du schemalägga? Sätt ett framtida datum och publicera.
        </p>

        <form
          action={createVersionAction}
          className="mt-4 flex flex-col gap-3 md:flex-row md:items-end"
        >
          <input type="hidden" name="contract_id" value={typedContract.id} />
          <input type="hidden" name="slug" value={slug} />

          <div className="flex-1">
            <label className="text-xs text-gray-400">
              valid_from (YYYY-MM-DD)
            </label>
            <input
              name="valid_from"
              defaultValue={new Date().toISOString().slice(0, 10)}
              className="mt-2 h-11 w-full rounded-xl border border-gray-800 bg-black/40 px-3 text-sm"
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

      <div className="overflow-hidden rounded-3xl border border-gray-800 bg-gray-950">
        <div className="border-b border-gray-800 p-6">
          <div className="text-lg font-semibold">2) Versioner</div>
          <p className="mt-1 text-sm text-gray-400">
            Välj version för att redigera priser och göra preview. Publicera när
            allt är klart.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-800 text-xs text-gray-400">
              <tr>
                <th className="p-4">Version</th>
                <th className="p-4">valid_from</th>
                <th className="p-4">Status</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody>
              {versions.map((version) => {
                const state = classify(nowIso, version)
                const isSelected = version.id === previewVersionId

                return (
                  <tr key={version.id} className="border-t border-gray-800">
                    <td className="p-4 text-gray-200">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">
                          v{version.version_number}
                        </span>
                        {isSelected && (
                          <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[11px] text-cyan-200">
                            Preview
                          </span>
                        )}
                      </div>
                      <div className="mt-1 font-mono text-xs text-gray-500">
                        {version.id}
                      </div>
                    </td>

                    <td className="p-4 text-gray-300">
                      {fmtWhen(version.valid_from)}
                    </td>

                    <td className="p-4">
                      {state === 'DRAFT' && (
                        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200">
                          Draft
                        </span>
                      )}
                      {state === 'LIVE' && (
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-200">
                          LIVE
                        </span>
                      )}
                      {state === 'SCHEDULED' && (
                        <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[11px] text-cyan-200">
                          Schemalagd
                        </span>
                      )}
                    </td>

                    <td className="p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/admin/pricing/${typedContract.slug}?previewVersionId=${version.id}&kwh=${previewKwh}&area=${previewArea}`}
                          className="rounded-xl border border-gray-800 bg-black/40 px-3 py-2 text-xs text-gray-200 hover:border-cyan-500/40"
                        >
                          Välj för preview
                        </Link>

                        <form
                          action={cloneVersionAction}
                          className="flex items-center gap-2"
                        >
                          <input
                            type="hidden"
                            name="contract_id"
                            value={typedContract.id}
                          />
                          <input
                            type="hidden"
                            name="source_version_id"
                            value={version.id}
                          />
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

      {selectedVersion ? (
        <div className="rounded-3xl border border-cyan-500/20 bg-cyan-500/5 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-lg font-semibold text-white">
                Vald preview-version: v{selectedVersion.version_number}
              </div>
              <p className="mt-1 text-sm text-gray-300">
                Status: {classify(nowIso, selectedVersion)} • Gäller från{' '}
                {fmtWhen(selectedVersion.valid_from)}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {AREAS.map((area) => (
                <Link
                  key={area}
                  href={`/admin/pricing/${typedContract.slug}?previewVersionId=${selectedVersion.id}&kwh=${previewKwh}&area=${area}`}
                  className={`rounded-xl border px-3 py-2 text-xs ${
                    previewArea === area
                      ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200'
                      : 'border-white/10 bg-white/5 text-gray-200 hover:border-cyan-500/40'
                  }`}
                >
                  {area}
                </Link>
              ))}
            </div>
          </div>

          <form className="mt-4 grid gap-3 md:grid-cols-[1fr_220px_auto]">
            <input
              type="hidden"
              name="previewVersionId"
              value={selectedVersion.id}
            />

            <div>
              <label className="text-xs text-gray-400">
                Årsförbrukning / preview kWh
              </label>
              <input
                name="kwh"
                defaultValue={String(previewKwh)}
                className="mt-2 h-11 w-full rounded-xl border border-gray-800 bg-black/40 px-3 text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400">Elområde</label>
              <select
                name="area"
                defaultValue={previewArea}
                className="mt-2 h-11 w-full rounded-xl border border-gray-800 bg-black/40 px-3 text-sm"
              >
                {AREAS.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                formMethod="get"
                className="h-11 rounded-xl bg-white px-4 text-sm font-semibold text-black hover:bg-white/90"
              >
                Uppdatera preview
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="rounded-3xl border border-gray-800 bg-gray-950 p-6">
        <div className="text-lg font-semibold">3) Fyll priser per område</div>
        <p className="mt-1 text-sm text-gray-400">
          För <span className="text-gray-200">spot_hourly</span> används
          markup_ore, variable_fee_ore, elcert_ore och monthly_fee. För{' '}
          <span className="text-gray-200">fixed/portfolio_managed</span>{' '}
          används price_per_kwh_ore, variable_fee_ore, elcert_ore och
          monthly_fee.
        </p>

        {!previewVersionId ? (
          <div className="mt-4 text-sm text-gray-500">
            Välj eller skapa en version först.
          </div>
        ) : (
          <form action={savePricingAction} className="mt-5 space-y-4">
            <input
              type="hidden"
              name="pricing_version_id"
              value={previewVersionId}
            />
            <input
              type="hidden"
              name="contract_type"
              value={typedContract.contract_type}
            />
            <input type="hidden" name="slug" value={slug} />

            <div className="grid gap-4 md:grid-cols-4">
              {AREAS.map((area) => (
                <div
                  key={area}
                  className="rounded-2xl border border-gray-800 bg-black/30 p-4"
                >
                  <div className="text-sm font-semibold text-gray-200">
                    {area}
                  </div>

                  {typedContract.contract_type === 'spot_hourly' ? (
                    <div className="mt-3 space-y-2">
                      <label className="text-xs text-gray-400">
                        Markup (öre/kWh)
                      </label>
                      <input
                        name={`${area}_markup_ore`}
                        defaultValue={defaultVal(area, 'markup_ore')}
                        className="h-10 w-full rounded-xl border border-gray-800 bg-black/40 px-3 text-sm"
                        disabled={!canWrite}
                      />
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2">
                      <label className="text-xs text-gray-400">
                        Pris (öre/kWh)
                      </label>
                      <input
                        name={`${area}_price_per_kwh_ore`}
                        defaultValue={defaultVal(area, 'price_per_kwh_ore')}
                        className="h-10 w-full rounded-xl border border-gray-800 bg-black/40 px-3 text-sm"
                        disabled={!canWrite}
                      />
                    </div>
                  )}

                  <div className="mt-3 space-y-2">
                    <label className="text-xs text-gray-400">
                      Rörlig avgift (öre/kWh)
                    </label>
                    <input
                      name={`${area}_variable_fee_ore`}
                      defaultValue={defaultVal(area, 'variable_fee_ore')}
                      className="h-10 w-full rounded-xl border border-gray-800 bg-black/40 px-3 text-sm"
                      disabled={!canWrite}
                    />
                  </div>

                  <div className="mt-3 space-y-2">
                    <label className="text-xs text-gray-400">
                      Elcertifikat (öre/kWh)
                    </label>
                    <input
                      name={`${area}_elcert_ore`}
                      defaultValue={defaultVal(area, 'elcert_ore')}
                      className="h-10 w-full rounded-xl border border-gray-800 bg-black/40 px-3 text-sm"
                      disabled={!canWrite}
                    />
                  </div>

                  <div className="mt-3 space-y-2">
                    <label className="text-xs text-gray-400">
                      Månadsavgift (SEK)
                    </label>
                    <input
                      name={`${area}_monthly_fee_sek`}
                      defaultValue={defaultVal(area, 'monthly_fee_sek')}
                      className="h-10 w-full rounded-xl border border-gray-800 bg-black/40 px-3 text-sm"
                      disabled={!canWrite}
                    />
                  </div>
                </div>
              ))}
            </div>

            <button
              disabled={!canWrite}
              className="h-11 w-full rounded-xl bg-white font-semibold text-black hover:bg-white/90 disabled:opacity-60"
            >
              Spara priser
            </button>
          </form>
        )}
      </div>

      <div className="rounded-3xl border border-gray-800 bg-gray-950 p-6">
        <div className="text-lg font-semibold">4) Preview</div>
        <p className="mt-1 text-sm text-gray-400">
          Preview använder pricing-engine med selectionMode{' '}
          <span className="font-mono">by_id</span>.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Link
            href={`/admin/pricing/${typedContract.slug}?previewVersionId=${previewVersionId}&kwh=2000&area=SE1`}
            className="rounded-xl border border-gray-800 bg-black/40 px-4 py-3 text-sm text-gray-200 hover:border-cyan-500/40"
          >
            Preview SE1 (2000 kWh)
          </Link>
          <Link
            href={`/admin/pricing/${typedContract.slug}?previewVersionId=${previewVersionId}&kwh=2000&area=SE3`}
            className="rounded-xl border border-gray-800 bg-black/40 px-4 py-3 text-sm text-gray-200 hover:border-cyan-500/40"
          >
            Preview SE3 (2000 kWh)
          </Link>
          <Link
            href={`/admin/pricing/${typedContract.slug}?previewVersionId=${previewVersionId}&kwh=8000&area=SE4`}
            className="rounded-xl border border-gray-800 bg-black/40 px-4 py-3 text-sm text-gray-200 hover:border-cyan-500/40"
          >
            Preview SE4 (8000 kWh)
          </Link>
        </div>

        <div className="mt-6 rounded-2xl border border-gray-800 bg-black/30 p-4">
          <div className="text-sm font-semibold text-gray-200">
            Spec (engine)
          </div>

          {!previewSpec ? (
            <div className="mt-2 text-sm text-amber-200">
              Preview kunde inte beräknas (saknar data).
            </div>
          ) : (
            <div className="mt-3 space-y-2 text-sm text-gray-200">
              {previewLines.map((line) => (
                <div
                  key={line.key}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="text-gray-300">
                    {line.label}
                    {line.note ? (
                      <span className="ml-2 text-xs text-gray-500">
                        ({line.note})
                      </span>
                    ) : null}
                  </div>

                  <div className="font-mono text-gray-200">
                    {typeof line.orePerKwh === 'number'
                      ? `${line.orePerKwh} öre/kWh`
                      : ''}
                    {typeof line.sekPerMonth === 'number'
                      ? `  |  ${line.sekPerMonth} SEK/mån`
                      : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-gray-800 bg-gray-950 p-6">
        <div className="text-lg font-semibold">5) Publicera</div>
        <p className="mt-1 text-sm text-gray-400">
          Publicera vald version. Detta avpublicerar automatiskt andra versioner
          för samma avtal. Om valid_from ligger i framtiden blir den schemalagd
          tills datumet.
        </p>

        <form
          action={publishVersionAction}
          className="mt-4 flex flex-col gap-3 md:flex-row md:items-end"
        >
          <input type="hidden" name="contract_id" value={typedContract.id} />
          <input type="hidden" name="version_id" value={previewVersionId} />
          <input type="hidden" name="slug" value={slug} />

          <div className="flex-1">
            <label className="text-xs text-gray-400">Anledning (audit)</label>
            <input
              name="reason"
              className="mt-2 h-11 w-full rounded-xl border border-gray-800 bg-black/40 px-3 text-sm text-gray-200"
              placeholder="Ex: Ny kampanj, justering av påslag, uppdaterade avgifter..."
              required
              disabled={!canPublish || !previewVersionId}
            />
          </div>

          <button
            disabled={!canPublish || !previewVersionId}
            className="h-11 rounded-xl bg-white px-4 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-60"
          >
            Publicera vald version
          </button>
        </form>
      </div>
    </div>
  )
}