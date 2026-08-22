import { GRIDEX_WEBSITE_API_CONTRACT_VERSION } from '@/lib/ops/contract'
import { compareContractVersions } from '@/lib/ops/contractCompatibility'
import { OpsSchemaError } from '@/lib/ops/errors'

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function isVersionPath(instancePath: string): boolean {
  return instancePath === '/contract_schema_version' || instancePath === '/contract_version'
}

/**
 * AJV emits secondary oneOf/type(null) errors when an object branch fails only
 * because Gridex added an otherwise compatible response property. During a
 * staged API rollout, a version const mismatch is tolerated only when the
 * received contract is parseable and newer than the tenant's pinned contract.
 * Required/type/enum errors and older/unparseable contract versions still fail closed.
 */
export function isCompatibleAdditiveResponseSchemaError(error: unknown): boolean {
  if (!(error instanceof OpsSchemaError)) return false
  const details = record(error.details)
  const errors = Array.isArray(details?.errors) ? details.errors : []
  const normalized = errors
    .map((item) => record(item))
    .filter((item): item is Record<string, unknown> => item !== null)
  if (normalized.length !== errors.length || normalized.length === 0) return false

  const receivedVersion = text(details?.contract_schema_version)
  const versionComparison = compareContractVersions(
    GRIDEX_WEBSITE_API_CONTRACT_VERSION,
    receivedVersion,
  )
  const newerCompatibleVersion =
    versionComparison.parseable && versionComparison.newerThanLocal === true

  const additivePaths = normalized
    .filter((item) => item.keyword === 'additionalProperties')
    .map((item) => text(item.instancePath) ?? '')

  const versionOnly = normalized.every((item) => (
    item.keyword === 'const' && isVersionPath(text(item.instancePath) ?? '')
  ))
  if (versionOnly) return newerCompatibleVersion
  if (additivePaths.length === 0) return false

  const isAtAdditivePath = (instancePath: string): boolean => additivePaths.some((path) => (
    instancePath === path ||
    (path && instancePath && path.startsWith(`${instancePath}/`))
  ))

  return normalized.every((item) => {
    const keyword = text(item.keyword)
    const instancePath = text(item.instancePath) ?? ''
    if (keyword === 'additionalProperties') return true
    if (keyword === 'const' && isVersionPath(instancePath)) return newerCompatibleVersion
    if ((keyword === 'oneOf' || keyword === 'anyOf') && isAtAdditivePath(instancePath)) return true
    if (keyword === 'type' && isAtAdditivePath(instancePath)) {
      return record(item.params)?.type === 'null'
    }
    return false
  })
}
