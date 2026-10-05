import 'server-only'
import { createHash, randomUUID } from 'node:crypto'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import contract from './contract.json'
import { signStaffAssertion, type StaffIdentityBinding } from './assertion'
import { readStaffApiConfig, requireStaffSubject, validateStaffApiConfig, STAFF_API_BASE_URL, STAFF_SUBJECT_UUID, type StaffApiConfig } from './config'
import { StaffApiError } from './errors'
import type {
  StaffCaseQuery, StaffCursorQuery, StaffUserQuery, StaffCustomerQuery, StaffDownloadedAttachment,
  StaffContactChangeRequest, StaffIdentityChangeRequest, StaffInviteRequest, StaffRoleChangeRequest, StaffDisableRequest,
  getApiV1StaffCustomersRefResponse, patchApiV1StaffCustomersRefContactResponse, postApiV1StaffCustomersRefIdentityChangeResponse,
  getApiV1StaffRolesResponse, postApiV1StaffUsersResponse, patchApiV1StaffUsersIdResponse,
  postApiV1StaffUsersIdDisableResponse, postApiV1StaffUsersIdEnableResponse,
  StaffCaseCreateRequest, StaffMessageRequest, StaffNoteRequest, StaffPhoneRequest, StaffStatusRequest, StaffAssigneeRequest,
  getApiV1StaffCasesResponse, getApiV1StaffCasesReferenceResponse, getApiV1StaffCasesReferenceEventsResponse,
  getApiV1StaffCasesReferenceAttachmentsResponse, getApiV1StaffUsersResponse, getApiV1StaffCustomersResponse,
  postApiV1StaffCasesResponse, postApiV1StaffCasesReferenceMessagesResponse, postApiV1StaffCasesReferenceNotesResponse,
  postApiV1StaffCasesReferencePhoneInteractionsResponse, patchApiV1StaffCasesReferenceStatusResponse,
  patchApiV1StaffCasesReferenceAssigneeResponse,
} from './types'

export { StaffApiError } from './errors'
export type { StaffApiConfig } from './config'
export type * from './types'

const MAX_JSON_BYTES = 2 * 1024 * 1024
const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024
const REFERENCE = /^[a-z][a-z0-9_]{1,31}_[A-Za-z0-9_-]{20,64}$/
const ajv = new Ajv({ strict: false, allowUnionTypes: true })
addFormats(ajv)
const validators = new Map<string, ReturnType<typeof ajv.compile>>()

function matches(schema: string, value: unknown): boolean {
  let validate = validators.get(schema)
  if (!validate) {
    validate = ajv.compile({ $ref: `#/components/schemas/${schema}`, components: contract.components })
    validators.set(schema, validate)
  }
  return validate(value) === true
}
function invalidInput(): never { throw new StaffApiError(422, 'staff_api_invalid_input') }
function invalidResponse(requestId: string | null = null): never { throw new StaffApiError(502, 'staff_api_response_invalid', requestId) }
function reference(value: string): string {
  if (typeof value !== 'string' || !REFERENCE.test(value)) invalidInput()
  return value
}
function targetUser(value: string): string {
  if (typeof value !== 'string' || !STAFF_SUBJECT_UUID.test(value)) invalidInput()
  return value
}
function safeIdentifier(value: unknown): string | null {
  return typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,128}$/.test(value) ? value : null
}
function queryString(input: object, allowed: readonly string[]): string {
  const values = new URLSearchParams()
  for (const [key, value] of Object.entries(input)) {
    if (!allowed.includes(key)) invalidInput()
    if (value === undefined || value === null) continue
    if (typeof value !== 'string' && typeof value !== 'number') invalidInput()
    if (typeof value === 'number' && (!Number.isInteger(value) || value < 1 || value > (key === 'page' ? 1_000_000 : 100))) invalidInput()
    if (typeof value === 'string' && (value.length > (key === 'cursor' ? 8192 : key === 'q' ? 200 : 180) || /[\u0000-\u001f\u007f]/.test(value))) invalidInput()
    if (key === 'customer_reference') reference(String(value))
    values.set(key, String(value))
  }
  return values.size ? `?${values.toString()}` : ''
}
function idempotency(value: string): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/.test(value)) invalidInput()
  return value
}
async function boundedBody(response: Response, maximum: number): Promise<Uint8Array> {
  const length = response.headers.get('content-length')
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > maximum)) invalidResponse()
  if (!response.body) return new Uint8Array()
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const result = await reader.read()
      if (result.done) break
      size += result.value.length
      if (size > maximum) { await reader.cancel(); invalidResponse() }
      chunks.push(result.value)
    }
  } finally { reader.releaseLock() }
  const body = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length }
  return body
}

export type StaffApiDependencies = { config?: StaffApiConfig; fetchImpl?: typeof fetch; now?: () => Date; binding?: StaffIdentityBinding }

/** Bind to a server-resolved central actor and its explicit tenant Auth binding. */
export function createStaffApiClient(verifiedSubject: string, dependencies: StaffApiDependencies = {}) {
  requireStaffSubject(verifiedSubject)
  const config = dependencies.config ? validateStaffApiConfig(dependencies.config) : readStaffApiConfig()
  const fetchImpl = dependencies.fetchImpl ?? fetch

  async function request<T>(path: string, schema: string | null, method = 'GET', body?: unknown, key?: string): Promise<T> {
    // No public raw URL/path method exists. All paths below are literal staff routes
    // with validated opaque references and URLSearchParams-encoded query values.
    const assertion = signStaffAssertion(config, verifiedSubject, dependencies.now?.() ?? new Date(), dependencies.binding)
    const headers = new Headers({ Accept: schema === null ? 'application/pdf, image/png, image/jpeg' : 'application/json',
      Authorization: `Bearer ${config.apiKey}`, 'x-gridex-staff-assertion': assertion, 'x-request-id': randomUUID(), 'x-gridex-expected-project-ref': config.opsProjectRef })
    if (body !== undefined) headers.set('Content-Type', 'application/json')
    if (key !== undefined) headers.set('Idempotency-Key', idempotency(key))
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), config.timeoutMs)
    try {
      // Every invocation is submitted once. In particular, writes never retry and
      // any future retry must sign a new assertion rather than replay its jti.
      const response = await fetchImpl(`${STAFF_API_BASE_URL}${path}`, { method, headers, cache: 'no-store', redirect: 'manual',
        signal: controller.signal, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
      const requestId = safeIdentifier(response.headers.get('x-request-id'))
      if (response.status >= 300 && response.status < 400) throw new StaffApiError(502, 'staff_api_redirect_blocked', requestId)
      if (response.ok && response.headers.get('x-gridex-project-ref') !== config.opsProjectRef) throw new StaffApiError(503, 'staff_storage_target_unverified', requestId)
      const mimeType = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase()
      if (response.ok && schema === null) {
        if (!['application/pdf', 'image/png', 'image/jpeg'].includes(mimeType ?? '')) invalidResponse(requestId)
        const bytes = await boundedBody(response, MAX_ATTACHMENT_BYTES)
        const sha256 = response.headers.get('x-gridex-sha256')
        if (!bytes.length || !sha256 || !/^[0-9a-f]{64}$/.test(sha256) || createHash('sha256').update(bytes).digest('hex') !== sha256) invalidResponse(requestId)
        const disposition = response.headers.get('content-disposition')
        const contentDisposition = disposition && disposition.length <= 1024 && !/[\u0000-\u001f\u007f]/.test(disposition) && disposition.startsWith('attachment;') ? disposition : null
        return { bytes, mimeType, sha256, requestId, contentDisposition } as T
      }
      if (mimeType !== 'application/json') invalidResponse(requestId)
      let payload: unknown
      try { payload = JSON.parse(Buffer.from(await boundedBody(response, MAX_JSON_BYTES)).toString('utf8')) }
      catch (error) { if (error instanceof StaffApiError) throw error; invalidResponse(requestId) }
      if (!response.ok) {
        const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
        const nested = record.error && typeof record.error === 'object' ? record.error as Record<string, unknown> : {}
        const code = typeof nested.code === 'string' && /^[a-z][a-z0-9_]{0,95}$/.test(nested.code) ? nested.code : 'staff_api_request_failed'
        throw new StaffApiError(response.status, code, requestId ?? safeIdentifier(record.request_id), nested.retryable === true)
      }
      if (!schema || !matches(schema, payload)) invalidResponse(requestId)
      const result = payload as { data?: unknown; page?: { limit: number; returned: number; has_more: boolean; next_cursor: string | null } }
      if (result.page && (!Array.isArray(result.data) || result.page.returned !== result.data.length || result.page.returned > result.page.limit
        || (result.page.has_more ? !result.page.next_cursor : result.page.next_cursor !== null))) invalidResponse(requestId)
      return payload as T
    } catch (error) {
      if (error instanceof StaffApiError) throw error
      throw new StaffApiError(controller.signal.aborted ? 504 : 503, controller.signal.aborted ? 'staff_api_timeout' : 'staff_api_unavailable', null, true)
    } finally { clearTimeout(timer) }
  }
  function command<T>(path: string, requestSchema: string, responseSchema: string, method: string, payload: unknown, key: string) {
    if (!matches(requestSchema, payload)) invalidInput()
    return request<T>(path, responseSchema, method, payload, idempotency(key))
  }

  return {
    listCases: async (query: StaffCaseQuery = {}) => request<getApiV1StaffCasesResponse>(`/cases${queryString(query, ['limit', 'cursor', 'status', 'customer_reference', 'query'])}`, 'getApiV1StaffCasesResponse'),
    getCase: async (value: string) => request<getApiV1StaffCasesReferenceResponse>(`/cases/${reference(value)}`, 'getApiV1StaffCasesReferenceResponse'),
    listEvents: async (value: string, query: StaffCursorQuery = {}) => request<getApiV1StaffCasesReferenceEventsResponse>(`/cases/${reference(value)}/events${queryString(query, ['limit', 'cursor'])}`, 'getApiV1StaffCasesReferenceEventsResponse'),
    listAttachments: async (value: string, query: StaffCursorQuery = {}) => request<getApiV1StaffCasesReferenceAttachmentsResponse>(`/cases/${reference(value)}/attachments${queryString(query, ['limit', 'cursor'])}`, 'getApiV1StaffCasesReferenceAttachmentsResponse'),
    downloadAttachment: async (value: string, attachment: string) => request<StaffDownloadedAttachment>(`/cases/${reference(value)}/attachments/${reference(attachment)}/file`, null),
    searchCustomers: async (query: StaffCustomerQuery = {}) => request<getApiV1StaffCustomersResponse>(`/customers${queryString(query, ['q', 'page', 'page_size', 'status', 'customer_type'])}`, 'getApiV1StaffCustomersResponse'),
    listUsers: async (query: StaffUserQuery = {}) => request<getApiV1StaffUsersResponse>(`/users${queryString(query, ['page', 'page_size', 'status'])}`, 'getApiV1StaffUsersResponse'),
    getCustomer: async (value: string) => request<getApiV1StaffCustomersRefResponse>(`/customers/${reference(value)}`, 'getApiV1StaffCustomersRefResponse'),
    updateContact: async (value: string, payload: StaffContactChangeRequest, key: string) => command<patchApiV1StaffCustomersRefContactResponse>(`/customers/${reference(value)}/contact`, 'StaffContactChangeRequest', 'patchApiV1StaffCustomersRefContactResponse', 'PATCH', payload, key),
    requestIdentityChange: async (value: string, payload: StaffIdentityChangeRequest, key: string) => command<postApiV1StaffCustomersRefIdentityChangeResponse>(`/customers/${reference(value)}/identity-change`, 'StaffIdentityChangeRequest', 'postApiV1StaffCustomersRefIdentityChangeResponse', 'POST', payload, key),
    listRoles: async () => request<getApiV1StaffRolesResponse>('/roles', 'getApiV1StaffRolesResponse'),
    inviteUser: async (payload: StaffInviteRequest, key: string) => command<postApiV1StaffUsersResponse>('/users', 'StaffInviteRequest', 'postApiV1StaffUsersResponse', 'POST', payload, key),
    changeUserRole: async (value: string, payload: StaffRoleChangeRequest, key: string) => command<patchApiV1StaffUsersIdResponse>(`/users/${targetUser(value)}`, 'StaffRoleChangeRequest', 'patchApiV1StaffUsersIdResponse', 'PATCH', payload, key),
    disableUser: async (value: string, payload: StaffDisableRequest, key: string) => command<postApiV1StaffUsersIdDisableResponse>(`/users/${targetUser(value)}/disable`, 'StaffDisableRequest', 'postApiV1StaffUsersIdDisableResponse', 'POST', payload, key),
    enableUser: async (value: string, key: string) => command<postApiV1StaffUsersIdEnableResponse>(`/users/${targetUser(value)}/enable`, 'StaffEnableRequest', 'postApiV1StaffUsersIdEnableResponse', 'POST', {}, key),
    createCase: async (payload: StaffCaseCreateRequest, key: string) => command<postApiV1StaffCasesResponse>('/cases', 'StaffCaseCreateRequest', 'postApiV1StaffCasesResponse', 'POST', payload, key),
    reply: async (value: string, payload: StaffMessageRequest, key: string) => command<postApiV1StaffCasesReferenceMessagesResponse>(`/cases/${reference(value)}/messages`, 'StaffMessageRequest', 'postApiV1StaffCasesReferenceMessagesResponse', 'POST', payload, key),
    addNote: async (value: string, payload: StaffNoteRequest, key: string) => command<postApiV1StaffCasesReferenceNotesResponse>(`/cases/${reference(value)}/notes`, 'StaffNoteRequest', 'postApiV1StaffCasesReferenceNotesResponse', 'POST', payload, key),
    logPhone: async (value: string, payload: StaffPhoneRequest, key: string) => command<postApiV1StaffCasesReferencePhoneInteractionsResponse>(`/cases/${reference(value)}/phone-interactions`, 'StaffPhoneRequest', 'postApiV1StaffCasesReferencePhoneInteractionsResponse', 'POST', payload, key),
    setStatus: async (value: string, payload: StaffStatusRequest, key: string) => command<patchApiV1StaffCasesReferenceStatusResponse>(`/cases/${reference(value)}/status`, 'StaffStatusRequest', 'patchApiV1StaffCasesReferenceStatusResponse', 'PATCH', payload, key),
    setAssignee: async (value: string, payload: StaffAssigneeRequest, key: string) => command<patchApiV1StaffCasesReferenceAssigneeResponse>(`/cases/${reference(value)}/assignee`, 'StaffAssigneeRequest', 'patchApiV1StaffCasesReferenceAssigneeResponse', 'PATCH', payload, key),
  }
}
export type StaffApiClient = ReturnType<typeof createStaffApiClient>
