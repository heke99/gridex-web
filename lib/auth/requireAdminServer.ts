import { requireAdminActionAccess } from '@/lib/admin/guards'

export async function requireAdminServer() {
  const ctx = await requireAdminActionAccess({ allOf: ['admin.access'] })

  return {
    id: ctx.userId,
    email: ctx.email,
  }
}
