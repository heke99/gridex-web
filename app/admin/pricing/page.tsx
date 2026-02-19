import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'

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
  is_active: boolean
}

type Audit = {
  contract_id: string
  version_id: string
  performed_at: string
}

export default async function AdminPricingIndexPage() {
  const supabase = await createSupabaseServerClient()

  const { data: contracts, error: cErr } = await supabase
    .from('contract_products')
    .select('id,name,slug,contract_type,is_active')
    .order('name', { ascending: true })

  if (cErr) throw new Error(cErr.message)

  const contractIds = (contracts ?? []).map(c => c.id)

  const { data: versions, error: vErr } = await supabase
    .from('contract_pricing_versions')
    .select('id,contract_id,version_number,valid_from,is_active')
    .in(
      'contract_id',
      contractIds.length
        ? contractIds
        : ['00000000-0000-0000-0000-000000000000']
    )
    .order('version_number', { ascending: false })

  if (vErr) throw new Error(vErr.message)

  const { data: audits } = await supabase
    .from('pricing_version_audit')
    .select('contract_id,version_id,performed_at')
    .in(
      'contract_id',
      contractIds.length
        ? contractIds
        : ['00000000-0000-0000-0000-000000000000']
    )
    .order('performed_at', { ascending: false })

  const activeByContract = new Map<string, Version | undefined>()
  for (const v of versions ?? []) {
    if (v.is_active) activeByContract.set(v.contract_id, v)
  }

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
        {(contracts as Contract[] | null)?.map((c) => {
          const active = activeByContract.get(c.id)
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
                    Aktiv prisversion:{' '}
                    <span className="text-gray-300">
                      {active
                        ? `v${active.version_number} (från ${active.valid_from})`
                        : 'Ingen'}
                    </span>
                  </div>

                  {lastAudit && (
                    <div className="mt-2 text-xs text-gray-500">
                      Senast publicerad:{' '}
                      {new Date(lastAudit.performed_at).toLocaleString(
                        'sv-SE'
                      )}
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
      </div>
    </div>
  )
}