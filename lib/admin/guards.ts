import { redirect } from 'next/navigation'
import { getAdminContext, type AdminContext } from './getAdminContext'
import { AccessDeniedError, assertActionAccess, canAccessByRule, canEnterAdminConsole, normalizePermissions, type AccessRule } from './access'
import { supabaseService } from '@/lib/supabase/service'
export { canAccessByRule, type AccessRule } from './access'

export async function requireAdminAccess(): Promise<AdminContext> {
  const ctx = await getAdminContext()

  if (!ctx.userId) redirect('/login?next=/admin')
  if (!canEnterAdminConsole(ctx.permissions)) {
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
  const ctx = await getAdminContext()
  assertActionAccess(ctx, rule)
  return ctx
}

/** Global directories and Auth Admin operations require an actual global grant. */
export async function requireGlobalAdminActionAccess(rule: AccessRule): Promise<AdminContext> {
  const ctx = await getAdminContext()
  if (!ctx.userId) throw new AccessDeniedError(401)
  const { data, error } = await supabaseService.rpc('gridex_get_user_permissions', {
    p_user_id: ctx.userId, p_company_id: null,
  })
  if (error) throw new Error('Could not verify global authorization')
  const permissions = normalizePermissions(data)
  assertActionAccess({ userId: ctx.userId, permissions }, rule)
  return { ...ctx, permissions, isAdmin: canEnterAdminConsole(permissions) }
}

export async function requireGlobalAdminPageAccess(rule: AccessRule): Promise<AdminContext> {
  try {
    return await requireGlobalAdminActionAccess(rule)
  } catch (error) {
    if (error instanceof AccessDeniedError) redirect(error.status === 401 ? '/login?next=/admin' : '/admin')
    throw error
  }
}
