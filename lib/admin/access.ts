export type AccessRule = {
  anyOf?: string[]
  allOf?: string[]
}

type PermissionSource = readonly string[] | { permissions: readonly string[] }

export class AccessDeniedError extends Error {
  readonly status: 401 | 403

  constructor(status: 401 | 403 = 403) {
    super(status === 401 ? 'Unauthorized' : 'Permission denied')
    this.name = 'AccessDeniedError'
    this.status = status
  }
}

export function normalizePermissions(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === 'string' && item.length > 0))]
    : []
}

export function canAccessByRule(source: PermissionSource, rule?: AccessRule): boolean {
  if (!rule) return true
  const permissions = Array.isArray(source) ? source : (source as { permissions: readonly string[] }).permissions
  if (rule.allOf && !rule.allOf.every((permission) => permissions.includes(permission))) return false
  if (rule.anyOf && !rule.anyOf.some((permission) => permissions.includes(permission))) return false
  return true
}

// Console entry and operation authority are separate. A staff permission permits
// opening the shell; every page/action still checks its own exact permission.
export function canEnterAdminConsole(permissions: readonly string[]): boolean {
  return permissions.some((permission) => permission === 'admin.access' ||
    /^(?:support_tickets|contracts|pricing|spot|portfolio|rbac|users|agreements|integrations|cis|billing|settlements|incidents|audit|compliance)\./.test(permission))
}

export function pricingPublishRule(production: boolean): AccessRule {
  return production
    ? { allOf: ['pricing.publish_prod'] }
    : { anyOf: ['pricing.publish', 'pricing.publish_prod'] }
}

export function cisOperationRule(operation: 'retry' | 'cancel' | 'resend_signature'): AccessRule {
  return { allOf: [operation === 'resend_signature' ? 'cis.signature.write' : 'cis.sync.write'] }
}

export function assertActionAccess(
  context: { userId: string; permissions: readonly string[] },
  rule?: AccessRule,
): void {
  if (!context.userId) throw new AccessDeniedError(401)
  if (!canEnterAdminConsole(context.permissions) || !canAccessByRule(context, rule)) {
    throw new AccessDeniedError(403)
  }
}
