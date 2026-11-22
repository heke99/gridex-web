import 'server-only'
import type { StaffApiClient } from '@/staff-api/client'

export async function listAssigneeOptions(api: StaffApiClient, page: number) {
  const response = await api.listUsers({ page, page_size: 100, status: 'active' })
  return {
    options: response.data.map(user => ({
      id: user.user_id,
      label: user.full_name ?? user.email ?? 'Medarbetare',
    })),
    nextPage: response.pagination.has_more ? response.pagination.page + 1 : null,
  }
}

export type AssigneeOptions = Awaited<ReturnType<typeof listAssigneeOptions>>
