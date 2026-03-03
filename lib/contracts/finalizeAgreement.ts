import { supabaseService } from '@/lib/supabase/service'
import { generateContractPDF } from './pdf'
import { ContractAgreement } from '@/lib/types/contracts'

export async function finalizeAgreement(
  agreementId: string
): Promise<void> {
  const { data, error } = await supabaseService
    .from('contract_agreements')
    .select('*')
    .eq('id', agreementId)
    .single<ContractAgreement>()

  if (error) throw error
  if (!data) throw new Error('Agreement not found')

  if (data.contract_pdf_path && data.welcome_email_sent_at) {
    return
  }

  const pdfPath = await generateContractPDF(data)

  await supabaseService
    .from('contract_agreements')
    .update({
      contract_pdf_path: pdfPath,
      welcome_email_sent_at: new Date().toISOString(),
      status: 'finalized',
    })
    .eq('id', agreementId)

  await supabaseService.from('contract_agreement_audit').insert({
    agreement_id: agreementId,
    action: 'finalized',
    created_at: new Date().toISOString(),
  })
}