import Link from 'next/link'
import { supabaseService } from '@/lib/supabase/service'
import { ContractAgreement } from '@/lib/types/contracts'

export default async function AgreementsPage() {
  const { data } = await supabaseService
    .from('contract_agreements')
    .select('*')
    .order('created_at', { ascending: false })

  const agreements = (data ?? []) as ContractAgreement[]

  return (
    <div>
      <h1>Signerade avtal</h1>

      <a href="/api/admin/agreements/export">
        Exportera CSV
      </a>

      <table>
        <thead>
          <tr>
            <th>Kund</th>
            <th>Status</th>
            <th>Skapad</th>
          </tr>
        </thead>
        <tbody>
          {agreements.map((agreement) => (
            <tr key={agreement.id}>
              <td>
                <Link href={`/admin/agreements/${agreement.id}`}>
                  {agreement.customer_name}
                </Link>
              </td>
              <td>{agreement.status}</td>
              <td>{agreement.created_at}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}