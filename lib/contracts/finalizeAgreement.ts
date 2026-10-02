import { supabaseService } from '@/lib/supabase/service'
import { generateContractPDF } from './pdf'
import { ContractAgreement } from '@/lib/types/contracts'

export async function finalizeAgreement(
  agreementId: string,
  verifiedActorId: string,
): Promise<void> {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  if (typeof verifiedActorId !== 'string' || !uuid.test(verifiedActorId)) {
    throw new Error('Invalid verified actor id')
  }
  if (typeof agreementId !== 'string' || !uuid.test(agreementId)) {
    throw new Error('Invalid agreement id')
  }
  const { data, error } = await supabaseService
    .from('contract_agreements')
    .select('*')
    .eq('id', agreementId)
    .single<ContractAgreement>()

  if (error) throw error
  if (!data) throw new Error('Agreement not found')

  const pdfPath = data.contract_pdf_path ?? await generateContractPDF(data)

  // Record only the PDF and its audit. The database rechecks the operator's
  // global grant under the agreement lock and preserves lifecycle/mail flags.
  const { error: recordError } = await supabaseService.rpc('gridex_web_record_agreement_pdf', {
    p_actor_id: verifiedActorId,
    p_agreement_id: agreementId,
    p_pdf_path: pdfPath,
  })
  if (recordError) throw new Error(recordError.message)
}
