import { createSupabaseServerClient } from '@/lib/supabase/server'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

type AgreementRow = {
  id: string
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
}

export default async function AgreementsPage() {
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from('contract_agreements')
    .select(`
      id,
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
      agreement_reference
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[agreements.page] error', error)
    throw new Error(error.message)
  }

  const agreements = (data ?? []) as AgreementRow[]

  const total = agreements.length
  const finalized = agreements.filter(a => a.status === 'finalized').length
  const signed = agreements.filter(a =>
    a.email_signed_at !== null || a.bankid_completed_at !== null
  ).length
  const activated = agreements.filter(a => a.activated_at !== null).length

  return (
    <div className="space-y-8">

      {/* HEADER */}
      <div className="rounded-3xl border border-gray-800 bg-gray-950 p-8">
        <h1 className="text-3xl font-bold">Avtalsadministration</h1>
        <p className="text-gray-400 mt-3">
          Full juridisk spårbarhet • Signering • Aktivering • PDF • Mail
        </p>
      </div>

      {/* KPI ROW */}
      <div className="grid md:grid-cols-4 gap-6">
        <KPI label="Totalt" value={total} />
        <KPI label="Signerade" value={signed} />
        <KPI label="Aktiverade" value={activated} />
        <KPI label="Finalized" value={finalized} />
      </div>

      {/* TABLE */}
      <div className="rounded-3xl border border-gray-800 bg-gray-950 overflow-hidden">

        <div className="p-6 border-b border-gray-800 flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">Avtalslista</div>
            <div className="text-xs text-gray-500 mt-1">
              Kundnummer • Referens • Signmetod • Status
            </div>
          </div>

          <a
            href="/api/admin/agreements/export"
            className="text-xs border border-white/10 bg-white/5 px-4 py-2 rounded-full hover:bg-white/10 transition"
          >
            Exportera CSV
          </a>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-gray-400 border-b border-gray-800">
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
              {agreements.map(a => {
                const fullName =
                  `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() || '—'

                const signedAt =
                  a.bankid_completed_at ??
                  a.email_signed_at

                return (
                  <tr key={a.id} className="border-t border-gray-800">

                    <td className="p-4">
                      <div className="font-medium text-gray-200">
                        {fullName}
                      </div>
                      <div className="text-xs text-gray-500">
                        {a.email ?? ''}
                      </div>
                      {a.customer_number && (
                        <div className="text-[10px] text-gray-600 mt-1">
                          Kundnr: {a.customer_number}
                        </div>
                      )}
                    </td>

                    <td className="p-4 text-xs text-gray-400">
                      {a.agreement_reference ?? '—'}
                    </td>

                    <td className="p-4">
                      <StatusBadge status={a.status} />
                      {a.activated_at && (
                        <div className="text-[10px] text-emerald-400 mt-1">
                          Aktiverad
                        </div>
                      )}
                    </td>

                    <td className="p-4 text-xs text-gray-400">
                      {a.sign_method ?? '—'}
                      {signedAt && (
                        <div className="text-[10px] text-gray-500 mt-1">
                          {new Date(signedAt).toLocaleString()}
                        </div>
                      )}
                    </td>

                    <td className="p-4">
                      {a.contract_pdf_path ? (
                        <span className="text-emerald-400 text-xs">
                          Generated
                        </span>
                      ) : (
                        <span className="text-yellow-400 text-xs">
                          Missing
                        </span>
                      )}
                    </td>

                    <td className="p-4">
                      {a.welcome_email_sent_at ? (
                        <span className="text-emerald-400 text-xs">
                          Sent
                        </span>
                      ) : (
                        <span className="text-yellow-400 text-xs">
                          Not sent
                        </span>
                      )}
                    </td>

                    <td className="p-4 text-gray-500 text-xs">
                      {new Date(a.created_at).toLocaleString()}
                    </td>

                    <td className="p-4 text-right">
                      <Link
                        href={`/admin/agreements/${a.id}`}
                        className="text-xs border border-white/10 bg-white/5 px-3 py-1 rounded-full hover:bg-white/10 transition"
                      >
                        Öppna
                      </Link>
                    </td>

                  </tr>
                )
              })}

              {agreements.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-6 text-gray-500">
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

function KPI({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-gray-800 bg-gray-950 p-6">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-2xl font-bold mt-2">{value}</div>
    </div>
  )
}

function StatusBadge({ status }: { status: string | null }) {
  const map: Record<string, string> = {
    draft: 'bg-gray-700 text-gray-300',
    email_signed: 'bg-cyan-900 text-cyan-300',
    bankid_signed: 'bg-blue-900 text-blue-300',
    finalized: 'bg-emerald-900 text-emerald-300',
  }

  const cls = map[status ?? ''] ?? 'bg-gray-800 text-gray-400'

  return (
    <span className={`text-xs px-3 py-1 rounded-full ${cls}`}>
      {status ?? 'unknown'}
    </span>
  )
}