import { getPortalSession } from '@/lib/customerPortal/service'
import { listPoaArchives, readPoaArchive, type PoaArchiveQuery } from '@/lib/ops/client/poaArchive'

export async function getCustomerPoaArchives(query: PoaArchiveQuery = {}) {
  const { user } = await getPortalSession()
  return listPoaArchives({ userId: user.id }, query)
}
export async function getCustomerPoaArchive(reference: string, query: { format?: 'json' | 'pdf'; sha256?: string } = {}) {
  const { user } = await getPortalSession()
  return readPoaArchive({ userId: user.id }, reference, query)
}
