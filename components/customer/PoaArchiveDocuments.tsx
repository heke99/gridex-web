import PoaArchivePages from '@/components/customer/PoaArchivePages'
import { getCustomerPoaArchives } from '@/lib/customerPortal/poaArchive'
import { poaArchiveDownloadPath, type PoaArchiveList } from '@/lib/ops/client/poaArchive'
import { isOpsError } from '@/lib/ops/errors'

export async function loadPoaArchiveDocuments(cursor?: string | string[]): Promise<PoaArchiveList | null> {
  try {
    if (Array.isArray(cursor)) throw new Error('Repeated archive cursor')
    return await getCustomerPoaArchives({ limit: 20, ...(cursor ? { cursor } : {}) })
  } catch (error) {
    console.error('[customer portal] POA archive unavailable', isOpsError(error)
      ? { status: error.status, code: error.code, requestId: error.requestId } : { code: 'poa_archive_unavailable' })
    return null
  }
}

export default async function PoaArchiveDocuments({ data, documentCursor }: { data: Promise<PoaArchiveList | null>; documentCursor?: string }) {
  const result = await data
  return <PoaArchivePages documentCursor={documentCursor} initialPage={result && {
    data: result.data.map(item => ({ ...item, download_url: poaArchiveDownloadPath(item) })),
    page: result.page,
  }} />
}
