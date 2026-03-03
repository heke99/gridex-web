import { supabaseService } from '@/lib/supabase/service'
import { ContractAgreement } from '@/lib/types/contracts'

export default async function DashboardContracts() {
  const { data } = await supabaseService
    .from('contract_agreements')
    .select('*')
    .order('created_at', { ascending: false })

  const agreements = (data ?? []) as ContractAgreement[]

  return (
    <div>
      <h1>Mina avtal</h1>

      {agreements.map((agreement) => (
        <div key={agreement.id}>
          <p>{agreement.contract_type}</p>
          <a href={`/api/agreements/${agreement.id}/pdf`}>
            Ladda ner PDF
          </a>
        </div>
      ))}
    </div>
  )
}