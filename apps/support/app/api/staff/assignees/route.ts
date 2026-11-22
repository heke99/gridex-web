import { StaffApiError } from '@/staff-api/client'
import { listAssigneeOptions } from '@/support/lib/assignees'
import { requireSupportSession } from '@/support/lib/session'

const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }

export async function GET(request: Request) {
  const { api } = await requireSupportSession()
  const query = new URL(request.url).searchParams
  const page = query.get('page')
  if (query.size !== 1 || !page || !/^[1-9]\d{0,5}$/.test(page)) {
    return Response.json({ error: 'Ogiltig sida.' }, { status: 400, headers })
  }

  try {
    return Response.json(await listAssigneeOptions(api, Number(page)), { headers })
  } catch (error) {
    if (error instanceof StaffApiError) {
      return Response.json({ error: 'Medarbetarna kunde inte hämtas.' }, { status: error.status, headers })
    }
    throw error
  }
}
