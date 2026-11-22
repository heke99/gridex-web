export const CASE_PAGE_SIZE = 25
export type CaseSection = 'events' | 'attachments'

export function casePageHref(reference: string, section: CaseSection, cursor: string | null, search: string) {
  const query = new URLSearchParams(search)
  const key = `${section}_cursor`
  if (cursor) query.set(key, cursor)
  else query.delete(key)
  return `/cases/${encodeURIComponent(reference)}${query.size ? `?${query}` : ''}`
}
