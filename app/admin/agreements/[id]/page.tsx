import { requireAdminPageAccess } from '@/lib/admin/guards'
import { supabaseService } from '@/lib/supabase/service'
import { finalizeAgreement } from '@/lib/contracts/finalizeAgreement'
import {
  ContractAgreement,
  LegalAcceptance,
} from '@/lib/types/contracts'

export default async function AgreementDetail({
  params,
}: {
  params: { id: string }
}) {
  await requireAdminPageAccess({ anyOf: ['agreements.read', 'agreements.write', 'admin.access'] })

  const { data: agreement } = await supabaseService
    .from('contract_agreements')
    .select('*')
    .eq('id', params.id)
    .single<ContractAgreement>()

  const { data: legalData } = await supabaseService
    .from('legal_acceptances')
    .select('*')
    .eq('agreement_id', params.id)

  const legal = (legalData ?? []) as LegalAcceptance[]

  return (
    <div>
      <h1>{agreement?.customer_name}</h1>

      <h3>Godkända villkor</h3>
      <pre>{JSON.stringify(legal, null, 2)}</pre>

      <form
        action={async () => {
          'use server'
          await finalizeAgreement(params.id)
        }}
      >
        <button type="submit">
          Generera PDF + Skicka Mail
        </button>
      </form>

      <a href={`/api/agreements/${params.id}/pdf`}>
        Ladda ner PDF
      </a>
    </div>
  )
}