import Link from 'next/link'
import { requireAdminPageAccess } from '@/lib/admin/guards'

export const dynamic = 'force-dynamic'

type AgreementRow = {
  id: string
  user_id: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
  status: string | null
  created_at: string
  contract_pdf_path: string | null
  welcome_email_sent_at: string | null
  sign_method: string | null
  email_signed_at: string | null
  bankid_completed_at: string | null
  activated_at: string | null
  customer_number: string | null
  agreement_reference: string | null
  contract_slug: string | null
  personal_number: string | null
}

export default async function AgreementsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>
}) {
  const ctx = await requireAdminPageAccess({ anyOf: ['agreements.read', 'agreements.write', 'admin.access'] })
  const supabase = ctx.supabase
  const resolvedSearchParams = (await searchParams) ?? {}
  const q = resolvedSearchParams.q?.trim() ?? ''

  const { data, error } = await supabase
    .from('contract_agreements')
    .select(`
      id,
      user_id,
      first_name,
      last_name,
      email,
      status,
      created_at,
      contract_pdf_path,
      welcome_email_sent_at,
      sign_method,
      email_signed_at,
      bankid_completed_at,
      activated_at,
      customer_number,
      agreement_reference,
      contract_slug,
      personal_number
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[agreements.page] error', error)
    throw new Error(error.message)
  }

  const agreements = ((data ?? []) as AgreementRow[]).filter((item) => {
    if (!q) return true
    const haystack = [
      item.first_name,
      item.last_name,
      item.email,
      item.personal_number,
      item.contract_slug,
      item.customer_number,
      item.agreement_reference,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return haystack.includes(q.toLowerCase())
  })

  const total = agreements.length
  const finalized = agreements.filter((a) => a.status === 'finalized').length
  const signed = agreements.filter(
    (a) => a.email_signed_at !== null || a.bankid_completed_at !== null
  ).length
  const activated = agreements.filter((a) => a.activated_at !== null).length

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-gray-800 bg-gray-950 p-8">
        <h1 className="text-3xl font-bold">Avtalsadministration</h1>
        <p className="mt-3 text-gray-400">
          Full juridisk spårbarhet • Signering • Aktivering • PDF • Mail • Kundkort
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <KPI label="Totalt" value={total} />
        <KPI label="Signerade" value={signed} />
        <KPI label="Aktiverade" value={activated} />
        <KPI label="Finalized" value={finalized} />
      </div>

      <div className="rounded-3xl border border-gray-800 bg-gray-950 p-6">
        <form className="grid gap-4 md:grid-cols-[1fr_auto_auto]">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Sök namn, e-post, personnummer eller avtalsreferens"
            className="h-11 rounded-2xl border border-gray-800 bg-black/40 px-4 text-sm outline-none placeholder:text-gray-500"
          />
          <button className="rounded-2xl border border-white/10 bg-white/10 px-4 text-sm font-medium hover:bg-white/15">
            Sök
          </button>
          <Link
            href="/admin/agreements"
            className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-black/30 px-4 text-sm font-medium hover:bg-white/5"
          >
            Rensa
          </Link>
        </form>
      </div>

      <div className="rounded-3xl border border-gray-800 bg-gray-950 overflow-hidden">
        <div className="border-b border-gray-800 p-6 flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">Avtalslista</div>
            <div className="mt-1 text-xs text-gray-500">
              Kundnummer • Referens • Signmetod • Status • Kundkort
            </div>
          </div>

          <a
            href="/api/admin/agreements/export"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs hover:bg-white/10 transition"
          >
            Exportera CSV
          </a>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-800 text-xs text-gray-400">
              <tr>
                <th className="p-4">Kund</th>
                <th className="p-4">Referens</th>
                <th className="p-4">Status</th>
                <th className="p-4">Signering</th>
                <th className="p-4">PDF</th>
                <th className="p-4">Mail</th>
                <th className="p-4">Skapad</th>
                <th className="p-4"></th>
              </tr>
            </thead>

            <tbody>
              {agreements.map((a) => {
                const fullName = `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() || '—'
                const signedAt = a.bankid_completed_at ?? a.email_signed_at

                return (
                  <tr key={a.id} className="border-t border-gray-800">
                    <td className="p-4">
                      <div className="font-medium text-gray-200">{fullName}</div>
                      <div className="text-xs text-gray-500">{a.email ?? ''}</div>
                      <div className="mt-1 text-[10px] text-gray-600">
                        Personnummer: {a.personal_number ?? '—'}
                      </div>
                      {a.customer_number && (
                        <div className="mt-1 text-[10px] text-gray-600">Kundnr: {a.customer_number}</div>
                      )}
                    </td>

                    <td className="p-4 text-xs text-gray-400">
                      <div>{a.agreement_reference ?? '—'}</div>
                      <div className="mt-1 text-[10px] text-gray-500">{a.contract_slug ?? '—'}</div>
                    </td>

                    <td className="p-4">
                      <StatusBadge status={a.status} />
                      {a.activated_at && (
                        <div className="mt-1 text-[10px] text-emerald-400">Aktiverad</div>
                      )}
                    </td>

                    <td className="p-4 text-xs text-gray-400">
                      {a.sign_method ?? '—'}
                      {signedAt && (
                        <div className="mt-1 text-[10px] text-gray-500">{new Date(signedAt).toLocaleString('sv-SE')}</div>
                      )}
                    </td>

                    <td className="p-4">
                      {a.contract_pdf_path ? (
                        <span className="text-xs text-emerald-400">Generated</span>
                      ) : (
                        <span className="text-xs text-yellow-400">Missing</span>
                      )}
                    </td>

                    <td className="p-4">
                      {a.welcome_email_sent_at ? (
                        <span className="text-xs text-emerald-400">Sent</span>
                      ) : (
                        <span className="text-xs text-yellow-400">Not sent</span>
                      )}
                    </td>

                    <td className="p-4 text-xs text-gray-500">{new Date(a.created_at).toLocaleString('sv-SE')}</td>

                    <td className="p-4 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Link
                          href={`/admin/agreements/${a.id}`}
                          className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs hover:bg-white/10 transition"
                        >
                          Öppna
                        </Link>
                        {a.user_id && (
                          <Link
                            href={`/admin/customers/${a.user_id}`}
                            className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200 hover:bg-cyan-500/20 transition"
                          >
                            Kundkort
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}

              {agreements.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-6 text-gray-500">Inga avtal hittades.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function KPI({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-gray-800 bg-gray-950 p-6">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  )
}

function StatusBadge({ status }: { status: string | null }) {
  const map: Record<string, string> = {
    draft: 'bg-gray-700 text-gray-300',
    pending_signature: 'bg-amber-900 text-amber-300',
    email_sent: 'bg-sky-900 text-sky-300',
    email_signed: 'bg-cyan-900 text-cyan-300',
    bankid_started: 'bg-indigo-900 text-indigo-300',
    bankid_signed: 'bg-blue-900 text-blue-300',
    finalized: 'bg-emerald-900 text-emerald-300',
  }

  const cls = map[status ?? ''] ?? 'bg-gray-800 text-gray-400'

  return <span className={`rounded-full px-3 py-1 text-xs ${cls}`}>{status ?? 'unknown'}</span>
}