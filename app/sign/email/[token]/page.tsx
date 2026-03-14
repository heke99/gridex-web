import { supabaseService } from '@/lib/supabase/service'
import { finalizeAgreement } from '@/lib/contracts/finalizeAgreement'
import { ContractAgreement } from '@/lib/types/contracts'

export const dynamic = 'force-dynamic'

export default async function EmailSign({
  params,
}: {
  params: { token: string }
}) {
  const { data, error } = await supabaseService
    .from('contract_agreements')
    .update({
      email_signed_at: new Date().toISOString(),
      status: 'email_signed',
    })
    .eq('email_sign_token', params.token)
    .is('email_signed_at', null)
    .select('*')
    .maybeSingle<ContractAgreement>()

  if (error) {
    throw new Error(error.message)
  }

  if (data?.id) {
    await finalizeAgreement(data.id)
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-20">
      <div className="rounded-3xl border border-gray-800 bg-gray-950 p-8 text-center">
        <h1 className="text-2xl font-bold text-white">Avtalet är signerat</h1>
        <p className="mt-3 text-gray-400">
          Din signering har registrerats. Om avtalet inte redan var färdigbehandlat
          har PDF och välkomstflöde nu startats.
        </p>
      </div>
    </div>
  )
}