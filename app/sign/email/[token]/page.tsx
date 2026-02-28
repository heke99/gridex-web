import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function EmailSignPage({
  params,
}: {
  params: { token: string }
}) {
  const supabase = await createSupabaseServerClient()

  const { data: agreement } = await supabase
    .from('contract_agreements')
    .select('*')
    .eq('email_sign_token', params.token)
    .single()

  if (!agreement) redirect('/')

  if (agreement.status === 'email_signed') {
    return <div>Avtalet är redan signerat.</div>
  }

  await supabase
    .from('contract_agreements')
    .update({
      status: 'email_signed',
      email_signed_at: new Date().toISOString(),
    })
    .eq('id', agreement.id)

  await supabase.from('contract_agreement_audit').insert({
    agreement_id: agreement.id,
    action: 'email_signed',
  })

  redirect('/sign/success')
}