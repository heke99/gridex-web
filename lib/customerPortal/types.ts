export type CustomerProfile = {
  user_id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  full_name: string | null
  phone: string | null
  language_code: string
  timezone: string
  email_verified_at: string | null
  onboarding_state: string
  billing_customer_ref: string | null
  contract_customer_ref: string | null
  metadata: Record<string, unknown>
}

export type CustomerPortalContract = {
  id: string
  agreement_id: string | null
  contract_slug: string | null
  contract_name: string | null
  status: string
  signed_at: string | null
  starts_at: string | null
  ends_at: string | null
  billing_provider_key: string | null
  contract_provider_key: string | null
  contract_external_ref: string | null
  billing_contract_ref: string | null
  pricing_snapshot: Record<string, unknown>
  metadata: Record<string, unknown>
  created_at: string
}

export type CustomerInvoice = {
  id: string
  invoice_number: string | null
  provider_key: string | null
  external_invoice_ref: string | null
  currency_code: string
  invoice_period_start: string | null
  invoice_period_end: string | null
  issued_at: string | null
  due_at: string | null
  paid_at: string | null
  status: string
  total_amount: number
  vat_amount: number
  ocr_number: string | null
  payment_reference: string | null
  pdf_url: string | null
  pdf_storage_path: string | null
  line_items: unknown[]
}

export type CustomerSupportTicket = {
  id: string
  subject: string
  category: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  status: 'open' | 'waiting_on_customer' | 'waiting_on_internal' | 'resolved' | 'closed'
  description: string
  created_at: string
  updated_at: string
  closed_at: string | null
}

export type CustomerSupportMessage = {
  id: string
  ticket_id: string
  sender_user_id: string | null
  sender_type: 'customer' | 'agent' | 'system' | 'integration'
  body: string
  attachments: unknown[]
  is_internal_note: boolean
  created_at: string
}

export type CustomerNotification = {
  id: string
  category: string
  title: string
  body: string
  is_read: boolean
  read_at: string | null
  created_at: string
}

export type ExternalConnection = {
  id: string
  provider_key: string
  connection_name: string
  domain: string
  status: 'planned' | 'configuring' | 'active' | 'degraded' | 'disabled'
  is_sandbox: boolean
  last_success_at: string | null
  health_payload: Record<string, unknown>
}

export type CustomerPortalOverview = {
  profile: CustomerProfile | null
  contracts: CustomerPortalContract[]
  invoices: CustomerInvoice[]
  tickets: CustomerSupportTicket[]
  notifications: CustomerNotification[]
  connections: ExternalConnection[]
}
