// lib/gridex/pricing/schema.ts

function errMessage(err: unknown): string {
  if (typeof err === 'object' && err && 'message' in err) {
    return String((err as { message: unknown }).message)
  }
  return String(err ?? '')
}

export function looksLikeMissingColumn(err: unknown, column: string): boolean {
  const msg = errMessage(err).toLowerCase()
  const col = column.toLowerCase()
  return msg.includes('column') && msg.includes(col) && msg.includes('does not exist')
}

export function looksLikeBadSelect(err: unknown): boolean {
  const msg = errMessage(err).toLowerCase()
  // broad safety: Postgres "does not exist", PostgREST "unknown column", etc.
  return msg.includes('does not exist') || msg.includes('unknown') || msg.includes('column')
}