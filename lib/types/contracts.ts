export type AgreementStatus =
  | 'draft'
  | 'email_signed'
  | 'bankid_signed'
  | 'finalized'

export interface ContractAgreement {
  id: string
  customer_name: string
  personal_number: string
  address: string
  postal_code: string
  contract_type: string
  start_date: string
  email_token: string | null
  email_signed_at: string | null
  bankid_signed_at: string | null
  contract_pdf_path: string | null
  welcome_email_sent_at: string | null
  status: AgreementStatus
  created_at: string
}

export interface LegalAcceptance {
  id: string
  agreement_id: string
  type: 'terms' | 'privacy' | 'cookies'
  version: string
  ip_address: string | null
  user_agent: string | null
  accepted_at: string
}