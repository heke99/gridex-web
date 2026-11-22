import { requireSupportSession } from '@/support/lib/session'
import { CASE_PAGE_SIZE } from '@/support/lib/case-pages'
import { StaffApiError } from '@/staff-api/client'

const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }

export async function GET(request: Request, { params }: {
  params: Promise<{ reference: string; section: string }>
}) {
  const { api } = await requireSupportSession()
  const { reference, section } = await params
  if (section !== 'events' && section !== 'attachments') {
    return Response.json({ error: 'Listan finns inte.' }, { status: 404, headers })
  }

  const search = new URL(request.url).searchParams
  const cursor = search.get('cursor')
  const options = { limit: CASE_PAGE_SIZE, ...(cursor !== null && { cursor }) }
  if ([...search].length > (cursor === null ? 0 : 1)) {
    return Response.json({ error: 'Ogiltig sidmarkör.' }, { status: 400, headers })
  }

  try {
    const result = section === 'events'
      ? await api.listEvents(reference, options)
      : await api.listAttachments(reference, options)
    return Response.json({ data: result.data, page: result.page }, { headers })
  } catch (error) {
    if (error instanceof StaffApiError) {
      return Response.json({ error: 'Sidan kunde inte hämtas.' }, { status: error.status, headers })
    }
    throw error
  }
}
