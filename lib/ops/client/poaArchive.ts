import type { OpsPortalIdentity } from './portal'
import { opsRequest } from '@/lib/ops/transport'
import { OpsError } from '@/lib/ops/errors'
import { assertPoaArchiveRequest, assertPoaArchiveResponse, POA_ARCHIVE_PATH } from '@/lib/ops/validators/poaArchive'

export type PoaArchiveSummary = {
  power_of_attorney_reference: string
  verification_reference: string | null
  consent_status: string | null
  archive_status: 'missing' | 'incomplete_evidence' | 'archived_unverified' | 'unavailable'
  archived_sha256: string | null
  download_url: string | null
}
export type PoaArchiveList = {
  data: PoaArchiveSummary[]
  page: { limit: number; offset: 0; returned: number; has_more: boolean; next_cursor: string | null }
  request_id: string
  contract_schema_version: string
}
export type PoaArchiveQuery = { limit?: number; cursor?: string }

function validReference(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/.test(value)
    && !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value)
}
function detailPath(reference: string): string {
  if (!validReference(reference)) throw new OpsError('Ogiltig verifikationsreferens.', 400, { code: 'invalid_verification_reference', retryable: false })
  return `${POA_ARCHIVE_PATH}/${encodeURIComponent(reference)}`
}
function headers(identity: OpsPortalIdentity) {
  return new Headers({ 'x-gridex-customer-portal-user-id': identity.userId, 'x-gridex-auth-user-id': identity.userId })
}
export function poaArchiveDownloadPath(item: Pick<PoaArchiveSummary, 'download_url' | 'verification_reference'>): string | null {
  return item.download_url && validReference(item.verification_reference)
    ? `/api/web/customer/powers-of-attorney/evidence/${encodeURIComponent(item.verification_reference)}?format=pdf` : null
}

export async function listPoaArchives(identity: OpsPortalIdentity, query: PoaArchiveQuery = {}): Promise<PoaArchiveList> {
  const search = new URLSearchParams()
  if (query.limit !== undefined) search.set('limit', String(query.limit))
  if (query.cursor !== undefined) search.set('cursor', query.cursor)
  const path = `${POA_ARCHIVE_PATH}${search.size ? `?${search}` : ''}`
  const response = await opsRequest(path, { headers: headers(identity) }, { validateRequest: h => assertPoaArchiveRequest(path, h) })
  assertPoaArchiveResponse(response.payload, 'list')
  const result = response.payload as PoaArchiveList
  if (result.data.some(item => item.verification_reference !== null && !validReference(item.verification_reference))) {
    throw new OpsError('Fullmaktens referens kunde inte verifieras.', 502, { code: 'poa_archive_response_invalid', retryable: false })
  }
  return result
}

export async function readPoaArchive(identity: OpsPortalIdentity, reference: string, query: { format?: 'json' | 'pdf'; sha256?: string } = {}) {
  const search = new URLSearchParams()
  if (query.format !== undefined) search.set('format', query.format)
  if (query.sha256 !== undefined) search.set('sha256', query.sha256)
  if (query.format === 'pdf' && query.sha256 !== undefined) throw new OpsError('Kontrollsummejämförelse kräver JSON.', 400, { code: 'invalid_poa_archive_request', retryable: false })
  const path = `${detailPath(reference)}${search.size ? `?${search}` : ''}`
  const response = await opsRequest(path, { headers: headers(identity) }, {
    validateRequest: h => assertPoaArchiveRequest(path, h),
    ...(query.format === 'pdf' ? { responseFormat: 'poa-archive' as const } : {}),
  })
  if (query.format !== 'pdf') {
    assertPoaArchiveResponse(response.payload, 'detail')
    const result = response.payload as { data: { verification_reference: string; [key: string]: unknown }; request_id: string; contract_schema_version: string }
    if (result.data.verification_reference !== reference) invalidPdf()
    return { format: 'json' as const, value: result }
  }
  const bytes = response.payload as Uint8Array
  // OPS qualifies PDF structure before returning 200. Preserve all originals
  // accepted by that canonical reader, including legal leading/trailing bytes;
  // the transport independently checks the exact bytes, digest, MIME and bound.
  if (response.headers.get('x-gridex-verification-reference') !== reference) invalidPdf()
  return { format: 'pdf' as const, bytes, reference, sha256: response.headers.get('x-gridex-document-sha256')! }
}
function invalidPdf(): never {
  throw new OpsError('Fullmaktens arkiverade original kunde inte verifieras.', 502, { code: 'poa_archive_response_invalid', retryable: false })
}
