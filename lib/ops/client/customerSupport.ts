import { OpsError } from '@/lib/ops/errors'
import type { components, paths } from '@/lib/ops/generated/customer-portal-api'
import { opsCustomerFetch, type OpsPortalIdentity } from './portal'

export type OpsCustomerSupportCase = components['schemas']['CustomerSupportCase']
export type OpsCustomerSupportCaseDetail = components['schemas']['CustomerSupportCaseDetail']
export type OpsCustomerSupportMessage = components['schemas']['CustomerSupportMessage']
export type OpsCustomerSupportCaseCreateInput = Pick<
  components['schemas']['CustomerSupportCaseCreateRequest'],
  'title' | 'message' | 'category'
>
export type OpsCustomerSupportMessageCreateInput = Pick<
  components['schemas']['CustomerSupportMessageCreateRequest'],
  'message'
>
export type OpsCustomerSupportCaseListResponse = paths['/api/v1/customer/support/cases']['get']['responses']['200']['content']['application/json']
export type OpsCustomerSupportCaseResponse = paths['/api/v1/customer/support/cases']['post']['responses']['201']['content']['application/json']
export type OpsCustomerSupportCaseDetailResponse = paths['/api/v1/customer/support/cases/{reference}']['get']['responses']['200']['content']['application/json']
export type OpsCustomerSupportMessageListResponse = paths['/api/v1/customer/support/cases/{reference}/messages']['get']['responses']['200']['content']['application/json']
export type OpsCustomerSupportMessageResponse = paths['/api/v1/customer/support/cases/{reference}/messages']['post']['responses']['201']['content']['application/json']

export type OpsCustomerSupportCaseListQuery = { limit?: number; cursor?: string }

const CASES_PATH = '/api/v1/customer/support/cases'
// Public references and retry keys use the frozen Customer Portal contract.
const PUBLIC_REFERENCE = /^[a-z][a-z0-9_]{1,31}_[A-Za-z0-9_-]{20,64}$/
const IDEMPOTENCY_KEY = /^[A-Za-z0-9._:+~-]{8,200}$/

function supportInputError(code: string, field: string): OpsError {
  return new OpsError('Ogiltig begäran för kundens supportärende.', 400, {
    code,
    field,
    endpoint: CASES_PATH,
    retryable: false,
  })
}

function requireClosedObject(value: unknown, allowed: readonly string[], code: string): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw supportInputError(code, 'body')
  }
  for (const field of Object.keys(value)) {
    if (!allowed.includes(field)) throw supportInputError(code, field)
  }
}

function casePath(reference: string): string {
  if (typeof reference !== 'string' || !PUBLIC_REFERENCE.test(reference)) {
    throw supportInputError('invalid_customer_support_reference', 'case_reference')
  }
  return `${CASES_PATH}/${encodeURIComponent(reference)}`
}

function writeHeaders(idempotencyKey: string): Headers {
  if (typeof idempotencyKey !== 'string' || !IDEMPOTENCY_KEY.test(idempotencyKey)) {
    throw supportInputError('invalid_customer_support_idempotency_key', 'Idempotency-Key')
  }
  return new Headers({ 'Idempotency-Key': idempotencyKey })
}

/** Identity comes from the tenant's verified Auth session, never from form data. */
export async function listOpsCustomerSupportCases(
  identity: OpsPortalIdentity,
  query: OpsCustomerSupportCaseListQuery = {},
): Promise<OpsCustomerSupportCaseListResponse> {
  requireClosedObject(query, ['limit', 'cursor'], 'invalid_customer_support_query')
  const search = new URLSearchParams()
  if (query.limit !== undefined) {
    if (!Number.isInteger(query.limit) || query.limit < 1 || query.limit > 100) {
      throw supportInputError('invalid_customer_support_query', 'limit')
    }
    search.set('limit', String(query.limit))
  }
  if (query.cursor !== undefined) {
    if (typeof query.cursor !== 'string') throw supportInputError('invalid_customer_support_query', 'cursor')
    search.set('cursor', query.cursor)
  }
  const suffix = search.size ? `?${search}` : ''
  return await opsCustomerFetch(`${CASES_PATH}${suffix}`, identity) as OpsCustomerSupportCaseListResponse
}

export async function fetchOpsCustomerSupportCase(
  identity: OpsPortalIdentity,
  caseReference: string,
): Promise<OpsCustomerSupportCaseDetailResponse> {
  return await opsCustomerFetch(casePath(caseReference), identity) as OpsCustomerSupportCaseDetailResponse
}

export async function listOpsCustomerSupportMessages(
  identity: OpsPortalIdentity,
  caseReference: string,
): Promise<OpsCustomerSupportMessageListResponse> {
  return await opsCustomerFetch(`${casePath(caseReference)}/messages`, identity) as OpsCustomerSupportMessageListResponse
}

/** Reuse the same key for retries of the same submitted operation. */
export async function createOpsCustomerSupportCase(
  identity: OpsPortalIdentity,
  input: OpsCustomerSupportCaseCreateInput,
  idempotencyKey: string,
): Promise<OpsCustomerSupportCaseResponse> {
  const headers = writeHeaders(idempotencyKey)
  requireClosedObject(input, ['title', 'message', 'category'], 'invalid_customer_support_request')
  return await opsCustomerFetch(CASES_PATH, identity, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: input.title,
      message: input.message,
      ...(input.category !== undefined ? { category: input.category } : {}),
    }),
  }) as OpsCustomerSupportCaseResponse
}

export async function sendOpsCustomerSupportMessage(
  identity: OpsPortalIdentity,
  caseReference: string,
  input: OpsCustomerSupportMessageCreateInput,
  idempotencyKey: string,
): Promise<OpsCustomerSupportMessageResponse> {
  const path = `${casePath(caseReference)}/messages`
  const headers = writeHeaders(idempotencyKey)
  requireClosedObject(input, ['message'], 'invalid_customer_support_request')
  return await opsCustomerFetch(path, identity, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message: input.message }),
  }) as OpsCustomerSupportMessageResponse
}
