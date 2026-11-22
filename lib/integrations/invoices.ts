import type { SupabaseClient } from '@supabase/supabase-js'
import { isStrictCalendarDate } from '@/lib/website/businessDate'

type JsonRecord = Record<string, unknown>

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

function asNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/\s+/g, '').replace(',', '.'))
    if (value.trim() && Number.isFinite(parsed)) return parsed
  }
  throw Object.assign(new Error('Invalid invoice amount'), { status: 400 })
}

function asIso(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null
  const str = asString(value)
  if (!str) throw Object.assign(new Error('Invalid invoice date'), { status: 400 })

  if (/^\d{4}-\d{2}-\d{2}(?:T|\s|$)/.test(str) && !isStrictCalendarDate(str.slice(0, 10))) {
    throw Object.assign(new Error('Invalid invoice calendar date'), { status: 400 })
  }
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

function asLineItems(value: unknown): JsonRecord[] {
  if (value === null) return []
  if (!Array.isArray(value) || value.some(item => !item || typeof item !== 'object' || Array.isArray(item))) {
    throw Object.assign(new Error('Invalid invoice lineItems'), { status: 400 })
  }
  return value
}

function optionalText(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') {
    throw Object.assign(new Error('Invalid invoice reference or text field'), { status: 400 })
  }
  return asString(value) ?? undefined
}

function optionalUuid(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value.trim())) {
    throw Object.assign(new Error('Invalid invoice customer or contract ID'), { status: 400 })
  }
  return value.trim().toLowerCase()
}

export async function importExternalInvoice(
  supabase: SupabaseClient,
  payload: ExternalInvoicePayload
): Promise<ImportedInvoiceResult> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw Object.assign(new Error('Invoice payload must be an object'), { status: 400 })
  }
  for (const nested of [payload.customer, payload.contract]) {
    if (nested !== undefined && nested !== null && (typeof nested !== 'object' || Array.isArray(nested))) {
      throw Object.assign(new Error('Invalid invoice customer or contract'), { status: 400 })
    }
  }
  const providerKey = requiredString(payload.providerKey, 'providerKey')
  const externalInvoiceRef = requiredString(
    payload.externalInvoiceRef,
    'externalInvoiceRef'
  )
  const customer = payload.customer ?? {}
  const contract = payload.contract ?? {}
  const firstName = asString(customer.firstName)
  const lastName = asString(customer.lastName)
  const normalizedCustomer = {
    user_id: optionalUuid(customer.userId),
    email: optionalText(customer.email)?.toLowerCase(),
    first_name: firstName ?? undefined,
    last_name: lastName ?? undefined,
    full_name: asString(customer.fullName) ?? ([firstName, lastName].filter(Boolean).join(' ') || undefined),
    phone: optionalText(customer.phone),
    billing_customer_ref: optionalText(customer.billingCustomerRef),
    contract_customer_ref: optionalText(customer.contractCustomerRef),
    external_identity_ref: optionalText(customer.externalIdentityRef),
  }
  const normalizedContract = {
    id: optionalUuid(contract.portalContractId),
    billing_contract_ref: optionalText(contract.billingContractRef),
    contract_external_ref: optionalText(contract.contractExternalRef),
  }

  // Undefined properties are omitted on the wire. A present null is an explicit update.
  const fields = {
    invoice_number: payload.invoiceNumber === undefined ? undefined : optionalText(payload.invoiceNumber) ?? null,
    currency_code: payload.currencyCode === undefined ? undefined : requiredString(payload.currencyCode, 'currencyCode'),
    invoice_period_start: payload.invoicePeriodStart === undefined ? undefined : asDate(payload.invoicePeriodStart),
    invoice_period_end: payload.invoicePeriodEnd === undefined ? undefined : asDate(payload.invoicePeriodEnd),
    issued_at: payload.issuedAt === undefined ? undefined : asIso(payload.issuedAt),
    due_at: payload.dueAt === undefined ? undefined : asIso(payload.dueAt),
    paid_at: payload.paidAt === undefined ? undefined : asIso(payload.paidAt),
    status: payload.status === undefined ? undefined : requiredString(payload.status, 'status'),
    total_amount: payload.totalAmount === undefined ? undefined : asNumber(payload.totalAmount),
    vat_amount: payload.vatAmount === undefined ? undefined : asNumber(payload.vatAmount),
    ocr_number: payload.ocrNumber === undefined ? undefined : optionalText(payload.ocrNumber) ?? null,
    payment_reference: payload.paymentReference === undefined ? undefined : optionalText(payload.paymentReference) ?? null,
    pdf_url: payload.pdfUrl === undefined ? undefined : optionalText(payload.pdfUrl) ?? null,
    pdf_storage_path: payload.pdfStoragePath === undefined ? undefined : optionalText(payload.pdfStoragePath) ?? null,
    line_items: payload.lineItems === undefined ? undefined : asLineItems(payload.lineItems),
  }

  const { data, error } = await supabase.rpc('gridex_import_invoice', {
    p_provider: providerKey,
    p_reference: externalInvoiceRef,
    p_customer: normalizedCustomer,
    p_contract: normalizedContract,
    p_fields: fields,
    p_payload: payload,
  })
  if (!error && data) return data as ImportedInvoiceResult
  if (error?.code === 'P0002') {
    const message = 'Invoice could not be matched to an existing customer profile'
    const { error: queueError } = await supabase.from('integration_sync_jobs').insert({
      provider_key: providerKey,
      entity_type: 'invoice',
      entity_id: externalInvoiceRef,
      direction: 'inbound',
      status: 'dead_letter',
      payload,
      last_error: message,
      idempotency_key: `${providerKey}:invoice:${externalInvoiceRef}`,
    })
    if (queueError) {
      console.error('[invoice import] dead-letter write failed', queueError.code)
      throw Object.assign(new Error('Invoice import unavailable'), { status: 503 })
    }
    throw Object.assign(new Error(message), { status: 422 })
  }
  if (error?.code === 'P0409' || error?.code === '23505') {
    throw Object.assign(new Error('Invoice import conflicts with an existing record'), { status: 409 })
  }
  if (error?.code === 'P0400') {
    throw Object.assign(new Error('Missing totalAmount'), { status: 400 })
  }
  console.error('[invoice import] transaction failed', error?.code ?? 'missing_result')
  throw Object.assign(new Error('Invoice import failed'), { status: 500 })
}
