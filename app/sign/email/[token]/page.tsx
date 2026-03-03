import { supabaseService } from '@/lib/supabase/service'
import { finalizeAgreement } from '@/lib/contracts/finalizeAgreement'
import { ContractAgreement } from '@/lib/types/contracts'

export default async function EmailSign({
  params,
}: {
  params: { token: string }
}) {
  const { data } = await supabaseService
    .from('contract_agreements')
    .update({
      email_signed_at: new Date().toISOString(),
      status: 'email_signed',
    })
    .eq('email_token', params.token)
    .select('*')
    .single<ContractAgreement>()

  if (data) {
    await finalizeAgreement(data.id)
  }

  return <div>Avtalet är signerat.</div>
}