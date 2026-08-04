import type { SupabaseClient, User } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  fetchOpsCustomerPortalBundle,
  fetchOpsCustomerResource,
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

function requiredCanonicalReference(
  row: Record<string, unknown>,
  field: 'contract_reference' | 'invoice_reference' | 'site_reference' | 'document_reference' | 'notification_reference',
  code:
    | 'PORTAL_CONTRACT_REFERENCE_MISSING'
    | 'PORTAL_INVOICE_REFERENCE_MISSING'
    | 'PORTAL_SITE_REFERENCE_MISSING'
    | 'PORTAL_DOCUMENT_REFERENCE_MISSING'
    | 'PORTAL_NOTIFICATION_REFERENCE_MISSING',
): string {
  const reference = pick(row, [field])
  if (!reference) {
    const error = new Error(`OPS returnerade en resurs utan ${field}.`) as Error & { code: string; status: number }
    error.code = code
    error.status = 502
    throw error
  }
  return reference
}

function stableEntityId(
  entity: string,
  row: Record<string, unknown>,
  idKeys: string[],
  _fallbackKeys: string[],
): string {
  const direct = pick(row, idKeys)
  if (direct) return direct
  const error = new Error(`OPS returnerade ${entity} utan canonical referens.`) as Error & { code: string; status: number }
  error.code = `PORTAL_${entity.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_REFERENCE_MISSING`
  error.status = 502
  throw error
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
    pick(row, ['display_name']) ??
    fallback?.full_name ??
    computedFullName

  return {
    user_id: userId,
    email: pick(row, ['email']) ?? fallback?.email ?? userEmail ?? null,
    first_name: firstName,
    last_name: lastName,
    full_name: fullName,
    phone: pick(row, ['phone']) ?? fallback?.phone ?? null,
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
    customer_number: pick(row, ['customer_number']) ?? fallback?.customer_number ?? null,
    external_customer_id:
      pick(row, ['external_customer_id', 'externalCustomerId']) ??
      fallback?.external_customer_id ??
      null,
    portal_identity_id:
      pick(row, ['portal_identity_id', 'portalIdentityId']) ??
      fallback?.portal_identity_id ??
      null,
    metadata: {},
    customer_type: pick(row, ['customer_type', 'customerType']) ?? fallback?.customer_type ?? null,
    company_name: pick(row, ['company_name', 'companyName']) ?? fallback?.company_name ?? null,
  }
}

function mapOpsContract(row: Record<string, unknown>): CustomerPortalContract {
  const id = requiredCanonicalReference(row, 'contract_reference', 'PORTAL_CONTRACT_REFERENCE_MISSING')
  return {
    id,
    contract_reference: id,
    agreement_id: null,
    contract_slug: pick(row, ['offer_reference']),
    contract_name: pick(row, ['contract_name']),
    contract_number: pick(row, ['contract_number']),
    status: pick(row, ['status']) ?? 'unknown',
    customer_status_label: null,
    signed_at: pickDate(row, ['signed_at']),
    starts_at: pickDate(row, ['start_date']),
    ends_at: pickDate(row, ['end_date']),
    requested_start_date: null,
    confirmed_start_date: null,
    actual_start_date: null,
    billing_provider_key: null,
    contract_provider_key: null,
    contract_external_ref: pick(row, ['contract_number']),
    billing_contract_ref: null,
    price_plan_id: null,
    price_plan_version_id: null,
    contract_price_snapshot_id: null,
    pricing_snapshot: {},
    metadata: {},
    created_at: pickDate(row, ['created_at']) ?? new Date().toISOString(),
  }
}

function mapOpsSite(row: Record<string, unknown>): CustomerSite {
  const id = requiredCanonicalReference(row, 'site_reference', 'PORTAL_SITE_REFERENCE_MISSING')
  return {
    id,
    site_reference: id,
    address: pick(row, ['address']),
    postal_code: pick(row, ['postal_code']),
    city: pick(row, ['city']),
    facility_id: pick(row, ['facility_id']),
    metering_point_id: pick(row, ['metering_point_id']),
    grid_area_code: pick(row, ['grid_area_code']),
    price_area: pick(row, ['price_area']),
    grid_owner_name: null,
    verification_status: null,
    onboarding_status: null,
    data_quality_status: null,
    resolution_status: null,
  }
}

function mapOpsInvoice(row: Record<string, unknown>): CustomerInvoice {
  const invoiceReference = requiredCanonicalReference(row, 'invoice_reference', 'PORTAL_INVOICE_REFERENCE_MISSING')
  return {
    id: invoiceReference,
    invoice_reference: invoiceReference,
    invoice_number: pick(row, ['invoice_number']),
    provider_key: null,
    external_invoice_ref: null,
    currency_code: pick(row, ['currency']) ?? 'SEK',
    invoice_period_start: pickDate(row, ['period_start']),
    invoice_period_end: pickDate(row, ['period_end']),
    issued_at: pickDate(row, ['issued_at']),
    due_at: pickDate(row, ['due_date']),
    paid_at: pickDate(row, ['paid_at']),
    status: pick(row, ['status']) ?? 'unknown',
    total_amount: asNumber(row.amount_inc_vat) ?? 0,
    vat_amount: asNumber(row.vat_amount) ?? 0,
    ocr_number: null,
    payment_reference: null,
    pdf_url: null,
    pdf_storage_path: null,
    line_items: [],
  }
}

function mapOpsEvent(row: Record<string, unknown>): CustomerPortalEvent {
  return {
    id: stableEntityId('event', row, ['event_reference', 'id', 'event_id'], ['event_type', 'created_at', 'occurred_at']),
    event_type: pick(row, ['event_type', 'type']) ?? 'customer.event',
    title: pick(row, ['title', 'customer_label']),
    summary: pick(row, ['summary', 'message', 'body']),
    status: pick(row, ['status']),
    created_at: pickDate(row, ['created_at', 'occurred_at']) ?? new Date().toISOString(),
    metadata: {},
  }
}

function mapOpsDocument(row: Record<string, unknown>): CustomerDocument {
  const id = requiredCanonicalReference(row, 'document_reference', 'PORTAL_DOCUMENT_REFERENCE_MISSING')
  return {
    id,
    document_reference: id,
    contract_reference: pick(row, ['contract_reference']),
    title: pick(row, ['title']),
    document_type: pick(row, ['document_type']),
    status: pick(row, ['status']),
    created_at: pickDate(row, ['created_at']),
    file_url: null,
    download_url: pick(row, ['download_url']),
    version: null,
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
    id: stableEntityId('acceptance', row, ['acceptance_reference', 'id', 'acceptance_id'], ['acceptance_type', 'version', 'accepted_at']),
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
    id: stableEntityId('poa', row, ['power_of_attorney_reference', 'id', 'power_of_attorney_id'], ['status', 'accepted_at', 'version']),
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
  const supplierSwitch = asRecord(row.supplier_switch ?? row.supplierSwitch)
  const canStart = supplierSwitch.can_dispatch ?? supplierSwitch.canDispatch ?? row.can_start_switch ?? row.canStartSwitch
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
    id: stableEntityId('metering', row, ['metering_value_reference', 'id', 'metering_value_id'], ['metering_point_id', 'period_start', 'period_end']),
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
  const id = requiredCanonicalReference(row, 'notification_reference', 'PORTAL_NOTIFICATION_REFERENCE_MISSING')
  return {
    id,
    notification_reference: id,
    category: pick(row, ['category']) ?? 'portal',
    title: pick(row, ['title']) ?? 'Meddelande från Gridex',
    body: pick(row, ['body']) ?? '',
    is_read: Boolean(row.is_read),
    read_at: null,
    created_at: pickDate(row, ['created_at']) ?? new Date().toISOString(),
    related_entity_type: null,
    related_entity_id: null,
    link_href: null,
    priority: null,
  }
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

function canonicalResourceRows(value: unknown, key: string): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.map(asRecord).filter((row) => Object.keys(row).length > 0)
  const row = asRecord(value)
  const nested = row[key] ?? row.items
  if (Array.isArray(nested)) return nested.map(asRecord).filter((item) => Object.keys(item).length > 0)
  return Object.keys(row).length > 0 ? [row] : []
}

function normalizeCanonicalCustomerResource(
  resource: OpsCustomerReadResource,
  value: unknown,
  input: { localProfile: CustomerProfile | null; user: User; detail: boolean },
): unknown {
  if (resource === 'me') {
    const row = canonicalResourceRows(value, 'profile')[0] ?? null
    return mapOpsProfile(row, input.localProfile, input.user.id, input.user.email ?? null)
  }

  const keyByResource: Record<Exclude<OpsCustomerReadResource, 'me'>, string> = {
    contracts: 'contracts',
    sites: 'sites',
    invoices: 'invoices',
    documents: 'documents',
    'legal-acceptances': 'legal_acceptances',
    'powers-of-attorney': 'powers_of_attorney',
    events: 'events',
    'metering-values': 'metering_values',
    notifications: 'notifications',
  }
  const rows = canonicalResourceRows(value, keyByResource[resource])
  const mapped = rows.map((row) => {
    switch (resource) {
      case 'contracts': return mapOpsContract(row)
      case 'sites': return mapOpsSite(row)
      case 'invoices': return mapOpsInvoice(row)
      case 'documents': return mapOpsDocument(row)
      case 'legal-acceptances': return mapOpsLegalAcceptance(row)
      case 'powers-of-attorney': return mapOpsPowerOfAttorney(row)
      case 'events': return mapOpsEvent(row)
      case 'metering-values': return mapOpsMeteringValue(row)
      case 'notifications': return mapOpsNotification(row)
    }
  })
  return input.detail ? (mapped[0] ?? null) : mapped
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
  const canonicalData = normalizeCanonicalCustomerResource(resource, unwrapOpsData(payload), {
    localProfile: profile,
    user,
    detail: Boolean(opaqueId),
  })
  return {
    data: canonicalData,
    authoritative: true,
    read_only: false,
    data_freshness: 'live',
  }
}

export async function getCustomerPortalOverview(): Promise<CustomerPortalOverview> {
  const { supabase, user } = await getPortalSession()
  const localProfile = await getCustomerProfile(supabase, user.id, user)
  const identity = portalIdentityFromProfile(user, localProfile)

  const [tickets, bundle] = await Promise.all([
    getCustomerTickets(supabase, user.id),
    fetchOpsCustomerPortalBundle(identity),
  ])

  if (!bundle.profile) {
    throw new Error('OPS portal-bundle saknar den auktoritativa kundprofilen.')
  }

  const profile = mapOpsProfile(bundle.profile, localProfile, user.id, user.email ?? null)
  const contracts = bundle.contracts.map(mapOpsContract)
  const sites = bundle.sites.map(mapOpsSite)
  const invoices = bundle.invoices.map(mapOpsInvoice)
  const documents = bundle.documents.map(mapOpsDocument)
  const legalAcceptances = bundle.legalAcceptances.map(mapOpsLegalAcceptance)
  const powersOfAttorney = bundle.powersOfAttorney.map(mapOpsPowerOfAttorney)
  const customerStatus = mapCustomerStatus(bundle.customerStatus)
  const dataQuality = mapDataQuality(bundle.dataQuality)
  const switchStatus =
    mapOpsSwitchStatus(bundle.switchStatus) ??
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
    meteringValues: bundle.meteringValues.map(mapOpsMeteringValue),
    events: bundle.events.map(mapOpsEvent),
    tickets,
    notifications: bundle.notifications.map(mapOpsNotification),
    opsAvailable: true,
    opsError: null,
    authoritative: true,
    readOnly: false,
    dataFreshness: 'live',
    dataFreshnessMessage: null,
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
