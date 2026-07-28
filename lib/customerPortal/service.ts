import { createHash } from 'node:crypto'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  fetchOpsCustomerPortalBundle,
  fetchOpsCustomerResource,
  isTransientOpsError,
  markOpsCustomerNotificationsRead,
  type OpsCustomerReadResource,
  type OpsPortalIdentity,
} from '@/lib/ops/client'
import type {
  CustomerDataQuality,
  CustomerDocument,
  CustomerInvoice,
  CustomerLegalAcceptance,
  CustomerMeteringValue,
  CustomerNotification,
  CustomerPortalContract,
  CustomerPortalEvent,
  CustomerPortalOverview,
  CustomerPowerOfAttorney,
  CustomerProfile,
  CustomerSite,
  CustomerStatus,
  CustomerSwitchStatus,
  CustomerSupportMessage,
  CustomerSupportTicket,
} from './types'

type CustomerProfileFallbackRow = {
  user_id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  phone: string | null
}

type LocalPortalLinkRow = Record<string, unknown>
type LocalDeliveryPointRow = Record<string, unknown>
type LocalInvoiceRow = Record<string, unknown>
type LocalDocumentRow = Record<string, unknown>
type LocalLegalAcceptanceRow = Record<string, unknown>

export class CustomerPortalAccessError extends Error {
  readonly status = 401
  readonly code = 'unauthorized'

  constructor() {
    super('Du behöver logga in för att se dina kunduppgifter.')
    this.name = 'CustomerPortalAccessError'
  }
}

async function getUserOrThrow(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new CustomerPortalAccessError()
  }

  return user
}

function asText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function authMetadata(user?: User | null): Record<string, unknown> {
  return asRecord(user?.user_metadata)
}

function looksLikeEmail(value: string | null | undefined): boolean {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
}

function pickAuthText(user: User | null | undefined, keys: string[]): string | null {
  const metadata = authMetadata(user)
  return pick(metadata, keys)
}

function mergeProfileWithAuth(
  profile: CustomerProfile,
  user?: User | null
): CustomerProfile {
  const firstName =
    profile.first_name ?? pickAuthText(user, ['first_name', 'firstName', 'given_name'])
  const lastName =
    profile.last_name ?? pickAuthText(user, ['last_name', 'lastName', 'family_name'])
  const computedFullName = [firstName, lastName].filter(Boolean).join(' ') || null
  const authFullName = pickAuthText(user, [
    'full_name',
    'fullName',
    'name',
    'display_name',
    'displayName',
  ])
  const existingFullName = looksLikeEmail(profile.full_name) ? null : profile.full_name

  return {
    ...profile,
    email: profile.email ?? user?.email ?? null,
    first_name: firstName,
    last_name: lastName,
    full_name: existingFullName ?? authFullName ?? computedFullName,
    phone: profile.phone ?? pickAuthText(user, ['phone', 'phone_number', 'phoneNumber']),
  }
}

function profileFromAuth(user: User): CustomerProfile {
  return mergeProfileWithAuth(
    {
      user_id: user.id,
      email: user.email ?? null,
      first_name: null,
      last_name: null,
      full_name: null,
      phone: null,
      language_code: 'sv',
      timezone: 'Europe/Stockholm',
      email_verified_at: user.email_confirmed_at ?? null,
      onboarding_state: user.email_confirmed_at ? 'verified' : 'pending_verification',
      billing_customer_ref: null,
      contract_customer_ref: null,
      metadata: { source: 'auth_user' },
      customer_type: null,
      company_name: null,
      customer_number: null,
      external_customer_id: null,
      portal_identity_id: null,
    },
    user
  )
}

function pick(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = asText(row[key])
    if (value) return value
  }
  return null
}

function pickDate(row: Record<string, unknown>, keys: string[]): string | null {
  return pick(row, keys)
}

function stableEntityId(
  entity: string,
  row: Record<string, unknown>,
  idKeys: string[],
  fallbackKeys: string[],
): string {
  const direct = pick(row, idKeys)
  if (direct) return direct
  const basis = fallbackKeys.map((key) => {
    const value = row[key]
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
      ? String(value).trim().toLowerCase()
      : ''
  }).join('|')
  const digest = createHash('sha256')
    .update(`${entity}|${basis || JSON.stringify(row)}`)
    .digest('hex')
    .slice(0, 32)
  return `${entity}-${digest}`
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean)
  if (typeof value === 'string' && value.trim()) return [value.trim()]
  return []
}

function mapOpsProfile(
  row: Record<string, unknown> | null,
  fallback: CustomerProfile | null,
  userId: string,
  userEmail?: string | null
): CustomerProfile | null {
  if (!row && fallback) return fallback
  if (!row) return fallback

  const firstName = pick(row, ['first_name', 'firstName']) ?? fallback?.first_name ?? null
  const lastName = pick(row, ['last_name', 'lastName']) ?? fallback?.last_name ?? null
  const computedFullName = [firstName, lastName].filter(Boolean).join(' ') || null
  const fullName =
    pick(row, ['full_name', 'fullName', 'name']) ??
    fallback?.full_name ??
    computedFullName

  return {
    user_id: userId,
    email: pick(row, ['email', 'customer_email']) ?? fallback?.email ?? userEmail ?? null,
    first_name: firstName,
    last_name: lastName,
    full_name: fullName,
    phone: pick(row, ['phone', 'customer_phone']) ?? fallback?.phone ?? null,
    language_code: fallback?.language_code ?? 'sv',
    timezone: fallback?.timezone ?? 'Europe/Stockholm',
    email_verified_at: fallback?.email_verified_at ?? null,
    onboarding_state:
      pick(row, ['onboarding_state', 'onboarding_status', 'status']) ??
      fallback?.onboarding_state ??
      'active',
    billing_customer_ref:
      pick(row, ['billing_customer_ref', 'billing_customer_id']) ??
      fallback?.billing_customer_ref ??
      null,
    contract_customer_ref:
      pick(row, ['customer_number', 'contract_customer_ref']) ??
      fallback?.contract_customer_ref ??
      null,
    customer_number: pick(row, ['customer_number', 'customerNumber']) ?? fallback?.customer_number ?? null,
    external_customer_id:
      pick(row, ['external_customer_id', 'externalCustomerId']) ??
      fallback?.external_customer_id ??
      null,
    portal_identity_id:
      pick(row, ['portal_identity_id', 'portalIdentityId']) ??
      fallback?.portal_identity_id ??
      null,
    metadata: { source: 'ops_customer_api', raw: row },
    customer_type: pick(row, ['customer_type', 'customerType']) ?? fallback?.customer_type ?? null,
    company_name: pick(row, ['company_name', 'companyName']) ?? fallback?.company_name ?? null,
  }
}

function mapOpsContract(row: Record<string, unknown>): CustomerPortalContract {
  const id = stableEntityId('contract', row, ['id', 'contract_id', 'contractId'], ['contract_number', 'application_id', 'created_at'])
  const name = pick(row, ['contract_name', 'name', 'product_name', 'productCode'])
  const contractNumber = pick(row, ['contract_number', 'contractNumber'])
  return {
    id,
    agreement_id: pick(row, ['agreement_id', 'application_id', 'contract_application_id']),
    contract_slug: pick(row, ['product_code', 'slug', 'type']),
    contract_name: name,
    contract_number: contractNumber,
    status: pick(row, ['status', 'contract_status']) ?? 'unknown',
    customer_status_label: pick(row, ['customer_status_label', 'status_label']),
    signed_at: pickDate(row, ['signed_at', 'accepted_at', 'created_at']),
    starts_at: pickDate(row, [
      'actual_start_date',
      'confirmed_start_date',
      'requested_start_date',
      'starts_at',
      'start_date',
    ]),
    ends_at: pickDate(row, ['ends_at', 'end_date']),
    requested_start_date: pickDate(row, ['requested_start_date', 'requestedStartDate']),
    confirmed_start_date: pickDate(row, ['confirmed_start_date', 'confirmedStartDate']),
    actual_start_date: pickDate(row, ['actual_start_date', 'actualStartDate']),
    billing_provider_key: pick(row, ['billing_provider_key', 'billing_provider']),
    contract_provider_key: pick(row, ['contract_provider_key', 'provider']),
    contract_external_ref: contractNumber ?? pick(row, ['external_ref', 'contract_external_ref']),
    billing_contract_ref: pick(row, ['billing_contract_ref', 'billing_ref']),
    price_plan_id: pick(row, ['price_plan_id', 'pricePlanId']),
    price_plan_version_id: pick(row, ['price_plan_version_id', 'pricePlanVersionId']),
    contract_price_snapshot_id: pick(row, [
      'contract_price_snapshot_id',
      'contractPriceSnapshotId',
    ]),
    pricing_snapshot: asRecord(row.pricing_snapshot ?? row.price_snapshot),
    metadata: { source: 'ops_customer_api', raw: row },
    created_at: pickDate(row, ['created_at', 'createdAt']) ?? new Date().toISOString(),
  }
}

function mapOpsSite(row: Record<string, unknown>): CustomerSite {
  return {
    id: stableEntityId('site', row, ['id', 'customer_site_id', 'site_id'], ['facility_id', 'metering_point_id', 'address', 'postal_code']),
    address: pick(row, ['address', 'street', 'street_address', 'facility_address', 'site_address']),
    postal_code: pick(row, ['postal_code', 'postalCode', 'zip', 'postcode']),
    city: pick(row, ['city', 'postal_city', 'postalCity']),
    facility_id: pick(row, ['facility_id', 'facilityId', 'site_facility_id']),
    metering_point_id: pick(row, ['metering_point_id', 'meteringPointId', 'mpan', 'external_metering_ref']),
    grid_area_code: pick(row, ['grid_area_code', 'network_area_code', 'network_area_ref']),
    price_area: pick(row, ['price_area', 'price_area_code', 'electricity_area', 'area_code']),
    grid_owner_name: pick(row, ['grid_owner_name', 'grid_owner', 'dso_name']),
    verification_status: pick(row, ['verification_status', 'facility_verification_status']),
    onboarding_status: pick(row, ['onboarding_status', 'site_status']),
    data_quality_status: pick(row, ['data_quality_status']),
    resolution_status: pick(row, ['resolution_status', 'energy_resolution_status']),
  }
}

function mapOpsInvoice(row: Record<string, unknown>): CustomerInvoice {
  return {
    id: stableEntityId('invoice', row, ['id', 'invoice_id'], ['invoice_number', 'external_invoice_ref', 'issued_at']),
    invoice_number: pick(row, ['invoice_number', 'invoiceNumber']),
    provider_key: pick(row, ['provider_key', 'provider']) ?? 'billing_partner',
    external_invoice_ref: pick(row, ['external_invoice_ref', 'provider_invoice_id']),
    currency_code: pick(row, ['currency_code', 'currency']) ?? 'SEK',
    invoice_period_start: pickDate(row, ['invoice_period_start', 'period_start']),
    invoice_period_end: pickDate(row, ['invoice_period_end', 'period_end']),
    issued_at: pickDate(row, ['issued_at', 'invoice_date', 'created_at']),
    due_at: pickDate(row, ['due_at', 'due_date']),
    paid_at: pickDate(row, ['paid_at', 'payment_date']),
    status: pick(row, ['status', 'payment_status']) ?? 'unknown',
    total_amount: asNumber(row.total_amount ?? row.amount_inc_vat ?? row.amount) ?? 0,
    vat_amount: asNumber(row.vat_amount) ?? 0,
    ocr_number: pick(row, ['ocr_number', 'ocr']),
    payment_reference: pick(row, ['payment_reference', 'reference']),
    pdf_url: pick(row, ['pdf_url', 'download_url']),
    pdf_storage_path: pick(row, ['pdf_storage_path']),
    line_items: Array.isArray(row.line_items) ? row.line_items : [],
  }
}

function mapOpsEvent(row: Record<string, unknown>): CustomerPortalEvent {
  return {
    id: stableEntityId('event', row, ['id', 'event_id'], ['event_type', 'created_at', 'occurred_at']),
    event_type: pick(row, ['event_type', 'type']) ?? 'customer.event',
    title: pick(row, ['title', 'customer_label']),
    summary: pick(row, ['summary', 'message', 'body']),
    status: pick(row, ['status']),
    created_at: pickDate(row, ['created_at', 'occurred_at']) ?? new Date().toISOString(),
    metadata: asRecord(row.metadata ?? row.payload),
  }
}

function mapOpsDocument(row: Record<string, unknown>): CustomerDocument {
  return {
    id: stableEntityId('document', row, ['id', 'document_id'], ['document_type', 'title', 'created_at', 'file_url']),
    title: pick(row, ['title', 'name', 'document_name']),
    document_type: pick(row, ['document_type', 'type']),
    status: pick(row, ['status']) ?? 'available',
    created_at: pickDate(row, ['created_at', 'issued_at', 'published_at']),
    file_url: pick(row, ['file_url', 'url', 'pdf_url']),
    download_url: pick(row, ['download_url']),
    version: pick(row, ['version', 'legal_version']),
  }
}

function acceptanceTitle(type: string) {
  switch (type) {
    case 'terms':
    case 'terms_accepted':
      return 'Allmänna villkor'
    case 'privacy_policy':
    case 'privacy_policy_seen':
      return 'Integritetspolicy'
    case 'withdrawal_info':
    case 'cancellation_right':
      return 'Ångerrätt'
    case 'power_of_attorney':
      return 'Fullmakt för anläggningsuppgifter'
    case 'price_snapshot':
      return 'Prisinformation'
    default:
      return 'Godkännande'
  }
}

function mapOpsLegalAcceptance(row: Record<string, unknown>): CustomerLegalAcceptance {
  const type = pick(row, ['acceptance_type', 'type', 'legal_type']) ?? 'acceptance'
  return {
    id: stableEntityId('acceptance', row, ['id', 'acceptance_id'], ['acceptance_type', 'version', 'accepted_at']),
    acceptance_type: type,
    title: pick(row, ['title', 'name']) ?? acceptanceTitle(type),
    version: pick(row, ['version', 'legal_version', 'version_key']),
    accepted_at: pickDate(row, ['accepted_at', 'created_at']),
    source: pick(row, ['source', 'accepted_source']),
    status: pick(row, ['status']) ?? 'accepted',
  }
}

function poaScopeLabel(scopes: string[]) {
  const scope = scopes[0] ?? null
  switch (scope) {
    case 'facility_data_request':
      return 'Begära anläggningsuppgifter'
    case 'metering_point_lookup':
      return 'Hämta mätpunktsuppgifter'
    case 'supplier_switch':
      return 'Hantera leverantörsbyte'
    case 'metering_values':
      return 'Ta emot mätvärden'
    default:
      return 'Anläggningsuppgifter'
  }
}

function mapOpsPowerOfAttorney(row: Record<string, unknown>): CustomerPowerOfAttorney {
  const scopes = stringArray(row.scope ?? row.scopes ?? row.poa_scope)
  return {
    id: stableEntityId('poa', row, ['id', 'power_of_attorney_id'], ['status', 'accepted_at', 'version']),
    status: pick(row, ['status']) ?? 'active',
    scopes,
    accepted_at: pickDate(row, ['accepted_at', 'created_at']),
    revoked_at: pickDate(row, ['revoked_at']),
    valid_until: pickDate(row, ['valid_until', 'expires_at']),
    title: pick(row, ['title', 'name']) ?? poaScopeLabel(scopes),
    version: pick(row, ['version', 'legal_version', 'power_of_attorney_version']),
  }
}

function mapCustomerStatus(row: Record<string, unknown> | null): CustomerStatus | null {
  if (!row) return null
  const canStart = row.can_start_switch ?? row.canStartSwitch
  return {
    code: pick(row, ['code', 'status']),
    label: pick(row, ['label', 'title']),
    message: pick(row, ['message', 'next_step', 'nextStep']),
    can_start_switch: typeof canStart === 'boolean' ? canStart : null,
  }
}

function mapDataQuality(row: Record<string, unknown> | null): CustomerDataQuality | null {
  if (!row) return null
  return {
    status: pick(row, ['status']),
    issues: stringArray(row.issues ?? row.missing_fields ?? row.missingFields),
  }
}

function mapOpsSwitchStatus(row: Record<string, unknown> | null): CustomerSwitchStatus | null {
  if (!row) return null
  const rawMissing = row.missing_fields ?? row.missingFields
  const missing = Array.isArray(rawMissing) ? rawMissing.map(String) : []
  return {
    status: pick(row, ['status', 'switch_status']),
    next_step: pick(row, ['next_step', 'nextStep']),
    requested_start_date: pickDate(row, ['requested_start_date', 'requestedStartDate']),
    confirmed_start_date: pickDate(row, ['confirmed_start_date', 'confirmedStartDate']),
    missing_fields: missing,
    grid_owner_name: pick(row, ['grid_owner_name', 'gridOwnerName']),
    facility_id: pick(row, ['facility_id', 'facilityId']),
    metering_point_id: pick(row, ['metering_point_id', 'meteringPointId']),
  }
}

function mapOpsMeteringValue(row: Record<string, unknown>): CustomerMeteringValue {
  return {
    id: stableEntityId('metering', row, ['id', 'metering_value_id'], ['metering_point_id', 'period_start', 'period_end']),
    metering_point_id: pick(row, ['metering_point_id', 'mpan']),
    facility_id: pick(row, ['facility_id']),
    period_start: pickDate(row, ['period_start', 'from_at', 'start_time']),
    period_end: pickDate(row, ['period_end', 'to_at', 'end_time']),
    quantity_kwh: asNumber(row.quantity_kwh ?? row.kwh ?? row.value),
    quality: pick(row, ['quality', 'quality_status']),
    source: pick(row, ['source']),
  }
}

function mapOpsNotification(row: Record<string, unknown>): CustomerNotification {
  return {
    id: stableEntityId('notification', row, ['id', 'notification_id'], ['ops_event_id', 'title', 'created_at']),
    category: pick(row, ['category', 'type']) ?? 'portal',
    title: pick(row, ['title', 'subject']) ?? 'Meddelande från Gridex',
    body: pick(row, ['body', 'message', 'summary']) ?? '',
    is_read: Boolean(row.is_read ?? row.read_at),
    read_at: pickDate(row, ['read_at', 'readAt']),
    created_at: pickDate(row, ['created_at', 'createdAt']) ?? new Date().toISOString(),
    related_entity_type: pick(row, ['related_entity_type', 'relatedEntityType']),
    related_entity_id: pick(row, ['related_entity_id', 'relatedEntityId']),
    link_href: pick(row, ['link_href', 'linkHref', 'url']),
    priority: pick(row, ['priority']),
  }
}

function mapLocalDocument(row: LocalDocumentRow): CustomerDocument {
  const title =
    pick(row, ['title', 'document_name', 'file_name']) ??
    pick(row, ['document_type', 'type'])

  return {
    id: stableEntityId('document', row, ['id', 'document_id'], ['document_type', 'title', 'created_at', 'file_url']),
    title,
    document_type: pick(row, ['document_type', 'type']),
    status: pick(row, ['status']) ?? 'available',
    created_at: pickDate(row, ['created_at', 'issued_at', 'published_at']),
    file_url: pick(row, ['file_url', 'url', 'pdf_url']),
    download_url: pick(row, ['download_url']),
    version: pick(row, ['version', 'legal_version']),
  }
}

function mapLocalLegalAcceptance(row: LocalLegalAcceptanceRow): CustomerLegalAcceptance {
  return mapOpsLegalAcceptance({ ...row, acceptance_type: row.acceptance_type ?? row.type })
}

function localPowersOfAttorneyFromAcceptances(
  acceptances: CustomerLegalAcceptance[]
): CustomerPowerOfAttorney[] {
  return acceptances
    .filter((item) => item.acceptance_type === 'power_of_attorney')
    .map((item) => ({
      id: `poa-${item.id}`,
      status: item.status ?? 'accepted',
      scopes: ['facility_data_request'],
      accepted_at: item.accepted_at,
      revoked_at: null,
      valid_until: null,
      title: item.title ?? 'Fullmakt för anläggningsuppgifter',
      version: item.version,
    }))
}

async function getLocalContracts(
  supabase: SupabaseClient,
  userId: string
): Promise<CustomerPortalContract[]> {
  const { data, error } = await supabase
    .from('customer_contract_portal_links')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) return []
  return ((data ?? []) as LocalPortalLinkRow[]).map(mapOpsContract)
}

async function getLocalSites(
  supabase: SupabaseClient,
  userId: string
): Promise<CustomerSite[]> {
  const { data, error } = await supabase
    .from('customer_delivery_points')
    .select('*')
    .eq('user_id', userId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) return []
  return ((data ?? []) as LocalDeliveryPointRow[]).map(mapOpsSite)
}

async function getLocalInvoices(
  supabase: SupabaseClient,
  userId: string
): Promise<CustomerInvoice[]> {
  const { data, error } = await supabase
    .from('customer_invoices')
    .select('*')
    .eq('user_id', userId)
    .order('issued_at', { ascending: false })
    .limit(50)

  if (error) return []
  return ((data ?? []) as LocalInvoiceRow[]).map(mapOpsInvoice)
}

async function getLocalDocuments(
  supabase: SupabaseClient,
  userId: string
): Promise<CustomerDocument[]> {
  const { data, error } = await supabase
    .from('customer_documents')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return []
  return ((data ?? []) as LocalDocumentRow[]).map(mapLocalDocument)
}

async function getLocalLegalAcceptances(
  supabase: SupabaseClient,
  contracts: CustomerPortalContract[]
): Promise<CustomerLegalAcceptance[]> {
  const agreementIds = contracts
    .map((contract) => contract.agreement_id)
    .filter((id): id is string => Boolean(id))

  if (agreementIds.length === 0) return []

  const { data, error } = await supabase
    .from('legal_acceptances')
    .select('*')
    .in('agreement_id', agreementIds)
    .order('accepted_at', { ascending: false })

  if (error) return []
  return ((data ?? []) as LocalLegalAcceptanceRow[]).map(mapLocalLegalAcceptance)
}

function deriveSwitchStatus(
  contracts: CustomerPortalContract[],
  sites: CustomerSite[]
): CustomerSwitchStatus | null {
  const contract = contracts[0]
  const site = sites[0]
  if (!contract && !site) return null

  return {
    status: contract?.status ?? site?.verification_status ?? site?.resolution_status ?? null,
    next_step: null,
    requested_start_date: contract?.requested_start_date ?? null,
    confirmed_start_date: contract?.confirmed_start_date ?? null,
    missing_fields: [],
    grid_owner_name: site?.grid_owner_name ?? null,
    facility_id: site?.facility_id ?? null,
    metering_point_id: site?.metering_point_id ?? null,
  }
}

export async function getPortalSession() {
  const supabase = await createSupabaseServerClient()
  const user = await getUserOrThrow(supabase)

  return { supabase, user }
}

export async function getCustomerProfile(
  supabase: SupabaseClient,
  userId: string,
  user?: User | null
): Promise<CustomerProfile | null> {
  const { data } = await supabase
    .from('customer_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle<CustomerProfile>()

  if (data) {
    return mergeProfileWithAuth(data, user)
  }

  const { data: fallback } = await supabase
    .from('contract_agreements')
    .select('user_id,email,first_name,last_name,phone')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<CustomerProfileFallbackRow>()

  if (!fallback) {
    return user ? profileFromAuth(user) : null
  }

  const fullName =
    [fallback.first_name, fallback.last_name].filter(Boolean).join(' ') || null

  return mergeProfileWithAuth({
    user_id: fallback.user_id,
    email: fallback.email,
    first_name: fallback.first_name,
    last_name: fallback.last_name,
    full_name: fullName,
    phone: fallback.phone,
    language_code: 'sv',
    timezone: 'Europe/Stockholm',
    email_verified_at: null,
    onboarding_state: 'pending',
    billing_customer_ref: null,
    contract_customer_ref: null,
    metadata: {},
    customer_type: null,
    company_name: null,
    customer_number: null,
    external_customer_id: null,
    portal_identity_id: null,
  }, user)
}

export async function getCustomerTickets(
  supabase: SupabaseClient,
  userId: string
): Promise<CustomerSupportTicket[]> {
  const { data } = await supabase
    .from('customer_support_tickets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  return (data ?? []) as CustomerSupportTicket[]
}

export async function getTicketMessages(
  supabase: SupabaseClient,
  ticketId: string
): Promise<CustomerSupportMessage[]> {
  const { data } = await supabase
    .from('customer_support_messages')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true })

  return (data ?? []) as CustomerSupportMessage[]
}

export async function getCustomerNotifications(
  supabase: SupabaseClient,
  userId: string,
  profile?: CustomerProfile | null
): Promise<CustomerNotification[]> {
  let query = supabase
    .from('customer_notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20)

  const customerNumber = profile?.customer_number ?? profile?.contract_customer_ref
  const email = profile?.email
  if (customerNumber || email) {
    const filters = [`user_id.eq.${userId}`]
    if (customerNumber) filters.push(`customer_number.eq.${customerNumber}`)
    if (email) filters.push(`customer_email.eq.${email}`)
    query = query.or(filters.join(','))
  } else {
    query = query.eq('user_id', userId)
  }

  const { data } = await query
  return (data ?? []) as CustomerNotification[]
}

function stableExternalCustomerId(profile: CustomerProfile | null): string | null {
  const customerNumber = profile?.customer_number ?? profile?.contract_customer_ref ?? null
  const externalCustomerId = profile?.external_customer_id ?? null
  if (!externalCustomerId) return null
  if (externalCustomerId === customerNumber) return null
  if (/^DX-\d+$/i.test(externalCustomerId)) return null
  return externalCustomerId
}


export function portalIdentityFromProfile(
  user: User,
  profile: CustomerProfile | null
): OpsPortalIdentity {
  return {
    userId: user.id,
    email: user.email ?? profile?.email ?? null,
    customerNumber: profile?.customer_number ?? profile?.contract_customer_ref ?? null,
    externalCustomerId: stableExternalCustomerId(profile),
  }
}


export async function getOpsPortalIdentityForUser(
  supabase: SupabaseClient,
  user: User
): Promise<OpsPortalIdentity> {
  const profile = await getCustomerProfile(supabase, user.id, user)
  return portalIdentityFromProfile(user, profile)
}

function unwrapOpsData(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload
  const row = payload as Record<string, unknown>
  return Object.prototype.hasOwnProperty.call(row, 'data') ? row.data : payload
}

export async function getCanonicalCustomerResource(
  resource: OpsCustomerReadResource,
  opaqueId?: string | null,
): Promise<{
  data: unknown
  authoritative: true
  read_only: false
  data_freshness: 'live'
}> {
  const { supabase, user } = await getPortalSession()
  const profile = await getCustomerProfile(supabase, user.id, user)
  const identity = portalIdentityFromProfile(user, profile)
  const payload = await fetchOpsCustomerResource(identity, resource, opaqueId)
  return {
    data: unwrapOpsData(payload),
    authoritative: true,
    read_only: false,
    data_freshness: 'live',
  }
}

export async function getCustomerPortalOverview(): Promise<CustomerPortalOverview> {
  const { supabase, user } = await getPortalSession()
  const localProfile = await getCustomerProfile(supabase, user.id, user)
  const identity = portalIdentityFromProfile(user, localProfile)

  const [tickets, opsResult] = await Promise.all([
    getCustomerTickets(supabase, user.id),
    fetchOpsCustomerPortalBundle(identity)
      .then((bundle) => ({ bundle, error: null as string | null }))
      .catch((error) => {
        if (!isTransientOpsError(error)) throw error
        return {
          bundle: null,
          error: error instanceof Error
            ? error.message
            : 'Kunduppgifterna kunde inte hämtas just nu.',
        }
      }),
  ])

  const opsAvailable = Boolean(opsResult.bundle && !opsResult.error)
  let localContracts: CustomerPortalContract[] = []
  let localSites: CustomerSite[] = []
  let localInvoices: CustomerInvoice[] = []
  let localDocuments: CustomerDocument[] = []
  let localLegalAcceptances: CustomerLegalAcceptance[] = []
  let localNotifications: CustomerNotification[] = []

  if (!opsAvailable) {
    ;[localContracts, localSites, localInvoices, localDocuments] = await Promise.all([
      getLocalContracts(supabase, user.id),
      getLocalSites(supabase, user.id),
      getLocalInvoices(supabase, user.id),
      getLocalDocuments(supabase, user.id),
    ])
    localLegalAcceptances = await getLocalLegalAcceptances(supabase, localContracts)
    localNotifications = await getCustomerNotifications(supabase, user.id, localProfile)
  }

  const bundle = opsResult.bundle
  const profile = mapOpsProfile(bundle?.profile ?? null, localProfile, user.id, user.email ?? null)
  const contracts = opsAvailable ? (bundle?.contracts ?? []).map(mapOpsContract) : localContracts
  const sites = opsAvailable ? (bundle?.sites ?? []).map(mapOpsSite) : localSites
  const invoices = opsAvailable ? (bundle?.invoices ?? []).map(mapOpsInvoice) : localInvoices
  const documents = opsAvailable ? (bundle?.documents ?? []).map(mapOpsDocument) : localDocuments
  const legalAcceptances = opsAvailable
    ? (bundle?.legalAcceptances ?? []).map(mapOpsLegalAcceptance)
    : localLegalAcceptances
  const powersOfAttorney = opsAvailable
    ? (bundle?.powersOfAttorney ?? []).map(mapOpsPowerOfAttorney)
    : localPowersOfAttorneyFromAcceptances(legalAcceptances)
  const customerStatus = mapCustomerStatus(bundle?.customerStatus ?? null)
  const dataQuality = mapDataQuality(bundle?.dataQuality ?? null)
  const switchStatus =
    mapOpsSwitchStatus(bundle?.switchStatus ?? null) ??
    (customerStatus
      ? {
          status: customerStatus.code,
          next_step: customerStatus.message,
          requested_start_date: contracts[0]?.requested_start_date ?? null,
          confirmed_start_date: contracts[0]?.confirmed_start_date ?? null,
          missing_fields: dataQuality?.issues ?? [],
          grid_owner_name: sites[0]?.grid_owner_name ?? null,
          facility_id: sites[0]?.facility_id ?? null,
          metering_point_id: sites[0]?.metering_point_id ?? null,
        }
      : deriveSwitchStatus(contracts, sites))

  return {
    profile,
    contracts,
    sites,
    invoices,
    documents,
    legalAcceptances,
    powersOfAttorney,
    customerStatus,
    dataQuality,
    switchStatus,
    meteringValues: opsAvailable ? (bundle?.meteringValues ?? []).map(mapOpsMeteringValue) : [],
    events: opsAvailable ? (bundle?.events ?? []).map(mapOpsEvent) : [],
    tickets,
    notifications: opsAvailable ? (bundle?.notifications ?? []).map(mapOpsNotification) : localNotifications,
    opsAvailable,
    opsError: opsResult.error,
    authoritative: opsAvailable,
    readOnly: !opsAvailable,
    dataFreshness: opsAvailable ? 'live' : 'local_fallback',
    dataFreshnessMessage: opsAvailable
      ? null
      : 'Vi visar senast lokalt sparade uppgifter. Uppgifter från Gridex kan vara äldre tills anslutningen är återställd.',
  }
}

export async function markCustomerNotificationsRead(input: {
  notificationIds: string[]
  operationId?: string | null
}): Promise<{ ok: true; opsSynced: true; localSynced: boolean; queued: false }> {
  const { supabase, user } = await getPortalSession()
  const profile = await getCustomerProfile(supabase, user.id, user)
  const identity = portalIdentityFromProfile(user, profile)
  const ids = [...new Set(input.notificationIds.map((id) => id.trim()).filter(Boolean))]
  if (ids.length === 0) throw new Error('Minst en notis måste anges.')
  const operationId = input.operationId?.trim()
  if (!operationId) throw new Error('client_operation_id krävs för skrivoperationer.')
  const readAt = new Date().toISOString()
  await markOpsCustomerNotificationsRead(identity, {
    notificationIds: ids,
    operationId,
  })

  let localQuery = supabase
    .from('customer_notifications')
    .update({ is_read: true, read_at: readAt })
    .eq('user_id', user.id)
  localQuery = localQuery.in('id', ids)
  const { error: localError } = await localQuery

  return { ok: true, opsSynced: true, localSynced: !localError, queued: false }
}
