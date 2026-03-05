import { requireAdminPageAccess } from '@/lib/admin/guards'

export const dynamic = 'force-dynamic'

type AgreementNested = {
  first_name: string | null
  last_name: string | null
  email: string | null
  sign_method: string | null
  status: string | null
}

type AuditRow = {
  id: string
  agreement_id: string
  type: string
  accepted_at: string
  ip_address: string | null
  user_agent: string | null
  version_hash: string | null
  contract_agreements: AgreementNested[]
}

export default async function AgreementsAuditPage() {
  const ctx = await requireAdminPageAccess({ anyOf: ['compliance.read', 'admin.access'] })
  const supabase = ctx.supabase

  const { data, error } = await supabase
    .from('legal_acceptances')
    .select(`
      id,
      agreement_id,
      type,
      accepted_at,
      ip_address,
      user_agent,
      version_hash,
      contract_agreements (
        first_name,
        last_name,
        email,
        sign_method,
        status
      )
    `)
    .order('accepted_at', { ascending: false })
    .limit(200)
    .returns<AuditRow[]>()

  if (error) {
    console.error('[audit.agreements] error', error)
    throw new Error(error.message)
  }

  const rows = data ?? []

  return (
    <div className="space-y-8">

      <div className="rounded-3xl border border-gray-800 bg-gray-950 p-8">
        <h1 className="text-3xl font-bold">Avtals-audit</h1>
        <p className="text-gray-400 mt-3">
          IP • User Agent • Version Hash • Signmetod • Status
        </p>
      </div>

      <div className="rounded-3xl border border-gray-800 bg-gray-950 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-400 border-b border-gray-800">
              <tr>
                <th className="p-4">Typ</th>
                <th className="p-4">Kund</th>
                <th className="p-4">Status</th>
                <th className="p-4">Signmetod</th>
                <th className="p-4">IP</th>
                <th className="p-4">Version</th>
                <th className="p-4">Tid</th>
              </tr>
            </thead>

            <tbody>
                {rows.map((row: AuditRow) => {
                    const agreement = row.contract_agreements[0] ?? null

                const fullName = agreement
                  ? `${agreement.first_name ?? ''} ${agreement.last_name ?? ''}`.trim()
                  : '—'

                return (
                  <tr key={row.id} className="border-t border-gray-800">

                    <td className="p-4">
                      <TypeBadge type={row.type} />
                    </td>

                    <td className="p-4">
                      <div className="font-medium text-gray-200">
                        {fullName || '—'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {agreement?.email ?? ''}
                      </div>
                      <div className="text-[10px] text-gray-600 mt-1">
                        Agreement: {row.agreement_id}
                      </div>
                    </td>

                    <td className="p-4">
                      <StatusBadge status={agreement?.status ?? null} />
                    </td>

                    <td className="p-4 text-xs text-gray-400">
                      {agreement?.sign_method ?? '—'}
                    </td>

                    <td className="p-4 text-xs text-gray-400 break-all">
                      {row.ip_address ?? '—'}
                      {row.user_agent && (
                        <div className="text-[10px] text-gray-600 mt-1">
                          {row.user_agent}
                        </div>
                      )}
                    </td>

                    <td className="p-4 text-xs text-gray-400 break-all">
                      {row.version_hash ?? '—'}
                    </td>

                    <td className="p-4 text-xs text-gray-500">
                      {new Date(row.accepted_at).toLocaleString()}
                    </td>

                  </tr>
                )
              })}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-gray-500">
                    Inga audit-loggar hittades.
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

function TypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    agreement: 'bg-purple-900 text-purple-300',
    terms: 'bg-cyan-900 text-cyan-300',
    privacy: 'bg-blue-900 text-blue-300',
    cookies: 'bg-yellow-900 text-yellow-300',
  }

  const cls = map[type] ?? 'bg-gray-800 text-gray-400'

  return (
    <span className={`text-xs px-3 py-1 rounded-full ${cls}`}>
      {type}
    </span>
  )
}