import type { SupabaseClient } from '@supabase/supabase-js'

type JsonRecord = Record<string, unknown>

type InvoiceLineItem = JsonRecord

export type ExternalInvoicePayload = {
  providerKey?: unknown
  externalInvoiceRef?: unknown
  invoiceNumber?: unknown
  customer?: {
    userId?: unknown
    email?: unknown
    firstName?: unknown
    lastName?: unknown
    fullName?: unknown
    phone?: unknown
    billingCustomerRef?: unknown
    contractCustomerRef?: unknown
    externalIdentityRef?: unknown
  }
  contract?: {
    portalContractId?: unknown
    billingContractRef?: unknown
    contractExternalRef?: unknown
  }
  currencyCode?: unknown
  invoicePeriodStart?: unknown
  invoicePeriodEnd?: unknown
  issuedAt?: unknown
  dueAt?: unknown
  paidAt?: unknown
  status?: unknown
  totalAmount?: unknown
  vatAmount?: unknown
  ocrNumber?: unknown
  paymentReference?: unknown
  pdfUrl?: unknown
  pdfStoragePath?: unknown
  lineItems?: unknown
}

export type ImportedInvoiceResult = {
  invoiceId: string
  userId: string
  syncJobId: string | null
  status: string
}

type CustomerProfileMatch = {
  user_id: string
  email: string | null
  billing_customer_ref: string | null
  contract_customer_ref: string | null
  external_identity_ref?: string | null
}

type PortalContractMatch = {
  id: string
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function requiredString(value: unknown, name: string): string {
  const parsed = asString(value)
  if (!parsed) {
    throw Object.assign(new Error(`Missing ${name}`), { status: 400 })
  }
  return parsed
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/\s+/g, '').replace(',', '.'))
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function asIso(value: unknown): string | null {
  const str = asString(value)
  if (!str) return null

  const parsed = new Date(str)
  if (!Number.isFinite(parsed.getTime())) {
    throw Object.assign(new Error(`Invalid date value: ${str}`), { status: 400 })
  }

  return parsed.toISOString()
}

function asDate(value: unknown): string | null {
  const iso = asIso(value)
  return iso ? iso.slice(0, 10) : null
}

function asLineItems(value: unknown): InvoiceLineItem[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is InvoiceLineItem => {
    return !!item && typeof item === 'object' && !Array.isArray(item)
  })
}

function normalizeEmail(value: unknown): string | null {
  return asString(value)?.toLowerCase() ?? null
}

async function findCustomerProfile(
  supabase: SupabaseClient,
  payload: ExternalInvoicePayload
): Promise<CustomerProfileMatch | null> {
  const customer = payload.customer ?? {}
  const userId = asString(customer.userId)

  if (userId) {
    const { data, error } = await supabase
      .from('customer_profiles')
      .select(
        'user_id,email,billing_customer_ref,contract_customer_ref,external_identity_ref'
      )
      .eq('user_id', userId)
      .maybeSingle<CustomerProfileMatch>()

    if (error) throw Object.assign(new Error(error.message), { status: 500 })
    if (data) return data
  }

  const lookupCandidates: Array<{
    column: keyof CustomerProfileMatch
    value: string | null
  }> = [
    { column: 'billing_customer_ref', value: asString(customer.billingCustomerRef) },
    { column: 'contract_customer_ref', value: asString(customer.contractCustomerRef) },
    { column: 'external_identity_ref', value: asString(customer.externalIdentityRef) },
    { column: 'email', value: normalizeEmail(customer.email) },
  ]

  for (const candidate of lookupCandidates) {
    if (!candidate.value) continue

    const { data, error } = await supabase
      .from('customer_profiles')
      .select(
        'user_id,email,billing_customer_ref,contract_customer_ref,external_identity_ref'
      )
      .eq(candidate.column, candidate.value)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle<CustomerProfileMatch>()

    if (error) throw Object.assign(new Error(error.message), { status: 500 })
    if (data) return data
  }

  return null
}

async function updateCustomerProfileFromInvoice(
  supabase: SupabaseClient,
  userId: string,
  payload: ExternalInvoicePayload
) {
  const customer = payload.customer ?? {}
  const email = normalizeEmail(customer.email)
  const firstName = asString(customer.firstName)
  const lastName = asString(customer.lastName)
  const inferredFullName = [firstName, lastName].filter(Boolean).join(' ')
  const fullName = (asString(customer.fullName) ?? inferredFullName) || null
  const phone = asString(customer.phone)
  const billingCustomerRef = asString(customer.billingCustomerRef)
  const contractCustomerRef = asString(customer.contractCustomerRef)
  const externalIdentityRef = asString(customer.externalIdentityRef)
  const patch: Record<string, unknown> = {
    onboarding_state: 'verified',
    metadata: {
      source: 'invoice_import',
      provider_key: asString(payload.providerKey),
    },
  }

  if (email) {
    patch.email = email
    patch.email_verified_at = new Date().toISOString()
  }

  if (firstName) patch.first_name = firstName
  if (lastName) patch.last_name = lastName
  if (fullName) patch.full_name = fullName
  if (phone) patch.phone = phone
  if (billingCustomerRef) patch.billing_customer_ref = billingCustomerRef
  if (contractCustomerRef) patch.contract_customer_ref = contractCustomerRef
  if (externalIdentityRef) patch.external_identity_ref = externalIdentityRef

  const { error } = await supabase
    .from('customer_profiles')
    .update(patch)
    .eq('user_id', userId)

  if (error) throw Object.assign(new Error(error.message), { status: 500 })
}
async function findPortalContractId(
  supabase: SupabaseClient,
  userId: string,
  payload: ExternalInvoicePayload
): Promise<string | null> {
  const contract = payload.contract ?? {}
  const directId = asString(contract.portalContractId)

  if (directId) {
    const { data, error } = await supabase
      .from('customer_contract_portal_links')
      .select('id')
      .eq('id', directId)
      .eq('user_id', userId)
      .maybeSingle<PortalContractMatch>()

    if (error) throw Object.assign(new Error(error.message), { status: 500 })
    if (data) return data.id
  }

  const refs = [
    { column: 'billing_contract_ref', value: asString(contract.billingContractRef) },
    { column: 'contract_external_ref', value: asString(contract.contractExternalRef) },
  ]

  for (const ref of refs) {
    if (!ref.value) continue

    const { data, error } = await supabase
      .from('customer_contract_portal_links')
      .select('id')
      .eq('user_id', userId)
      .eq(ref.column, ref.value)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<PortalContractMatch>()

    if (error) throw Object.assign(new Error(error.message), { status: 500 })
    if (data) return data.id
  }

  return null
}

async function queueSyncJob(
  supabase: SupabaseClient,
  params: {
    providerKey: string
    entityType: string
    entityId: string
    payload: JsonRecord
    status?: 'success' | 'failed' | 'dead_letter'
    lastError?: string
    idempotencyKey?: string
  }
): Promise<string | null> {
  const { data, error } = await supabase
    .from('integration_sync_jobs')
    .insert({
      provider_key: params.providerKey,
      entity_type: params.entityType,
      entity_id: params.entityId,
      direction: 'inbound',
      status: params.status ?? 'success',
      payload: params.payload,
      last_error: params.lastError ?? null,
      idempotency_key: params.idempotencyKey ?? null,
      response_payload: {},
    })
    .select('id')
    .single<{ id: string }>()

  if (error) {
    console.error('[queueSyncJob] failed', error)
    return null
  }

  return data.id
}

export async function importExternalInvoice(
  supabase: SupabaseClient,
  payload: ExternalInvoicePayload
): Promise<ImportedInvoiceResult> {
  const providerKey = requiredString(payload.providerKey, 'providerKey')
  const externalInvoiceRef = requiredString(
    payload.externalInvoiceRef,
    'externalInvoiceRef'
  )
  const idempotencyKey = `${providerKey}:invoice:${externalInvoiceRef}`
  const profile = await findCustomerProfile(supabase, payload)

  if (!profile) {
    await queueSyncJob(supabase, {
      providerKey,
      entityType: 'invoice',
      entityId: externalInvoiceRef,
      payload: payload as unknown as JsonRecord,
      status: 'dead_letter',
      lastError: 'No customer profile matched invoice payload',
      idempotencyKey,
    })

    throw Object.assign(
      new Error(
        'Invoice could not be matched to an existing customer profile. Provide userId, billingCustomerRef, contractCustomerRef, externalIdentityRef or email.'
      ),
      { status: 422 }
    )
  }

  await updateCustomerProfileFromInvoice(supabase, profile.user_id, payload)

  const portalContractId = await findPortalContractId(
    supabase,
    profile.user_id,
    payload
  )

  const invoicePayload = {
    user_id: profile.user_id,
    portal_contract_id: portalContractId,
    provider_key: providerKey,
    external_invoice_ref: externalInvoiceRef,
    invoice_number: asString(payload.invoiceNumber),
    currency_code: asString(payload.currencyCode) ?? 'SEK',
    invoice_period_start: asDate(payload.invoicePeriodStart),
    invoice_period_end: asDate(payload.invoicePeriodEnd),
    issued_at: asIso(payload.issuedAt),
    due_at: asIso(payload.dueAt),
    paid_at: asIso(payload.paidAt),
    status: asString(payload.status) ?? 'issued',
    total_amount: asNumber(payload.totalAmount),
    vat_amount: asNumber(payload.vatAmount),
    ocr_number: asString(payload.ocrNumber),
    payment_reference: asString(payload.paymentReference),
    pdf_url: asString(payload.pdfUrl),
    pdf_storage_path: asString(payload.pdfStoragePath),
    line_items: asLineItems(payload.lineItems),
    raw_payload: payload as unknown as JsonRecord,
  }

  const { data: invoice, error } = await supabase
    .from('customer_invoices')
    .upsert(invoicePayload, {
      onConflict: 'provider_key,external_invoice_ref',
    })
    .select('id,status')
    .single<{ id: string; status: string }>()

  if (error) throw Object.assign(new Error(error.message), { status: 500 })

  const syncJobId = await queueSyncJob(supabase, {
    providerKey,
    entityType: 'invoice',
    entityId: externalInvoiceRef,
    payload: payload as unknown as JsonRecord,
    status: 'success',
    idempotencyKey,
  })

  return {
    invoiceId: invoice.id,
    userId: profile.user_id,
    syncJobId,
    status: invoice.status,
  }
}
