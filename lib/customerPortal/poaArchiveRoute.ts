import { getPortalSession } from '@/lib/customerPortal/service'
import { listPoaArchives, readPoaArchive, poaArchiveDownloadPath } from '@/lib/ops/client/poaArchive'
import { customerApiErrorResponse } from '@/lib/customerPortal/apiErrors'
import { privateJsonResponse, PRIVATE_NO_STORE_HEADERS } from '@/lib/api/webBoundary'
import { OpsError } from '@/lib/ops/errors'

function query(request: Request, allowed: string[]): URLSearchParams {
  const params = new URL(request.url).searchParams
  for (const key of params.keys()) if (!allowed.includes(key) || params.getAll(key).length !== 1) invalid(key)
  return params
}
function invalid(field: string): never {
  throw new OpsError('Ogiltig begäran för fullmaktsdokument.', 400, { code: 'invalid_poa_archive_request', field, retryable: false })
}
export async function customerPoaArchiveListResponse(request: Request) {
  try {
    const { user } = await getPortalSession()
    const params = query(request, ['limit', 'cursor']), rawLimit = params.get('limit')
    if (rawLimit !== null && !/^[1-9]\d{0,2}$/.test(rawLimit)) invalid('limit')
    const result = await listPoaArchives({ userId: user.id }, {
      ...(rawLimit !== null ? { limit: Number(rawLimit) } : {}),
      ...(params.has('cursor') ? { cursor: params.get('cursor')! } : {}),
    })
    return privateJsonResponse({ ...result, data: result.data.map(item => ({ ...item, download_url: poaArchiveDownloadPath(item) })) })
  } catch (error) {
    return customerApiErrorResponse(error, { logLabel: 'POA archive list', fallbackMessage: 'Fullmakterna kunde inte hämtas just nu.' })
  }
}
export async function customerPoaArchiveDetailResponse(request: Request, reference: string) {
  try {
    const { user } = await getPortalSession()
    const params = query(request, ['format', 'sha256']), format = params.get('format') ?? 'json'
    if (format !== 'json' && format !== 'pdf') invalid('format')
    const result = await readPoaArchive({ userId: user.id }, reference, { format,
      ...(params.has('sha256') ? { sha256: params.get('sha256')! } : {}),
    })
    if (result.format === 'json') return privateJsonResponse({ ...result.value,
      data: { ...result.value.data, download_url: poaArchiveDownloadPath({
        verification_reference: result.value.data.verification_reference,
        download_url: typeof result.value.data.download_url === 'string' ? result.value.data.download_url : null,
      }) },
    })
    // Complete digest/reference validation happens before response creation.
    let offset = 0
    const stream = new ReadableStream<Uint8Array>({ pull(controller) {
      const end = Math.min(offset + 64 * 1024, result.bytes.length)
      controller.enqueue(result.bytes.slice(offset, end)); offset = end
      if (offset === result.bytes.length) controller.close()
    } })
    return new Response(stream, { headers: { ...PRIVATE_NO_STORE_HEADERS, 'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="fullmakt-${result.reference}.pdf"`,
      'X-Gridex-Document-SHA256': result.sha256, 'X-Gridex-Verification-Reference': result.reference } })
  } catch (error) {
    return customerApiErrorResponse(error, { logLabel: 'POA archive detail', fallbackMessage: 'Fullmakten kunde inte hämtas just nu.' })
  }
}
