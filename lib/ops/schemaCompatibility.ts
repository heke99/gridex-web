import { OpsSchemaError } from '@/lib/ops/errors'

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/**
 * AJV emits secondary oneOf/type(null) errors when an object branch fails only
 * because OPS added an otherwise compatible response property. Treat that
 * cascade as additive, while still rejecting required/type/enum/const errors.
 */
export function isCompatibleAdditiveResponseSchemaError(error: unknown): boolean {
  if (!(error instanceof OpsSchemaError)) return false
  const details = record(error.details)
  const errors = Array.isArray(details?.errors) ? details.errors : []
  const normalized = errors
    .map((item) => record(item))
    .filter((item): item is Record<string, unknown> => item !== null)
  const additivePaths = normalized
    .filter((item) => item.keyword === 'additionalProperties')
    .map((item) => text(item.instancePath) ?? '')
  const versionOnly = normalized.every((item) =>
    item.keyword === 'const' &&
    (text(item.instancePath) === '/contract_schema_version' || text(item.instancePath) === '/contract_version')
  )
  if (versionOnly && normalized.length > 0) return true
  if (additivePaths.length === 0) return false

  const isAtAdditivePath = (instancePath: string): boolean => additivePaths.some((path) => (
    instancePath === path ||
    (path && instancePath && path.startsWith(`${instancePath}/`))
  ))

  return normalized.length === errors.length && normalized.every((item) => {
    const keyword = text(item.keyword)
    const instancePath = text(item.instancePath) ?? ''
    if (keyword === 'additionalProperties') return true
    if (keyword === 'const' && (instancePath === '/contract_schema_version' || instancePath === '/contract_version')) return true
    if ((keyword === 'oneOf' || keyword === 'anyOf') && isAtAdditivePath(instancePath)) return true
    if (keyword === 'type' && isAtAdditivePath(instancePath)) {
      return record(item.params)?.type === 'null'
    }
    return false
  })
}
