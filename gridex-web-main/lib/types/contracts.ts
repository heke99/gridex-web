export type AgreementStatus =
  | 'draft'
  | 'pending_signature'
  | 'email_sent'
  | 'email_signed'
  | 'bankid_started'
  | 'bankid_signed'
  | 'finalized'

export interface ContractAgreement {
  id: string
  user_id?: string | null
  customer_name?: string | null
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  phone?: string | null
  personal_number?: string | null
  address?: string | null
  postal_code?: string | null
  city?: string | null
  apartment?: string | null
  facility_id?: string | null
  contract_type?: string | null
  contract_slug?: string | null
  start_date?: string | null
  email_token?: string | null
  email_sign_token?: string | null
  email_signed_at: string | null
  bankid_order_ref?: string | null
  bankid_completed_at?: string | null
  contract_pdf_path: string | null
  welcome_email_sent_at: string | null
  activated_at?: string | null
  sign_method?: string | null
  status: AgreementStatus | string
  created_at: string
  updated_at?: string | null
  customer_number?: string | null
  agreement_reference?: string | null
  street?: string | null
  move_in_date?: string | null
  pricing_version_id?: string | null
  idempotency_key?: string | null
}

export interface LegalAcceptance {
  id: string
  agreement_id: string
  user_id?: string | null
  email?: string | null
  type?: string | null
  acceptance_type?: string | null
  kind?: string | null
  category?: string | null
  version?: string | null
  document_hash?: string | null
  ip_address?: string | null
  user_agent?: string | null
  accepted_at: string
}