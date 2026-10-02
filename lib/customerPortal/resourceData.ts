function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

export function unwrapOpsData(payload: unknown): unknown {
  const row = object(payload)
  return row && Object.prototype.hasOwnProperty.call(row, 'data') ? row.data : payload
}

/** Preserve both the granular object form and the documented named resource form. */
export function canonicalResourceRows(value: unknown, key: string): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap((item) => object(item) ? [object(item)!] : [])
  const row = object(value)
  if (!row) return []
  const hasNamedResource = Object.prototype.hasOwnProperty.call(row, key)
  const nested = hasNamedResource ? row[key] : row.items
  if (Array.isArray(nested)) return canonicalResourceRows(nested, key)
  if (hasNamedResource) {
    const resource = object(nested)
    return resource && Object.keys(resource).length ? [resource] : []
  }
  return Object.keys(row).length ? [row] : []
}
