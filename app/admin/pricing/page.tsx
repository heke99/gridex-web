// app/admin/pricing/page.tsx
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireAdminRole } from '@/lib/auth/admin'

export const dynamic = 'force-dynamic'

type Contract = {
  id: string
  name: string
  slug: string
  contract_type: 'spot_hourly' | 'portfolio_managed' | 'fixed'
  is_active: boolean
}

type Version = {
  id: string
  contract_id: string
  version_number: number
  valid_from: string
  is_published: boolean
}

type Audit = {
  contract_id: string
  version_id: string
  performed_at: string
}

export default async function AdminPricingIndexPage() {
  const supabase = await createSupabaseServerClient()
  // Legacy admin gate (layout + middleware + this)
  await requireAdminRole(supabase)

  const { data: contracts, error: cErr } = await supabase
    .from('contract_products')
    .select('id,name,slug,contract_type,is_active')
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
    .select('id,contract_id,version_number,valid_from,is_published')
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

  if (aErr) throw new Error(aErr.message)

  const nowIso = new Date().toISOString()

  // LIVE per kontrakt = published & valid_from <= now, senaste valid_from
  const liveByContract = new Map<string, Version | undefined>()
  for (const v of versions ?? []) {
    if (!v.is_published) continue
    if (v.valid_from > nowIso) continue
    const curr = liveByContract.get(v.contract_id)
    if (!curr || curr.valid_from < v.valid_from) {
      liveByContract.set(v.contract_id, v)
    }
  }

  // senaste audit per kontrakt
  const lastAuditByContract = new Map<string, Audit | undefined>()
  for (const a of audits ?? []) {
    if (!lastAuditByContract.has(a.contract_id)) {
      lastAuditByContract.set(a.contract_id, a)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Prishantering</h1>

      <div className="grid gap-4">
        {(contracts ?? []).map((c) => {
          const live = liveByContract.get(c.id)
          const lastAudit = lastAuditByContract.get(c.id)

          return (
            <div
              key={c.id}
              className="rounded-xl border border-gray-800 bg-gray-950 p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xl font-semibold">{c.name}</div>

                  <div className="text-sm text-gray-400">
                    {c.contract_type} •{' '}
                    {c.is_active ? 'Aktiv produkt' : 'Inaktiv'}
                  </div>

                  <div className="mt-2 text-sm">
                    Live prisversion (Hero/Kalkylator/API):{' '}
                    <span className="text-gray-300">
                      {live
                        ? `v${live.version_number} (från ${live.valid_from})`
                        : 'Ingen'}
                    </span>
                  </div>

                  {lastAudit && (
                    <div className="mt-2 text-xs text-gray-500">
                      Senast ändrad (audit):{' '}
                      {new Date(lastAudit.performed_at).toLocaleString('sv-SE')}
                    </div>
                  )}
                </div>

                <Link
                  href={`/admin/pricing/${c.slug}`}
                  className="bg-cyan-500 text-black font-bold px-4 py-2 rounded-lg"
                >
                  Hantera
                </Link>
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