import { OpsError } from '@/lib/ops/errors'
import type { CustomerResourcePage } from './types'

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

export function unwrapOpsData(payload: unknown): unknown {
  const row = object(payload)
  return row && Object.prototype.hasOwnProperty.call(row, 'data') ? row.data : payload
}

/** Project only the public advisory metadata already returned by OPS. */
export function canonicalResourcePage(
  payload: unknown,
  resourceKey: string,
  returnedRows: number,
): CustomerResourcePage | null {
  const envelope = object(payload)
  if (!envelope || !Object.prototype.hasOwnProperty.call(envelope, 'page')) return null
  const rootPage = object(envelope.page)
  // The sites response groups its page under `page.sites`, alongside data
  // containing the separate sites and metering_points public resources.
  const page = rootPage && Object.prototype.hasOwnProperty.call(rootPage, resourceKey)
    ? object(rootPage[resourceKey])
    : rootPage
  const limit = page?.limit
  const offset = page?.offset
  const returned = page?.returned
  const nextCursor = page?.next_cursor
  if (!page || !Number.isSafeInteger(limit) || Number(limit) < 1 || Number(limit) > 100 ||
    !Number.isSafeInteger(offset) || Number(offset) < 0 ||
    !Number.isSafeInteger(returned) || Number(returned) < 0 || Number(returned) > Number(limit) || returned !== returnedRows ||
    typeof page.has_more !== 'boolean' ||
    (nextCursor !== null && (typeof nextCursor !== 'string' || !/^[A-Za-z0-9_-]{1,8192}$/.test(nextCursor)))) {
    throw new OpsError('Kundhistoriens siduppgifter kunde inte verifieras.', 502, {
      code: 'ops_customer_pagination_invalid', field: 'page', retryable: false,
      request_id: typeof envelope.request_id === 'string' ? envelope.request_id : null,
      correlation_id: typeof envelope.correlation_id === 'string' ? envelope.correlation_id : null,
    })
  }
  return {
    limit: Number(limit),
    offset: Number(offset),
    returned: Number(returned),
    has_more: page.has_more,
    next_cursor: nextCursor as string | null,
  }
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
