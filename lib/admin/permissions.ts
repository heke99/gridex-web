import type { AdminContext } from './types'

export function hasPermission(
  ctx: AdminContext,
  permission: string
): boolean {
  if (ctx.isAdmin) return true
  return ctx.permissions.includes(permission)
}

export function requirePermission(
  ctx: AdminContext,
  permission: string
): void {

  if (!hasPermission(ctx, permission)) {
    throw new Error(`Missing permission: ${permission}`)
  }
}