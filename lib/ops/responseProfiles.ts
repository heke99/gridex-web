/** Explicit supported V1 response profiles; arbitrary version strings never pass. */
export type SupportedResponseVersion = '2026-10-04.1' | '2026-10-09.1'
const supported = ['2026-10-04.1', '2026-10-09.1'] as const
export function isSupportedResponseVersion(value: unknown): value is SupportedResponseVersion {
  return typeof value === 'string' && supported.includes(value as SupportedResponseVersion)
}

/**
 * The newer schemas preserve the earlier business shape. Permit the published
 * earlier envelope revision while retaining every required field, type, enum,
 * additionalProperties restriction and all request/business validation.
 */
export function withSupportedResponseProfiles<T>(schema: T): T {
  const copy = structuredClone(schema)
  function visit(value: unknown): void {
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) { value.forEach(visit); return }
    const record = value as Record<string, unknown>
    for (const key of ['contract_schema_version', 'contract_version']) {
      const version = record[key]
      if (version && typeof version === 'object' && !Array.isArray(version)) {
        const definition = version as Record<string, unknown>
        if (supported.includes(definition.const as SupportedResponseVersion)) {
          delete definition.const
          definition.enum = [...supported]
        }
      }
    }
    Object.values(record).forEach(visit)
  }
  visit(copy)
  return copy
}
