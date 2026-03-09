import { redirect } from 'next/navigation'
import { getAdminContext, type AdminContext } from './getAdminContext'

export type AccessRule = {
  anyOf?: string[]
  allOf?: string[]
}

type PermissionSource = string[] | AdminContext

function permissionsOf(src: PermissionSource): string[] {
  return Array.isArray(src) ? src : src.permissions
}

export function canAccessByRule(
  src: PermissionSource,
  rule?: AccessRule
): boolean {
  if (!rule) return true

  const userPermissions = permissionsOf(src)

  if (rule.allOf) {
    if (!rule.allOf.every((permission) => userPermissions.includes(permission))) {
      return false
    }
  }

  if (rule.anyOf) {
    if (!rule.anyOf.some((permission) => userPermissions.includes(permission))) {
      return false
    }
  }

  return true
}

export async function requireAdminAccess(): Promise<AdminContext> {
  const ctx = await getAdminContext()

  if (!ctx.isAdmin) {
    redirect('/')
  }

  return ctx
}

export async function requireAdminPageAccess(
  rule?: AccessRule
): Promise<AdminContext> {
  const ctx = await requireAdminAccess()

  if (!canAccessByRule(ctx, rule)) {
    redirect('/admin')
  }

  return ctx
}

export async function requireAdminActionAccess(
  rule?: AccessRule
): Promise<AdminContext> {
  const ctx = await requireAdminAccess()

  if (!canAccessByRule(ctx, rule)) {
    throw new Error('Permission denied')
  }

  return ctx
}