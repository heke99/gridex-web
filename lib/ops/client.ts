import { createHash, randomUUID } from 'node:crypto'

export type OpsContractType =
  | 'variable_spot'
  | 'spot_hourly'
  | 'portfolio'
  | 'portfolio_managed'
  | 'fixed'
  | string

export type OpsPublicContract = {
  price_plan_id: string
  price_plan_version_id: string
  product_code: string
  name: string
  type: OpsContractType
  short_description?: string | null
  marketing_description?: string | null
  badge_text?: string | null
  monthly_fee_sek?: number | null
  invoice_fee_sek?: number | null
  markup_ore_per_kwh?: number | null
  variable_markup_ore_per_kwh?: number | null
  fixed_price_ore_per_kwh?: number | null
  terms_version?: string | null
  privacy_policy_version?: string | null
  cancellation_right_version?: string | null
  power_of_attorney_version?: string | null
  is_public?: boolean | null
  is_active?: boolean | null
  sort_order?: number | null
  raw?: Record<string, unknown>
}

export type OpsCustomerApplicationInput = {
  customer_type: 'private' | 'company'
  first_name?: string | null
  last_name?: string | null
  company_name?: string | null
  personal_number?: string | null
  organization_number?: string | null
  email: string
  phone: string
  address: string
  postal_code: string
  city: string
  apartment?: string | null
  facility_id?: string | null
  metering_point_id?: string | null
  requested_start_mode: 'asap' | 'specific_date'
  requested_start_date?: string | null
  price_plan_id: string
  price_plan_version_id: string
  product_code: string
  source: 'gridex_website'
  idempotency_key: string
  external_application_id: string
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  user_agent?: string | null
  ip_hash?: string | null
  consents: {
    terms: boolean
    privacy: boolean
    power_of_attorney: boolean
    cancellation_right: boolean
    supplier_switch: boolean
    terms_version?: string | null
    privacy_policy_version?: string | null
    cancellation_right_version?: string | null
    power_of_attorney_version?: string | null
  }
}

export type OpsCustomerApplicationResult = {
  status: string
  customer_id?: string | null
  customer_number?: string | null
  application_id?: string | null
  application_number?: string | null
  contract_id?: string | null
  contract_number?: string | null
  customer_site_id?: string | null
  metering_point_id?: string | null
  price_plan_id?: string | null
  price_plan_version_id?: string | null
  contract_price_snapshot_id?: string | null
  missing_fields: string[]
  next_step?: string | null
  message?: string | null
  raw?: Record<string, unknown>
}

export type OpsLegalText = {
  type: 'terms' | 'privacy_policy' | 'withdrawal' | 'power_of_attorney' | 'price_terms' | string
  version: string
  title: string
  body: string
  published_at?: string | null
  raw?: Record<string, unknown>
}

export type OpsPricePlan = {
  price_plan_id: string
  price_plan_version_id: string
  product_code: string
  name: string
  type: OpsContractType
  status?: string | null
  is_public?: boolean | null
  raw?: Record<string, unknown>
}

export type OpsCustomerDocument = Record<string, unknown>
export type OpsCustomerLegalAcceptance = Record<string, unknown>
export type OpsCustomerPowerOfAttorney = Record<string, unknown>
export type OpsCustomerSwitchStatus = Record<string, unknown> | null

export type OpsClientStatus = {
  configured: boolean
  liveSignupEnabled: boolean
  missing: string[]
}

class OpsError extends Error {
  status: number
  details?: unknown

  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.name = 'OpsError'
    this.status = status
    this.details = details
  }
}

function env(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value ? value : undefined
}

function opsBaseUrl(): string | undefined {
  const value = env('GRIDEX_OPS_API_URL')
  if (!value) return undefined
  return value.replace(/\/+$/, '')
}

export function getOpsClientStatus(): OpsClientStatus {
  const missing: string[] = []
  const baseUrl = opsBaseUrl()
  if (!baseUrl) missing.push('GRIDEX_OPS_API_URL')
  if (!env('GRIDEX_WEBSITE_API_KEY')) missing.push('GRIDEX_WEBSITE_API_KEY')

  let unsafeProductionUrl = false
  if (
    process.env.NODE_ENV === 'production' &&
    env('GRIDEX_ALLOW_UNSAFE_OPS_URL') !== 'true' &&
    baseUrl
  ) {
    try {
      const host = new URL(baseUrl).hostname
      unsafeProductionUrl =
        /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(baseUrl) ||
        /test|staging|preview/i.test(host)
    } catch {
      unsafeProductionUrl = true
    }
  }

  if (unsafeProductionUrl) {
    missing.push('GRIDEX_OPS_API_URL_PRODUCTION_GUARD')
  }

  return {
    configured: missing.length === 0,
    liveSignupEnabled: env('GRIDEX_ENABLE_LIVE_SIGNUP') === 'true',
    missing,
  }
}

function normalizeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function pickString(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const picked = normalizeText(row[key])
    if (picked) return picked
  }
  return null
}

function pickBoolean(row: Record<string, unknown>, keys: string[]): boolean | null {
  for (const key of keys) {
    if (typeof row[key] === 'boolean') return row[key] as boolean
  }
  return null
}

function mapPublicContract(row: unknown): OpsPublicContract | null {
  if (!row || typeof row !== 'object') return null
  const r = row as Record<string, unknown>

  const pricePlanId = pickString(r, ['price_plan_id', 'pricePlanId', 'id'])
  const pricePlanVersionId = pickString(r, [
    'price_plan_version_id',
    'pricePlanVersionId',
    'version_id',
    'pricing_version_id',
  ])
  const productCode =
    pickString(r, ['product_code', 'productCode', 'slug', 'code']) ?? pricePlanId
  const name = pickString(r, ['name', 'title', 'contract_name'])

  if (!pricePlanId || !pricePlanVersionId || !productCode || !name) return null

  return {
    price_plan_id: pricePlanId,
    price_plan_version_id: pricePlanVersionId,
    product_code: productCode,
    name,
    type: pickString(r, ['type', 'contract_type', 'product_type']) ?? 'variable_spot',
    short_description: pickString(r, ['short_description', 'shortDescription']),
    marketing_description: pickString(r, [
      'marketing_description',
      'description',
      'marketingDescription',
    ]),
    badge_text: pickString(r, ['badge_text', 'badgeText']),
    monthly_fee_sek: normalizeNumber(r.monthly_fee_sek ?? r.monthlyFeeSek),
    invoice_fee_sek: normalizeNumber(r.invoice_fee_sek ?? r.invoiceFeeSek),
    markup_ore_per_kwh: normalizeNumber(
      r.markup_ore_per_kwh ?? r.markupOrePerKwh ?? r.markup_ore
    ),
    variable_markup_ore_per_kwh: normalizeNumber(
      r.variable_markup_ore_per_kwh ??
        r.variableMarkupOrePerKwh ??
        r.variable_fee_ore
    ),
    fixed_price_ore_per_kwh: normalizeNumber(
      r.fixed_price_ore_per_kwh ?? r.fixedPriceOrePerKwh ?? r.fixed_price_ore
    ),
    terms_version: pickString(r, ['terms_version', 'termsVersion']),
    privacy_policy_version: pickString(r, [
      'privacy_policy_version',
      'privacyPolicyVersion',
    ]),
    cancellation_right_version: pickString(r, [
      'cancellation_right_version',
      'cancellationRightVersion',
    ]),
    power_of_attorney_version: pickString(r, [
      'power_of_attorney_version',
      'powerOfAttorneyVersion',
    ]),
    is_public: pickBoolean(r, ['is_public', 'isPublic']),
    is_active: pickBoolean(r, ['is_active', 'isActive']),
    sort_order: normalizeNumber(r.sort_order ?? r.sortOrder),
    raw: r,
  }
}

function extractRows(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== 'object') return []

  const p = payload as Record<string, unknown>
  if (Array.isArray(p.data)) return p.data
  if (Array.isArray(p.contracts)) return p.contracts
  if (Array.isArray(p.price_plans)) return p.price_plans
  if (Array.isArray(p.pricePlans)) return p.pricePlans
  if (Array.isArray(p.legal_texts)) return p.legal_texts
  if (Array.isArray(p.legalTexts)) return p.legalTexts
  if (Array.isArray(p.items)) return p.items
  return []
}

async function opsFetch(path: string, init?: RequestInit): Promise<unknown> {
  const baseUrl = opsBaseUrl()
  const apiKey = env('GRIDEX_WEBSITE_API_KEY')
  const tenantId = env('GRIDEX_WEBSITE_TENANT_ID')

  if (!baseUrl || !apiKey) {
    throw new OpsError('Tjänsten är inte tillgänglig just nu.', 503, {
      missing: getOpsClientStatus().missing,
    })
  }

  const headers = new Headers(init?.headers)
  headers.set('Accept', 'application/json')
  headers.set('Authorization', `Bearer ${apiKey}`)
  if (!headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json')
  }
  if (tenantId) {
    headers.set('X-Gridex-Tenant-Id', tenantId)
  }

  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  })

  let payload: unknown = null
  const contentType = res.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    payload = await res.json().catch(() => null)
  } else {
    const text = await res.text().catch(() => '')
    payload = text ? { message: text } : null
  }

  if (!res.ok) {
    const message =
      payload && typeof payload === 'object'
        ? String(
            (payload as Record<string, unknown>).message ??
              (payload as Record<string, unknown>).error ??
              'Tjänsten kunde inte slutföra åtgärden.'
          )
        : 'Tjänsten kunde inte slutföra åtgärden.'
    throw new OpsError(message, res.status, payload)
  }

  return payload
}

async function opsFetchWithFallback(paths: string[], init?: RequestInit): Promise<unknown> {
  let lastError: unknown = null

  for (const path of paths) {
    try {
      return await opsFetch(path, init)
    } catch (error) {
      lastError = error
      if (isOpsError(error) && error.status !== 404) {
        throw error
      }
    }
  }

  throw lastError instanceof Error ? lastError : new OpsError('Tjänsten kunde inte nås.', 502)
}

export async function fetchOpsPublicContracts(): Promise<OpsPublicContract[]> {
  const payload = await opsFetchWithFallback([
    '/api/v1/website/contracts',
    '/api/v1/website/public-contracts',
  ])
  return extractRows(payload)
    .map(mapPublicContract)
    .filter((item): item is OpsPublicContract => item !== null)
    .filter((item) => item.is_public !== false && item.is_active !== false)
    .sort((a, b) => {
      const sa = a.sort_order ?? 10_000
      const sb = b.sort_order ?? 10_000
      if (sa !== sb) return sa - sb
      return a.name.localeCompare(b.name, 'sv')
    })
}

function mapLegalText(row: unknown): OpsLegalText | null {
  if (!row || typeof row !== 'object') return null
  const r = row as Record<string, unknown>
  const type = pickString(r, ['type', 'text_type', 'legal_type'])
  const version = pickString(r, ['version', 'version_key', 'legal_version'])
  const title = pickString(r, ['title', 'name'])
  const body = pickString(r, ['body', 'content', 'text', 'markdown'])

  if (!type || !version || !title || !body) return null

  return {
    type,
    version,
    title,
    body,
    published_at: pickString(r, ['published_at', 'publishedAt']),
    raw: r,
  }
}

function mapPricePlan(row: unknown): OpsPricePlan | null {
  if (!row || typeof row !== 'object') return null
  const mapped = mapPublicContract(row)
  if (!mapped) return null
  const r = row as Record<string, unknown>
  return {
    price_plan_id: mapped.price_plan_id,
    price_plan_version_id: mapped.price_plan_version_id,
    product_code: mapped.product_code,
    name: mapped.name,
    type: mapped.type,
    status: pickString(r, ['status', 'version_status']),
    is_public: mapped.is_public,
    raw: r,
  }
}

export async function fetchOpsLegalTextsCurrent(): Promise<OpsLegalText[]> {
  const payload = await opsFetchWithFallback([
    '/api/v1/website/legal-texts/current',
    '/api/v1/website/legal-texts',
  ])
  return extractRows(payload)
    .map(mapLegalText)
    .filter((item): item is OpsLegalText => item !== null)
}

export async function fetchOpsPricePlans(): Promise<OpsPricePlan[]> {
  const payload = await opsFetchWithFallback([
    '/api/v1/website/price-plans',
    '/api/v1/website/contracts',
    '/api/v1/website/public-contracts',
  ])
  return extractRows(payload)
    .map(mapPricePlan)
    .filter((item): item is OpsPricePlan => item !== null)
}


export async function submitOpsCustomerApplication(
  input: OpsCustomerApplicationInput
): Promise<OpsCustomerApplicationResult> {
  if (env('GRIDEX_ENABLE_LIVE_SIGNUP') !== 'true') {
    throw new OpsError('Live-teckning är inte aktiverad för hemsidan.', 503)
  }

  const payload = await opsFetch('/api/v1/website/customer-applications', {
    method: 'POST',
    body: JSON.stringify(input),
  })

  const data =
    payload && typeof payload === 'object' && 'data' in payload
      ? ((payload as { data?: unknown }).data ?? payload)
      : payload

  const row = data && typeof data === 'object' ? (data as Record<string, unknown>) : {}

  const missing = Array.isArray(row.missing_fields)
    ? row.missing_fields.map(String)
    : Array.isArray(row.missingFields)
      ? row.missingFields.map(String)
      : []

  return {
    status: pickString(row, ['status']) ?? 'application_received',
    customer_id: pickString(row, ['customer_id', 'customerId']),
    customer_number: pickString(row, ['customer_number', 'customerNumber']),
    application_id: pickString(row, ['application_id', 'applicationId']),
    application_number: pickString(row, ['application_number', 'applicationNumber']),
    contract_id: pickString(row, ['contract_id', 'contractId']),
    contract_number: pickString(row, ['contract_number', 'contractNumber']),
    customer_site_id: pickString(row, ['customer_site_id', 'customerSiteId']),
    metering_point_id: pickString(row, ['metering_point_id', 'meteringPointId']),
    price_plan_id: pickString(row, ['price_plan_id', 'pricePlanId']),
    price_plan_version_id: pickString(row, [
      'price_plan_version_id',
      'pricePlanVersionId',
    ]),
    contract_price_snapshot_id: pickString(row, [
      'contract_price_snapshot_id',
      'contractPriceSnapshotId',
    ]),
    missing_fields: missing,
    next_step: pickString(row, ['next_step', 'nextStep']),
    message: pickString(row, ['message']),
    raw: row,
  }
}


export type OpsPortalIdentity = {
  userId: string
  email?: string | null
  customerNumber?: string | null
}

export type OpsPortalBundle = {
  profile: Record<string, unknown> | null
  contracts: Record<string, unknown>[]
  sites: Record<string, unknown>[]
  invoices: Record<string, unknown>[]
  documents: Record<string, unknown>[]
  legalAcceptances: Record<string, unknown>[]
  powersOfAttorney: Record<string, unknown>[]
  switchStatus: Record<string, unknown> | null
  events: Record<string, unknown>[]
  meteringValues: Record<string, unknown>[]
}

function portalHeaders(identity: OpsPortalIdentity): Headers {
  const headers = new Headers()
  headers.set('X-Gridex-Portal-User-Id', identity.userId)
  if (identity.email) headers.set('X-Gridex-Customer-Email', identity.email)
  if (identity.customerNumber) {
    headers.set('X-Gridex-Customer-Number', identity.customerNumber)
  }
  return headers
}

async function opsCustomerFetch(
  path: string,
  identity: OpsPortalIdentity,
  init?: RequestInit
): Promise<unknown> {
  const headers = new Headers(init?.headers)
  portalHeaders(identity).forEach((value, key) => headers.set(key, value))
  return opsFetch(path, { ...init, headers })
}

function firstObject(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== 'object') return null
  const p = payload as Record<string, unknown>
  const data = p.data
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return data as Record<string, unknown>
  }
  if (Array.isArray(data) && data[0] && typeof data[0] === 'object') {
    return data[0] as Record<string, unknown>
  }
  return p
}

function rowsAsObjects(payload: unknown): Record<string, unknown>[] {
  return extractRows(payload).filter(
    (item): item is Record<string, unknown> =>
      Boolean(item && typeof item === 'object' && !Array.isArray(item))
  )
}

async function customerRows(path: string, identity: OpsPortalIdentity): Promise<Record<string, unknown>[]> {
  try {
    return await opsCustomerFetch(path, identity).then(rowsAsObjects)
  } catch (error) {
    if (isOpsError(error) && error.status === 404) return []
    throw error
  }
}

async function customerObject(
  path: string,
  identity: OpsPortalIdentity
): Promise<Record<string, unknown> | null> {
  try {
    return await opsCustomerFetch(path, identity).then(firstObject)
  } catch (error) {
    if (isOpsError(error) && error.status === 404) return null
    throw error
  }
}

export async function fetchOpsCustomerPortalBundle(
  identity: OpsPortalIdentity
): Promise<OpsPortalBundle> {
  const [
    profile,
    contracts,
    sites,
    invoices,
    documents,
    legalAcceptances,
    powersOfAttorney,
    switchStatus,
    events,
    meteringValues,
  ] = await Promise.all([
    customerObject('/api/v1/customer/me', identity),
    customerRows('/api/v1/customer/contracts', identity),
    customerRows('/api/v1/customer/sites', identity),
    customerRows('/api/v1/customer/invoices', identity),
    customerRows('/api/v1/customer/documents', identity),
    customerRows('/api/v1/customer/legal-acceptances', identity),
    customerRows('/api/v1/customer/powers-of-attorney', identity),
    customerObject('/api/v1/customer/switch-status', identity),
    customerRows('/api/v1/customer/events', identity),
    customerRows('/api/v1/customer/metering-values', identity),
  ])

  return {
    profile,
    contracts,
    sites,
    invoices,
    documents,
    legalAcceptances,
    powersOfAttorney,
    switchStatus,
    events,
    meteringValues,
  }
}

export async function sendOpsCustomerEvent(
  identity: OpsPortalIdentity,
  event: {
    event_type: string
    source: 'gridex_website'
    entity_type?: string | null
    entity_id?: string | null
    metadata?: Record<string, unknown>
  }
): Promise<void> {
  await opsCustomerFetch('/api/v1/customer/events', identity, {
    method: 'POST',
    body: JSON.stringify(event),
  })
}

export function hashIp(ip: string | null): string | null {
  if (!ip) return null
  const pepper = env('GRIDEX_WEBSITE_HASH_PEPPER') ?? env('PII_HASH_PEPPER') ?? ''
  return createHash('sha256').update(`${pepper}:${ip}`).digest('hex')
}

export function createApplicationIdempotencyKey(parts: string[]): string {
  return createHash('sha256')
    .update(parts.map((p) => p.trim().toLowerCase()).join('|'))
    .digest('hex')
}

export function createExternalApplicationId(): string {
  const prefix = env('GRIDEX_WEBSITE_APPLICATION_PREFIX') ?? 'GRIDEX-WEB'
  return `${prefix}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomUUID()}`
}

export function isOpsError(err: unknown): err is OpsError {
  return err instanceof OpsError
}
