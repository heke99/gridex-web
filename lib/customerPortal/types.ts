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
  customer_type?: string | null
  company_name?: string | null
  customer_number?: string | null
}

export type CustomerPortalContract = {
  id: string
  agreement_id: string | null
  contract_slug: string | null
  contract_name: string | null
  contract_number?: string | null
  status: string
  customer_status_label?: string | null
  signed_at: string | null
  starts_at: string | null
  ends_at: string | null
  requested_start_date?: string | null
  confirmed_start_date?: string | null
  actual_start_date?: string | null
  billing_provider_key: string | null
  contract_provider_key: string | null
  contract_external_ref: string | null
  billing_contract_ref: string | null
  price_plan_id?: string | null
  price_plan_version_id?: string | null
  contract_price_snapshot_id?: string | null
  pricing_snapshot: Record<string, unknown>
  metadata: Record<string, unknown>
  created_at: string
}

export type CustomerSite = {
  id: string
  address: string | null
  postal_code: string | null
  city: string | null
  facility_id: string | null
  metering_point_id: string | null
  grid_area_code: string | null
  price_area: string | null
  grid_owner_name: string | null
  verification_status: string | null
  onboarding_status: string | null
  data_quality_status: string | null
  resolution_status: string | null
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

export type CustomerMeteringValue = {
  id: string
  metering_point_id: string | null
  facility_id?: string | null
  period_start: string | null
  period_end: string | null
  quantity_kwh: number | null
  quality?: string | null
  source?: string | null
}

export type CustomerPortalEvent = {
  id: string
  event_type: string
  title: string | null
  summary: string | null
  status?: string | null
  created_at: string
  metadata: Record<string, unknown>
}

export type CustomerSupportTicket = {
  id: string
  subject: string
  category: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  status:
    | 'open'
    | 'waiting_on_customer'
    | 'waiting_on_internal'
    | 'resolved'
    | 'closed'
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
  related_entity_type?: string | null
  related_entity_id?: string | null
  link_href?: string | null
  priority?: string | null
}


export type CustomerDocument = {
  id: string
  title: string | null
  document_type: string | null
  status: string | null
  created_at: string | null
  file_url: string | null
  download_url?: string | null
  version?: string | null
}

export type CustomerLegalAcceptance = {
  id: string
  acceptance_type: string
  title: string | null
  version: string | null
  accepted_at: string | null
  source: string | null
  status: string | null
}

export type CustomerPowerOfAttorney = {
  id: string
  status: string
  scope: string | null
  accepted_at: string | null
  revoked_at: string | null
  valid_until: string | null
  title: string | null
  version: string | null
}

export type CustomerSwitchStatus = {
  status: string | null
  next_step: string | null
  requested_start_date: string | null
  confirmed_start_date: string | null
  missing_fields: string[]
  grid_owner_name: string | null
  facility_id: string | null
  metering_point_id: string | null
}

export type CustomerPortalOverview = {
  profile: CustomerProfile | null
  contracts: CustomerPortalContract[]
  sites: CustomerSite[]
  invoices: CustomerInvoice[]
  documents: CustomerDocument[]
  legalAcceptances: CustomerLegalAcceptance[]
  powersOfAttorney: CustomerPowerOfAttorney[]
  switchStatus: CustomerSwitchStatus | null
  meteringValues: CustomerMeteringValue[]
  events: CustomerPortalEvent[]
  tickets: CustomerSupportTicket[]
  notifications: CustomerNotification[]
  opsAvailable: boolean
  opsError: string | null
}
